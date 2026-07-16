import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { User } from './userEntity';
import { Vehicle } from './vehicleEntity';

export enum BookingStatus {
  PENDING = 'PENDING',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAID = 'PAID',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  customerId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) // Prevent deleting users with active histories
  @JoinColumn({ name: 'customerId' })
  customer!: User;

  @Column({ type: 'uuid' })
  vehicleId!: string;

  @ManyToOne(() => Vehicle, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle!: Vehicle;

  @Column({ type: 'timestamp' })
  startDate!: Date;

  @Column({ type: 'timestamp' })
  endDate!: Date;

  // Added the transformer to cast the PG string representation back to a TS number automatically
  @Column({ 
    type: 'numeric', 
    precision: 10, 
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value)
    }
  })
  totalPrice!: number;

  @Index() // for dashboard filters (e.g., viewing all "ACTIVE" rentals)
  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt?: Date;
}