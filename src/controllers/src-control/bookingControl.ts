import { Request, Response } from 'express';
import crypto from 'crypto';
import { AppDataSource } from '../../db/datasource';
import { Booking, BookingStatus, Wallet, Transaction, TransactionType, TransactionStatus, Vehicle } from '../entity';
import { logger } from '../../utils/logger'; 


// CREATE A NEW BOOKING

export const createBooking = async (req: Request, res: Response) => {
  // #swagger.tags = ['Bookings']
  // #swagger.security = [{ "bearerAuth": [] }]
  const customerId = req.user?.id as string;
  const { vehicleId, startDate, endDate } = req.body;

  try {
    if (!vehicleId || !startDate || !endDate) return res.status(400).json({ message: 'Missing fields' });

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const bookingResult = await AppDataSource.transaction(async (tx) => {
      const vehicle = await tx.getRepository(Vehicle).createQueryBuilder('v').setLock('pessimistic_write').where('v.id = :id', { id: vehicleId }).getOne();
      if (!vehicle) throw new Error('VEHICLE_NOT_FOUND');

      const overlap = await tx.getRepository(Booking).createQueryBuilder('b')
        .where('b.vehicleId = :vId', { vId: vehicleId })
        .andWhere('b.status IN (:...s)', { s: [BookingStatus.PENDING, BookingStatus.PAID, BookingStatus.ACTIVE] })
        .andWhere('((b.startDate <= :start AND b.endDate >= :start) OR (b.startDate <= :end AND b.endDate >= :end))', { start, end })
        .getOne();
      
      if (overlap) throw new Error('VEHICLE_ALREADY_BOOKED');

      const wallet = await tx.getRepository(Wallet).createQueryBuilder('w').setLock('pessimistic_write').where('w.userId = :uId', { uId: customerId }).getOne();
      if (!wallet) throw new Error('WALLET_NOT_FOUND');

      const totalPrice = Number(vehicle.dailyPrice) * totalDays;
      if (Number(wallet.balance) < totalPrice) throw new Error('INSUFFICIENT_FUNDS');

      wallet.balance = Number(wallet.balance) - totalPrice;
      await tx.save(wallet);

      const ref = `BKG-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
      await tx.save(tx.getRepository(Transaction).create({
        walletId: wallet.id, amount: totalPrice, type: TransactionType.DEBIT, status: TransactionStatus.SUCCESS,
        description: `Booking: ${vehicle.brand} ${vehicle.model}`, reference: ref
      }));

      const booking = await tx.save(tx.getRepository(Booking).create({
        customerId, vehicleId, startDate: start, endDate: end, totalPrice, status: BookingStatus.PAID
      }));

      return { booking, ref, newBalance: wallet.balance };
    });

    return res.status(201).json({ success: true, ...bookingResult });
  } catch (error: any) {
    logger.error({ err: error }, 'Create Booking Failed');
    return res.status(400).json({ message: error.message || 'Booking failed' });
  }
};


// GET MY BOOKINGS

export const getMyBookings = async (req: Request, res: Response) => {
  // #swagger.tags = ['Bookings']
  const customerId = req.user?.id as string;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 10);

  try {
    const [bookings, totalCount] = await AppDataSource.getRepository(Booking).findAndCount({
      where: { customerId }, relations: { vehicle: true }, order: { createdAt: 'DESC' },
      skip: (page - 1) * limit, take: limit,
    });
    return res.status(200).json({ success: true, bookings, totalCount });
  } catch (error) {
    logger.error({ err: error }, 'Fetch Bookings Failed');
    return res.status(500).json({ message: 'Internal error' });
  }
};


// CANCEL BOOKING (Audit Trail Restored)

export const cancelBooking = async (req: Request, res: Response) => {
  // #swagger.tags = ['Bookings']
  const id = String(req.params.id);
  const customerId = req.user?.id as string;

  try {
    const result = await AppDataSource.transaction(async (tx) => {
      const b = await tx.getRepository(Booking).findOne({ where: { id, customerId }, relations: { vehicle: true } });
      if (!b || b.status !== BookingStatus.PAID) throw new Error('INVALID_CANCEL');

      const wallet = await tx.getRepository(Wallet).createQueryBuilder('w').setLock('pessimistic_write').where('w.userId = :uId', { uId: customerId }).getOne();
      if (!wallet) throw new Error('WALLET_NOT_FOUND');

      const refund = Number(b.totalPrice) * 0.9;
      wallet.balance = Number(wallet.balance) + refund;
      
      await tx.save(wallet);
      b.status = BookingStatus.CANCELLED;
      await tx.save(b);

      await tx.save(tx.getRepository(Transaction).create({
        walletId: wallet.id, amount: refund, type: TransactionType.CREDIT, status: TransactionStatus.SUCCESS,
        description: `Refund: ${b.vehicle.brand}`, reference: `RFD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`
      }));

      return { balance: wallet.balance };
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    logger.error({ err: error }, 'Cancel Booking Failed');
    return res.status(400).json({ message: error.message });
  }
};


// UPDATE BOOKING (Extension)

export const updateBooking = async (req: Request, res: Response) => {
  // #swagger.tags = ['Bookings']
  const id = String(req.params.id);
  const { newEndDate } = req.body;
  const customerId = req.user?.id as string;

  try {
    const booking = await AppDataSource.transaction(async (tx) => {
      const b = await tx.getRepository(Booking).findOne({ where: { id, customerId } });
      if (!b) throw new Error('NOT_FOUND');
      
      const newEnd = new Date(newEndDate);
      const extraDays = Math.ceil((newEnd.getTime() - b.endDate.getTime()) / 86400000);
      const dailyRate = Number(b.totalPrice) / Math.ceil((b.endDate.getTime() - b.startDate.getTime()) / 86400000);
      const cost = extraDays * dailyRate;

      const wallet = await tx.getRepository(Wallet).createQueryBuilder('w').setLock('pessimistic_write').where('w.userId = :uId', { uId: customerId }).getOne();
      if (!wallet || Number(wallet.balance) < cost) throw new Error('FUNDS_ERROR');

      wallet.balance = Number(wallet.balance) - cost;
      b.endDate = newEnd;
      b.totalPrice = Number(b.totalPrice) + cost;
      await tx.save([wallet, b]);
      return b;
    });
    return res.status(200).json({ success: true, booking });
  } catch (error: any) {
    logger.error({ err: error }, 'Update Booking Failed');
    return res.status(400).json({ message: error.message });
  }
};


// DELETE BOOKING

export const deleteBooking = async (req: Request, res: Response) => {
  // #swagger.tags = ['Bookings']
  const id = String(req.params.id);
  const customerId = req.user?.id as string;

  try {
    const repo = AppDataSource.getRepository(Booking);
    const booking = await repo.findOne({ where: { id, customerId } });

    if (!booking || booking.status !== BookingStatus.PENDING) {
      return res.status(400).json({ message: 'Cannot delete.' });
    }

    await repo.remove(booking);
    return res.status(200).json({ success: true, message: 'Deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Delete Booking Failed');
    return res.status(500).json({ message: 'Error deleting booking' });
  }
};