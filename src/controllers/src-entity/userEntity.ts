import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  DeleteDateColumn,
  OneToMany,
  OneToOne,
  Index
} from 'typeorm';
import { Vehicle } from '../entity';
import { Wallet } from '../entity';

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  CAR_OWNER = 'CAR_OWNER',
  ADMIN = 'ADMIN',
  CEO = 'CEO'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string; //had to learn that uuid is alphanumeric lol could have use autoincreasing number but i feel it would be troublesome if a user is deleted and the list breaks or something

  @Index({ unique: true }) // Blazing fast login lookups
  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  password?: string;

  @Column({ type: 'varchar' })
  fullName!: string;

  @Column({ type: 'varchar', nullable: true })
  securityQuestion?: string; //  "What was the name of your first pet?"

  @Column({ type: 'varchar', nullable: true })
  securityAnswerHash?: string; // Hashed answer for secure comparison

  @Index() // Speeds up CEO/Admin analytics filters by role
  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role!: UserRole;
  
  @Column({ type: 'boolean', default: true })
  isActive!: boolean; // False when suspended

  @Column({ type: 'timestamp', nullable: true })
  suspendedAt?: Date; // Tracks exactly when they were suspended

  @Column({ type: 'boolean', default: false })
  isVerified!: boolean;

  @Column({ type: 'varchar', nullable: true })
  profileImage?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt?: Date;

  @DeleteDateColumn() //Logic for soft delete
  deletedAt?: Date;

  // Relations
  @OneToOne(() => Wallet, (wallet) => wallet.user, { cascade: true })
  wallet!: Wallet;
  
  @OneToMany(() => Vehicle, (vehicle) => vehicle.owner)
  vehicles?: Vehicle[];
}