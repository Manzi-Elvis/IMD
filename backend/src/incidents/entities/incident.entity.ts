import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IncidentSeverity, IncidentStatus } from '../../common/enums/incident.enum';
import { User } from '../../users/entities/user.entity';
import { IncidentEvent } from '../../events/entities/incident-event.entity';
import { Attachment } from '../../attachments/entities/attachment.entity';

@Entity('incidents')
// Composite index to make the dashboard's default "open incidents by severity"
// view a fast index scan rather than a sequential scan as the table grows.
@Index(['status', 'severity'])
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: IncidentSeverity })
  severity: IncidentSeverity;

  @Column({ type: 'enum', enum: IncidentStatus, default: IncidentStatus.OPEN })
  status: IncidentStatus;

  @ManyToOne(() => User, { eager: true, nullable: false })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  // Nullable: an incident can exist briefly before an on-call engineer claims it.
  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  // Postgres tsvector column, maintained by a trigger (see migrations) rather
  // than recomputed in application code on every write — keeps search correct
  // even for rows updated by raw SQL/migrations/backfills.
  @Column({ type: 'tsvector', select: false, nullable: true, name: 'search_vector' })
  searchVector: string;

  @OneToMany(() => IncidentEvent, (event) => event.incident)
  events: IncidentEvent[];

  @OneToMany(() => Attachment, (attachment) => attachment.incident)
  attachments: Attachment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
