import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../db/datasource';
import { Wallet } from '../controllers/entity'; 
import crypto from 'crypto';

/** Validates that the user has a wallet and checks if it's bank-verified.
 */
export const validateWallet = (requireBankVerification: boolean = false) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const wallet = await AppDataSource.getRepository(Wallet).findOne({ where: { userId } });
    
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
    
    // "Banker" check: Ensure the wallet is verified if the route requires it
    if (requireBankVerification && !wallet.isBankVerified) {
      return res.status(403).json({ message: 'Bank account verification required for this action.' });
    }

    (req as any).wallet = wallet; 
    next();
  };
};

/**
 * Verifies that the webhook request is genuinely from Paystack.
 */
export const verifyPaystackSignature = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-paystack-signature'];
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!signature || !secret) return res.sendStatus(403);

  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash === signature) {
    next();
  } else {
    res.sendStatus(403); 
  }
};