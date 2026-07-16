import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  OneToOne, 
  JoinColumn, 
  OneToMany,
  UpdateDateColumn,
  Index
} from 'typeorm';
import { User } from './userEntity';
import { Transaction } from './transactionEntity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', unique: true })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0.00 })
  balance!: number;

  @Column({ type: 'int', default: 0 })
  verificationAttempts!: number;
  
 @Column({ type: 'varchar', length: 100, nullable: true })
  bankName?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  accountNumber?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  accountName?: string;

  @Column({ type: 'boolean', default: false })
  isBankVerified!: boolean;

  // auditing columns
  @Column({ type: 'varchar', length: 100, nullable: true })
  gatewayBankToken?: string; // Reference token returned by Stripe/Plaid

  @Column({ type: 'simple-array', nullable: true })
  microDeposits?: number[]; // Stores simulated micro-deposits (e.g., [12, 8] for $0.12, $0.08)

    // Track payouts yes i see that strange transfer
    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0.00 })
    pendingBalance!: number;

    @OneToMany(() => Transaction, (transaction) => transaction.wallet)
    transactions!: Transaction[];

    @UpdateDateColumn()
    updatedAt!: Date;
  }