import { Request, Response } from 'express';
import { AppDataSource } from '../../db/datasource';
import { Wallet } from '../src-entity/walletEntity';
import { Transaction } from '../entity';


// GET ALL TRANSACTIONS FOR USER'S WALLET (PAGINATED)

export const getMyTransactions = async (req: Request, res: Response) => {
  // #swagger.tags = ['Transactions']
  // #swagger.security = [{ "bearerAuth": [] }]
  const userId = req.user?.id;

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
  const skip = (page - 1) * limit;

  try {
    const walletRepo = AppDataSource.getRepository(Wallet);
    const transactionRepo = AppDataSource.getRepository(Transaction);

    // Retrieve the wallet first to get the walletId for this user
    const wallet = await walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      return res.status(200).json({
        success: true,
        pagination: {
          totalItems: 0,
          totalPages: 0,
          currentPage: page,
          pageSize: limit,
        },
        transactions: [],
      });
    }

    // Fetch all ledger entries linked directly to this walletId
    const [transactions, totalCount] = await transactionRepo.findAndCount({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return res.status(200).json({
      success: true,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        pageSize: limit,
      },
      transactions,
    });
  } catch (error) {
    console.error('Fetch Transactions Error:', error);
    return res.status(500).json({ message: 'Internal server error compiling transaction ledger.' });
  }
};


// GET SINGLE TRANSACTION BY ID / REFERENCE

export const getTransactionDetails = async (req: Request, res: Response) => {
  // #swagger.tags = ['Transactions']
  // #swagger.security = [{ "bearerAuth": [] }]
  const userId = req.user?.id;
  const { identifier } = req.params as { identifier: string };

  try {
    const walletRepo = AppDataSource.getRepository(Wallet);
    const transactionRepo = AppDataSource.getRepository(Transaction);

    const wallet = await walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    // Query by either ID or our unique tracking reference
    const transaction = await transactionRepo.findOne({
      where: [
        { id: identifier, walletId: wallet.id },
        { reference: identifier, walletId: wallet.id }
      ]
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found or unauthorized access.' });
    }

    return res.status(200).json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error('Fetch Transaction Details Error:', error);
    return res.status(500).json({ message: 'Internal server error retrieving transaction details.' });
  }
};