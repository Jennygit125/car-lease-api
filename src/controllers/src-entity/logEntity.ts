import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index
} from 'typeorm';

@Entity('log_activities')
export class LogActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string; // Always give your logs a primary key so they can be uniquely identified!

  @Column({ type: 'varchar', length: 255 })
  action!: string; // e.g., "auth.login", "wallet.withdraw_request"

  @Column({ type: 'uuid', nullable: true })
  userId?: string | null; // UUIDs are strings in JS/TS. Nullable if an unauthenticated user hits the system.

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null; // varchar(45) accommodates both IPv4 and IPv6 addresses perfectly.

  // Using jsonb allows you to store flexible objects/metadata securely and query inside them later
  @Column({ type: 'jsonb', nullable: true })
  metaData?: Record<string, any> | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  @Index() // This automatically indexes your unique reference tracking code safely
  reference?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}