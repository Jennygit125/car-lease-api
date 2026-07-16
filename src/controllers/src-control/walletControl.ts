import { Request, Response } from 'express';
import crypto from 'crypto';
import { AppDataSource } from '../../db/datasource';
import { Wallet, Transaction, TransactionType, TransactionStatus } from '../entity';

 
const generateMicroDeposits = (): [number, number] => {
  const dep1 = crypto.randomInt(1, 100); // Safe 1 to 99 cents
  const dep2 = crypto.randomInt(1, 100);
  return [dep1, dep2];
};


// LINK BANK ACCOUNT & INITIATE MICRO-DEPOSITS

export const linkBankAccount = async (req: Request, res: Response) => {
  // #swagger.tags = ['Wallet']
  const userId = req.user?.id;
  const { bankName, accountNumber, accountName } = req.body;

  if (!bankName || !accountNumber || !accountName) {
    return res.status(400).json({ message: 'Missing bankName, accountNumber, or accountName.' });
  }

  try {
    const mockGatewayToken = `ba_tok_${crypto.randomBytes(16).toString('hex')}`;
    const [dep1, dep2] = generateMicroDeposits();

    const wallet = await AppDataSource.transaction(async (transactionalEntityManager) => {
      const walletRepo = transactionalEntityManager.getRepository(Wallet);
      
      // Lock on write to prevent concurrent wallet linking conflicts
      let existingWallet = await walletRepo.createQueryBuilder('wallet')
        .setLock('pessimistic_write')
        .where('wallet.userId = :userId', { userId })
        .getOne();

      if (!existingWallet) {
        existingWallet = walletRepo.create({ 
          userId, 
          balance: 0, 
          pendingBalance: 0, 
          verificationAttempts: 0 
        });
      }

      existingWallet.bankName = bankName.trim();
      existingWallet.accountNumber = accountNumber.trim();
      existingWallet.accountName = accountName.trim();
      existingWallet.isBankVerified = false;
      existingWallet.gatewayBankToken = mockGatewayToken;
      existingWallet.microDeposits = [dep1, dep2];
      existingWallet.verificationAttempts = 0; // Reset brute force counter on new link

      return await transactionalEntityManager.save(existingWallet);
    });

    console.log(`[Stripe Simulation] Sent secure micro-deposits: $${(dep1/100).toFixed(2)} and $${(dep2/100).toFixed(2)}`);

    return res.status(200).json({
      success: true,
      message: 'Bank linked successfully. Two micro-deposits have been sent. Please verify their cent amounts.',
      gatewayBankToken: mockGatewayToken,
    });
  } catch (error) {
    console.error('Link Bank Account Error:', error);
    return res.status(500).json({ message: 'Internal server error saving bank credentials.' });
  }
};


// VERIFY MICRO-DEPOSITS

export const verifyBankAccount = async (req: Request, res: Response) => {
  // #swagger.tags = ['Wallet']
  const userId = req.user?.id;
  const { deposit1, deposit2 } = req.body; 

  const dep1Val = Number(deposit1);
  const dep2Val = Number(deposit2);

  if (!Number.isInteger(dep1Val) || !Number.isInteger(dep2Val)) {
    return res.status(400).json({ message: 'Deposit amounts must be clean integer values in cents.' });
  }

  try {
    const result = await AppDataSource.transaction(async (transactionalEntityManager) => {
      const walletRepo = transactionalEntityManager.getRepository(Wallet);

     
      // This stops multi-request brute-force bypasses dead in their tracks.
      const wallet = await walletRepo.createQueryBuilder('wallet')
        .setLock('pessimistic_write')
        .where('wallet.userId = :userId', { userId })
        .getOne();

      if (!wallet) {
        throw new Error('WALLET_NOT_FOUND');
      }

      if (wallet.isBankVerified) {
        throw new Error('ALREADY_VERIFIED');
      }

      if (!wallet.microDeposits || wallet.microDeposits.length < 2) {
        throw new Error('NO_DEPOSITS_FOUND');
      }

      // Brute Force Protection
      if (wallet.verificationAttempts >= 3) {
        throw new Error('ACCOUNT_LOCKED');
      }

      const [expected1, expected2] = wallet.microDeposits;
      const matches = 
        (dep1Val === expected1 && dep2Val === expected2) ||
        (dep1Val === expected2 && dep2Val === expected1);

      if (!matches) {
        wallet.verificationAttempts += 1;
        await transactionalEntityManager.save(wallet);
        return { success: false, attemptsUsed: wallet.verificationAttempts };
      }

      // Success Setup
      wallet.isBankVerified = true;
      wallet.microDeposits = []; 
      wallet.verificationAttempts = 0;
      await transactionalEntityManager.save(wallet);

      return { success: true };
    });

    if (!result.success) {
      const remaining = 3 - (result.attemptsUsed ?? 0);
      return res.status(422).json({ 
        success: false, 
        message: `Verification failed. Attempts remaining: ${remaining}` 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Bank account verified successfully.',
    });

  } catch (error: any) {
    console.error('Verify Bank Deposits Error:', error);

    if (error.message === 'WALLET_NOT_FOUND') return res.status(404).json({ message: 'Wallet not configured.' });
    if (error.message === 'ALREADY_VERIFIED') return res.status(400).json({ message: 'Bank account is already verified.' });
    if (error.message === 'NO_DEPOSITS_FOUND') return res.status(400).json({ message: 'No active micro-deposits found for verification.' });
    if (error.message === 'ACCOUNT_LOCKED') return res.status(423).json({ message: 'Account locked due to excessive verification failures. Please relink your bank.' });

    return res.status(500).json({ message: 'Internal server error processing verification.' });
  }
};


// 3. WITHDRAW FUNDS (SAFE MATH & CONCURRENCY GUARD)

export const withdrawFunds = async (req: Request, res: Response) => {
  // #swagger.tags = ['Wallet']
  const userId = req.user?.id;
  const { amount } = req.body; // Expecting cents as integer (e.g., 1000 for $10.00)

  const withdrawAmount = Number(amount);
  if (!Number.isInteger(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({ message: 'Withdrawal amount must be a positive integer representing cents.' });
  }

  try {
    const result = await AppDataSource.transaction(async (transactionalEntityManager) => {
      // Pessimistic Write lock ensures no concurrency anomalies (like double withdrawal) can happen
      const wallet = await transactionalEntityManager.getRepository(Wallet)
        .createQueryBuilder('wallet')
        .setLock('pessimistic_write')
        .where('wallet.userId = :userId', { userId })
        .getOne();

      if (!wallet) {
        throw new Error('WALLET_NOT_FOUND');
      }

      if (!wallet.isBankVerified || !wallet.gatewayBankToken) {
        throw new Error('BANK_UNVERIFIED');
      }

      const currentBalance = Number(wallet.balance);
      if (currentBalance < withdrawAmount) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      // Perform clean integer math safely
      wallet.balance = currentBalance - withdrawAmount;
      await transactionalEntityManager.save(wallet);

      // Ledger Entry Generation
      const reference = `WDL-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
      const logEntry = transactionalEntityManager.getRepository(Transaction).create({
        walletId: wallet.id,
        amount: withdrawAmount,
        type: TransactionType.DEBIT,
        status: TransactionStatus.SUCCESS,
        description: `Withdrawal of $${(withdrawAmount / 100).toFixed(2)} to verified account.`,
        reference,
      });

      await transactionalEntityManager.save(logEntry);

      return { wallet, logEntry };
    });

    return res.status(200).json({
      success: true,
      message: 'Withdrawal completed successfully.',
      newBalance: Number(result.wallet.balance), // Returned in cents
      transaction: result.logEntry,
    });

  } catch (error: any) {
    console.error('Transaction Aborted! Reason:', error.message);

    if (error.message === 'WALLET_NOT_FOUND') return res.status(404).json({ message: 'Wallet not configured.' });
    if (error.message === 'BANK_UNVERIFIED') return res.status(403).json({ message: 'Bank verification pending.' });
    if (error.message === 'INSUFFICIENT_FUNDS') return res.status(400).json({ message: 'Insufficient funds.' });

    return res.status(500).json({ message: 'Internal transaction database error.' });
  }
};

//GET WALLET BALANCE & STATUS

export const getWallet = async (req: Request, res: Response) => {
  // #swagger.tags = ['Wallet']
  const userId = req.user?.id;

  try {
    const walletRepo = AppDataSource.getRepository(Wallet);
    let wallet = await walletRepo.findOne({ where: { userId } });

    // If they don't have a wallet database entry yet, initialize one lazily
    if (!wallet) {
      wallet = walletRepo.create({ 
        userId, 
        balance: 0, 
        pendingBalance: 0, 
        verificationAttempts: 0 
      });
      await walletRepo.save(wallet);
    }

    return res.status(200).json({
      success: true,
      wallet: {
        id: wallet.id,
        balance: Number(wallet.balance), // In cents
        isBankVerified: wallet.isBankVerified,
        bankName: wallet.bankName,
        accountName: wallet.accountName,
      }
    });
  } catch (error) {
    console.error('Get Wallet Error:', error);
    return res.status(500).json({ message: 'Internal server error retrieving wallet details.' });
  }
};


// DEPOSIT FUNDS (MOCK PROCESSOR )

export const depositFunds = async (req: Request, res: Response) => {
  // #swagger.tags = ['Wallet']
  const userId = req.user?.id;
  const { amount } = req.body; // Integer cents (e.g., 5000 for $50.00)

  const depositAmount = Number(amount);
  if (!Number.isInteger(depositAmount) || depositAmount <= 0) {
    return res.status(400).json({ message: 'Deposit amount must be a positive integer in cents.' });
  }

  try {
    const result = await AppDataSource.transaction(async (transactionalEntityManager) => {
      const walletRepo = transactionalEntityManager.getRepository(Wallet);
      const transactionRepo = transactionalEntityManager.getRepository(Transaction);

      // Lock on write to guarantee balance consistency
      let wallet = await walletRepo.createQueryBuilder('wallet')
        .setLock('pessimistic_write')
        .where('wallet.userId = :userId', { userId })
        .getOne();

      if (!wallet) {
        wallet = walletRepo.create({ 
          userId, 
          balance: 0, 
          pendingBalance: 0, 
          verificationAttempts: 0 
        });
      }

    
      wallet.balance = Number(wallet.balance) + depositAmount;
      await transactionalEntityManager.save(wallet);

      // Write transaction ledger item
      const reference = `DEP-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
      const logEntry = transactionRepo.create({
        walletId: wallet.id,
        amount: depositAmount,
        type: TransactionType.CREDIT,
        status: TransactionStatus.SUCCESS,
        description: `Deposited $${(depositAmount / 100).toFixed(2)} via credit card.`,
        reference,
      });
      await transactionalEntityManager.save(logEntry);

      return { wallet, logEntry };
    });

    return res.status(200).json({
      success: true,
      message: 'Deposit completed successfully.',
      newBalance: Number(result.wallet.balance),
      transaction: result.logEntry,
    });
  } catch (error) {
    console.error('Deposit Error:', error);
    return res.status(500).json({ message: 'Internal server error processing deposit.' });
  }
};


// VIEW TRANSACTION HISTORY (LOGS)

export const getTransactionHistory = async (req: Request, res: Response) => {
  // #swagger.tags = ['Wallet']
  const userId = req.user?.id;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
  const skip = (page - 1) * limit;

  try {
    const walletRepo = AppDataSource.getRepository(Wallet);
    const transactionRepo = AppDataSource.getRepository(Transaction);

    const wallet = await walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      return res.status(200).json({
        success: true,
        pagination: { totalItems: 0, totalPages: 0, currentPage: page, pageSize: limit },
        transactions: []
      });
    }

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
    console.error('Get Transaction History Error:', error);
    return res.status(500).json({ message: 'Internal server error compiling ledger.' });
  }
};