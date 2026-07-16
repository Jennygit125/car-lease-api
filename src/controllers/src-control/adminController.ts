import { Request, Response } from 'express';
import { AppDataSource } from '../../db/datasource';
import { Booking, BookingStatus, Vehicle, Wallet, User, AuditLog } from '../entity';

// Helper to safely extract string ID from Express params
const getParamId = (id: string | string[] | undefined): string => {
  return Array.isArray(id) ? id[0] : (id || '');
};


// GLOBAL SYSTEM METRICS (CEO & ADMIN ONLY)

export const getSystemMetrics = async (req: Request, res: Response) => {
  const userRole = req.user?.role;
  if (userRole !== 'ADMIN' && userRole !== 'CEO') {
    return res.status(403).json({ message: 'Forbidden: Access restricted.' });
  }

  try {
    const bookingRepo = AppDataSource.getRepository(Booking);
    const vehicleRepo = AppDataSource.getRepository(Vehicle);
    const walletRepo = AppDataSource.getRepository(Wallet);
    const userRepo = AppDataSource.getRepository(User);

    const [
      totalUsers, totalVehicles, activeLeasesCount, totalWalletDeposits, totalRevenueResult, activeVehiclesCount
    ] = await Promise.all([
      userRepo.count(),
      vehicleRepo.count(),
      bookingRepo.count({ where: { status: BookingStatus.ACTIVE } }),
      walletRepo.createQueryBuilder('wallet').select('SUM(wallet.balance)', 'sum').getRawOne(),
      bookingRepo.createQueryBuilder('booking')
        .select('SUM(booking.totalPrice)', 'sum')
        .where('booking.status IN (:...statuses)', { statuses: [BookingStatus.PAID, BookingStatus.ACTIVE, BookingStatus.COMPLETED] })
        .getRawOne(),
      vehicleRepo.count({ where: { isAvailable: true } })
    ]);

    return res.status(200).json({
      success: true,
      timestamp: new Date(),
      metrics: {
        users: { totalRegistered: totalUsers },
        fleet: {
          totalVehicles,
          activeVehicles: activeVehiclesCount,
          currentlyRented: activeLeasesCount,
          utilizationRate: totalVehicles > 0 ? `${((activeLeasesCount / totalVehicles) * 100).toFixed(1)}%` : '0%',
        },
        finances: {
          totalPlatformRevenue: parseFloat(totalRevenueResult?.sum || '0'),
          totalEscrowBalances: parseFloat(totalWalletDeposits?.sum || '0'),
        }
      }
    });
  } catch (error) {
    console.error('Fetch System Metrics Error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};


// RETRIEVE ALL SYSTEM USERS

export const getAllUsersReport = async (req: Request, res: Response) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'CEO') return res.status(403).json({ message: 'Forbidden.' });

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));

  const [users, totalCount] = await AppDataSource.getRepository(User).findAndCount({
    select: { id: true, email: true, role: true, isActive: true, createdAt: true },
    relations: { wallet: true },
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });

  return res.status(200).json({
    success: true,
    pagination: { totalItems: totalCount, totalPages: Math.ceil(totalCount / limit), currentPage: page, pageSize: limit },
    users: users.map(u => ({ ...u, walletBalance: u.wallet ? Number(u.wallet.balance) : 0 })),
  });
};


// SUSPEND USER

export const suspendUser = async (req: Request, res: Response) => {
  const targetUserId = getParamId(req.params.id);
  const { reason } = req.body;

  try {
    await AppDataSource.transaction(async (tx) => {
      const user = await tx.getRepository(User).createQueryBuilder('user')
        .setLock('pessimistic_write').where('user.id = :id', { id: targetUserId }).getOne();

      if (!user) throw new Error('USER_NOT_FOUND');
      if (user.role === 'CEO' && req.user?.role !== 'CEO') throw new Error('CANNOT_SUSPEND_SUPERIOR');
      
      user.isActive = false;
      user.suspendedAt = new Date();
      await tx.save(user);

      await tx.getRepository(AuditLog).save({
        admin: { id: req.user!.id } as User,
        action: 'SUSPEND_USER',
        targetEntityId: targetUserId,
        details: { reason },
        ipAddress: req.ip
      });
    });
    return res.status(200).json({ success: true, message: 'User suspended.' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};


// ACTIVATE USER

export const activateUser = async (req: Request, res: Response) => {
  const targetUserId = getParamId(req.params.id);

  try {
    await AppDataSource.transaction(async (tx) => {
      const user = await tx.getRepository(User).createQueryBuilder('user')
        .setLock('pessimistic_write').where('user.id = :id', { id: targetUserId }).getOne();

      if (!user) throw new Error('USER_NOT_FOUND');
      
      user.isActive = true;
      user.suspendedAt = null as any;
      await tx.save(user);

      await tx.getRepository(AuditLog).save({
        admin: { id: req.user!.id } as User,
        action: 'ACTIVATE_USER',
        targetEntityId: targetUserId,
        ipAddress: req.ip
      });
    });
    return res.status(200).json({ success: true, message: 'User activated.' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};


// VIEW AUDIT LOGS

export const getAuditLogs = async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));

  const [logs, totalCount] = await AppDataSource.getRepository(AuditLog).findAndCount({
    relations: { admin: true },
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });

  return res.status(200).json({ success: true, pagination: { totalCount }, auditLogs: logs });
};


// PERMANENT DELETE USER

export const deleteUserAccount = async (req: Request, res: Response) => {
  const targetUserId = getParamId(req.params.id);

  try {
    await AppDataSource.transaction(async (tx) => {
      const userRepo = tx.getRepository(User);
      const user = await userRepo.findOneBy({ id: targetUserId });
      if (!user) throw new Error('USER_NOT_FOUND');
      if (user.role === 'CEO') throw new Error('CANNOT_DELETE_CEO');

      await userRepo.remove(user);
      await tx.getRepository(AuditLog).save({
        admin: { id: req.user!.id } as User,
        action: 'PERMANENT_DELETE_USER',
        targetEntityId: targetUserId,
        ipAddress: req.ip
      });
    });
    return res.status(200).json({ success: true, message: 'User permanently deleted.' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};


// CEO REVENUE REPORT

export const getCEORevenueReport = async (req: Request, res: Response) => {
  if (req.user?.role !== 'CEO') return res.status(403).json({ message: 'Restricted.' });

  const report = await AppDataSource.getRepository(Booking).createQueryBuilder('booking')
    .select("DATE_TRUNC('month', booking.createdAt)", 'month')
    .addSelect("SUM(booking.totalPrice)", 'revenue')
    .where("booking.status = :status", { status: BookingStatus.COMPLETED })
    .groupBy('month')
    .orderBy('month', 'DESC')
    .getRawMany();

  return res.status(200).json({ success: true, report });
};

