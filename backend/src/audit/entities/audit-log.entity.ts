import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Separate from IncidentEvent on purpose: IncidentEvent is domain history
 * ("what happened to this incident"), AuditLog is security/compliance
 * history ("who did what in the system"). They overlap in content but serve
 * different consumers — a security review reads AuditLog; a responder reads
 * the incident timeline. Denormalized (no FK to Incident) so it survives an
 * incident being deleted and to keep writes to it fully decoupled from the
 * incidents module.
 */
@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['actorId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id' })
  actorId: string;

  @Column({ name: 'actor_email' })
  actorEmail: string;

  // e.g. "incident.status_changed", "incident.created", "auth.login_failed"
  @Column()
  action: string;

  @Column({ name: 'entity_type' })
  entityType: string;

  @Column({ name: 'entity_id', nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
