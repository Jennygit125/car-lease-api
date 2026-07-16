import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Wallet } from './walletEntity';

export enum TransactionType {
  CREDIT = "CREDIT",
  DEBIT = "DEBIT"
}

export enum TransactionStatus {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  PENDING = "PENDING"
}


@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  //obviously id is necessary start reading from review for best experience about entity's i don't comment same things twice maybe i would add reading order to readme ?

  @Column({ type: "uuid"})
  walletId!: string; //all must have wallets to transact if you don't have wallet you shouldn't be here

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'walletId' })
  wallet!: Wallet;

  @Column({ 
    type: 'numeric', 
    precision: 12, 
    scale: 2, 
    default: 0.00,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value)
    }
  })
  amount!: number;

  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.SUCCESS })
  status!: TransactionStatus; // for pending or failed webhooks later

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string; // e.g., "Payout request", "Booking payment... only here so everybody can sue each other"

  @Index({ unique: true }) // Fast external tracking & verification checks
  @Column({ type: 'varchar', unique: true })
  reference!: string; 

  @CreateDateColumn()
  createdAt!: Date;
}