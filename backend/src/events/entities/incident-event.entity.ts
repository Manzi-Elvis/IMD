import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IncidentEventType } from '../../common/enums/incident.enum';
import { Incident } from '../../incidents/entities/incident.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Every meaningful change to an incident (status flip, severity change,
 * comment, attachment, assignment) is appended here rather than mutating
 * the incident row silently. This is what the frontend renders as the
 * incident timeline, and what makes past incidents useful evidence during
 * the next one — you can see exactly what was known, and when.
 */
@Entity('incident_events')
@Index(['incident'])
export class IncidentEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Incident, (incident) => incident.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @Column({ type: 'enum', enum: IncidentEventType })
  type: IncidentEventType;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'author_id' })
  author: User;

  // Free text for comments; structured "from -> to" summary for status/
  // severity/assignment changes. Kept as plain text (not jsonb) since it's
  // always rendered directly and never queried by field.
  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
