import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment } from './entities/attachment.entity';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { IncidentsGateway } from '../websocket/incidents.gateway';
import { IncidentEvent } from '../events/entities/incident-event.entity';
import { IncidentEventType } from '../common/enums/incident.enum';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentsRepo: Repository<Attachment>,
    @InjectRepository(IncidentEvent)
    private readonly eventsRepo: Repository<IncidentEvent>,
    private readonly auditService: AuditService,
    private readonly gateway: IncidentsGateway,
  ) {}

  async saveMetadata(params: {
    incidentId: string;
    originalName: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    uploader: AuthenticatedUser;
  }): Promise<Attachment> {
    const attachment = this.attachmentsRepo.create({
      incident: { id: params.incidentId } as any,
      originalName: params.originalName,
      storageKey: params.storageKey,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      uploadedBy: { id: params.uploader.id } as any,
    });
    const saved = await this.attachmentsRepo.save(attachment);

    // Uploading evidence is itself a timeline event, not a side-channel —
    // so it shows up in the incident's story in the right chronological
    // spot, same as a status change or comment would.
    const event = await this.eventsRepo.save(
      this.eventsRepo.create({
        incident: { id: params.incidentId } as any,
        type: IncidentEventType.ATTACHMENT_ADDED,
        author: { id: params.uploader.id } as any,
        content: `Uploaded ${params.originalName}`,
      }),
    );
    this.gateway.emitNewEvent(params.incidentId, event);

    await this.auditService.record({
      actorId: params.uploader.id,
      actorEmail: params.uploader.email,
      action: 'incident.attachment_uploaded',
      entityType: 'incident',
      entityId: params.incidentId,
      metadata: { fileName: params.originalName, sizeBytes: params.sizeBytes },
    });

    return saved;
  }

  async findOne(id: string): Promise<Attachment> {
    const attachment = await this.attachmentsRepo.findOne({
      where: { id },
      relations: ['incident'],
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  async findForIncident(incidentId: string): Promise<Attachment[]> {
    return this.attachmentsRepo.find({
      where: { incident: { id: incidentId } },
      order: { createdAt: 'DESC' },
    });
  }
}
