import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from './entities/incident.entity';
import { IncidentEvent } from '../events/entities/incident-event.entity';
import {
  AddCommentDto,
  AssignOwnerDto,
  CreateIncidentDto,
  QueryIncidentsDto,
  UpdateSeverityDto,
  UpdateStatusDto,
} from './dto/incident.dto';
import { IncidentEventType, IncidentStatus } from '../common/enums/incident.enum';
import { Role } from '../common/enums/roles.enum';
import { IncidentStateMachine } from './incident-state-machine';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { IncidentsGateway } from '../websocket/incidents.gateway';

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentsRepo: Repository<Incident>,
    @InjectRepository(IncidentEvent)
    private readonly eventsRepo: Repository<IncidentEvent>,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly gateway: IncidentsGateway,
  ) {}

  async create(dto: CreateIncidentDto, reporter: AuthenticatedUser): Promise<Incident> {
    const incident = this.incidentsRepo.create({
      title: dto.title,
      description: dto.description,
      severity: dto.severity,
      status: IncidentStatus.OPEN,
      reporter: { id: reporter.id } as any,
      owner: null,
    });
    const saved = await this.incidentsRepo.save(incident);

    await this.logEvent(saved.id, IncidentEventType.CREATED, reporter, `Incident reported`);
    await this.auditService.record({
      actorId: reporter.id,
      actorEmail: reporter.email,
      action: 'incident.created',
      entityType: 'incident',
      entityId: saved.id,
      metadata: { severity: dto.severity },
    });

    const full = await this.findOne(saved.id);
    this.gateway.emitIncidentCreated(full);
    return full;
  }

  /**
   * Filtering + full-text search + pagination in one query. Uses
   * to_tsquery via the maintained search_vector column (see migrations)
   * rather than `ILIKE '%term%'`, which can't use an index and gets slow
   * once the incidents table has real history.
   */
  async findAll(
    query: QueryIncidentsDto,
  ): Promise<{ data: Incident[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.incidentsRepo
      .createQueryBuilder('incident')
      .leftJoinAndSelect('incident.reporter', 'reporter')
      .leftJoinAndSelect('incident.owner', 'owner')
      .orderBy('incident.createdAt', 'DESC');

    if (query.status) qb.andWhere('incident.status = :status', { status: query.status });
    if (query.severity) qb.andWhere('incident.severity = :severity', { severity: query.severity });
    if (query.ownerId) qb.andWhere('owner.id = :ownerId', { ownerId: query.ownerId });

    if (query.search?.trim()) {
      qb.andWhere('incident.search_vector @@ plainto_tsquery(:search)', {
        search: query.search.trim(),
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Incident> {
    const incident = await this.incidentsRepo.findOne({
      where: { id },
      relations: ['reporter', 'owner', 'attachments'],
    });
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }

  async getTimeline(id: string): Promise<IncidentEvent[]> {
    await this.findOne(id); // 404s if the incident doesn't exist
    return this.eventsRepo.find({
      where: { incident: { id } },
      order: { createdAt: 'ASC' },
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    actor: AuthenticatedUser,
  ): Promise<Incident> {
    const incident = await this.findOne(id);
    IncidentStateMachine.assertValidTransition(incident.status, dto.status);

    const from = incident.status;
    incident.status = dto.status;
    if (dto.status === IncidentStatus.RESOLVED) {
      incident.resolvedAt = new Date();
    }
    await this.incidentsRepo.save(incident);

    await this.logEvent(
      id,
      IncidentEventType.STATUS_CHANGE,
      actor,
      `Status changed from "${from}" to "${dto.status}"`,
    );
    await this.auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'incident.status_changed',
      entityType: 'incident',
      entityId: id,
      metadata: { from, to: dto.status },
    });

    const full = await this.findOne(id);
    this.gateway.emitIncidentUpdated(id, full);
    return full;
  }

  // Only on-call engineers (enforced at the controller with @Roles) may
  // reach this, but we double-check ownership isn't required here — any
  // on-call engineer, not just the assigned owner, can reclassify severity
  // (e.g. during handoff). Ownership *is* required to close an incident —
  // see the controller for that distinction.
  async updateSeverity(
    id: string,
    dto: UpdateSeverityDto,
    actor: AuthenticatedUser,
  ): Promise<Incident> {
    const incident = await this.findOne(id);
    const from = incident.severity;
    incident.severity = dto.severity;
    await this.incidentsRepo.save(incident);

    await this.logEvent(
      id,
      IncidentEventType.SEVERITY_CHANGE,
      actor,
      `Severity changed from "${from}" to "${dto.severity}"`,
    );
    await this.auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'incident.severity_changed',
      entityType: 'incident',
      entityId: id,
      metadata: { from, to: dto.severity },
    });

    const full = await this.findOne(id);
    this.gateway.emitIncidentUpdated(id, full);
    return full;
  }

  async assignOwner(
    id: string,
    dto: AssignOwnerDto,
    actor: AuthenticatedUser,
  ): Promise<Incident> {
    const incident = await this.findOne(id);
    const newOwner = await this.usersService.findById(dto.ownerId);

    incident.owner = newOwner;
    await this.incidentsRepo.save(incident);

    await this.logEvent(
      id,
      IncidentEventType.ASSIGNMENT_CHANGE,
      actor,
      `Owner set to ${newOwner.name}`,
    );
    await this.auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'incident.owner_assigned',
      entityType: 'incident',
      entityId: id,
      metadata: { ownerId: newOwner.id },
    });

    const full = await this.findOne(id);
    this.gateway.emitIncidentUpdated(id, full);
    return full;
  }

  async addComment(
    id: string,
    dto: AddCommentDto,
    actor: AuthenticatedUser,
  ): Promise<IncidentEvent> {
    await this.findOne(id); // 404s if missing
    const event = await this.logEvent(id, IncidentEventType.COMMENT, actor, dto.content);
    this.gateway.emitNewEvent(id, event);
    return event;
  }

  /**
   * Closing an incident (-> RESOLVED) is restricted to the incident's
   * assigned owner or an admin — unlike severity changes, which any
   * on-call engineer can make. This lives here rather than only in a role
   * guard because it depends on *instance* data (who owns this specific
   * incident), which a static @Roles() decorator can't express.
   */
  assertCanClose(incident: Incident, actor: AuthenticatedUser) {
    const isOwner = incident.owner?.id === actor.id;
    const isAdmin = actor.role === Role.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Only the assigned owner or an admin can resolve this incident',
      );
    }
  }

  private async logEvent(
    incidentId: string,
    type: IncidentEventType,
    actor: AuthenticatedUser,
    content: string,
  ): Promise<IncidentEvent> {
    const event = this.eventsRepo.create({
      incident: { id: incidentId } as any,
      type,
      author: { id: actor.id } as any,
      content,
    });
    return this.eventsRepo.save(event);
  }
}
