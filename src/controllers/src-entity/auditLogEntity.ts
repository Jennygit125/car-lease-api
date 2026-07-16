import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { User } from './userEntity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // The Admin or CEO who performed the action
  @Column({ type: 'uuid' }) 
  adminId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'adminId' })
  admin!: User;

  // The action performed (e.g., 'SUSPEND_USER', 'ACTIVATE_USER')
  @Column({ type: 'varchar', length: 100 })
  action!: string;

  // The ID of the record that was affected
  @Column({ type: 'uuid', nullable: true })
  targetEntityId?: string;

  // Details about the change
  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, any>;

  @Column({ type: 'varchar', nullable: true })
  ipAddress?: string;

  @CreateDateColumn()
  createdAt!: Date;
}