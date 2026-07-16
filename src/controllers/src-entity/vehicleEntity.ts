import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { User } from './userEntity';

export enum FuelType {
  PETROL = 'PETROL',
  DIESEL = 'DIESEL',
  ELECTRIC = 'ELECTRIC',
  HYBRID = 'HYBRID'
}

export enum TransmissionType {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC'
}

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  ownerId!: string;

  @ManyToOne(() => User, (user) => user.vehicles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @Index() // Optimizes dashboard search
  @Column({ type: 'varchar' })
  brand?: string;

  @Column({ type: 'varchar' })
  model?: string;

  @Column({ type: 'int' })
  year?: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true })
  vin?: string;

  // Postgres numeric prevents rounding errors inherent to float types
  @Column({ 
    type: 'numeric', 
    precision: 10, 
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value)
    }
  })
  dailyPrice?: number;
  

  @Index() // Speeds up filtering for only currently available cars
  @Column({ type: 'varchar', default: 'V6 3.0L' })
  engineType!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: FuelType,
    default: FuelType.PETROL
  })
  fuelType!: FuelType;

  @Index()
  @Column({
    type: 'enum',
    enum: TransmissionType,
    default: TransmissionType.AUTOMATIC
  })
  transmission!: TransmissionType;

  // GPS Coordinates represented as simple spatial floats
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  longitude?: number;

  // Rent Period Setting limits (in days)
  @Index()
  @Column({ type: 'int', default: 1 }) // Min 1 day rental
  minRentDays!: number;

  @Index()
  @Column({ type: 'int', default: 30 }) // Max 30 days rental
  maxRentDays!: number;

  @Index()
  @Column({ type: 'boolean', default: true })
  isAvailable!: boolean;

  @Column({ type: 'text', array: true, default: '{}' }) // Native PG array syntax for image URLs
  images?: string[];

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn() // Soft delete allows owners to "remove" cars without crashing old booking metrics
  deletedAt?: Date;
}