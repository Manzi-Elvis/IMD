import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface RecordAuditParams {
  actorId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  // Fire-and-forget from the caller's perspective is tempting, but we await
  // here deliberately: an audit write that silently fails is worse than a
  // slightly slower request. If this ever needs to be async/queued, that
  // should be an explicit decision (e.g. via an outbox table), not a
  // forgotten `.catch(() => {})`.
  async record(params: RecordAuditParams): Promise<void> {
    const entry = this.auditRepo.create({
      actorId: params.actorId,
      actorEmail: params.actorEmail,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: params.metadata ?? null,
      ipAddress: params.ipAddress ?? null,
    });
    await this.auditRepo.save(entry);
  }

  async findForEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  async search(params: {
    action?: string;
    actorId?: string;
    page: number;
    limit: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const qb = this.auditRepo.createQueryBuilder('log').orderBy('log.createdAt', 'DESC');
    if (params.action) qb.andWhere('log.action = :action', { action: params.action });
    if (params.actorId) qb.andWhere('log.actorId = :actorId', { actorId: params.actorId });

    const [data, total] = await qb
      .skip((params.page - 1) * params.limit)
      .take(params.limit)
      .getManyAndCount();

    return { data, total };
  }
}
