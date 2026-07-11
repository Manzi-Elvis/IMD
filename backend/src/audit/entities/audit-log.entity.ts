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

  // Explicit `type: 'uuid'` (rather than relying on TypeORM's TS-type
  // inference) because reflect-metadata can't determine a real column type
  // from a `string | null` union — it falls back to "Object", which
  // Postgres rejects outright at DataSource init.
  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  // Same reasoning as entityId above: explicit type needed for a nullable
  // plain-string column.
  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}