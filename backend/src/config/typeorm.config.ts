import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { IncidentEvent } from '../events/entities/incident-event.entity';
import { Attachment } from '../attachments/entities/attachment.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

export const typeOrmConfigFactory = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.getOrThrow<string>('DB_HOST'),
  port: config.get<number>('DB_PORT', 5432),
  username: config.getOrThrow<string>('DB_USERNAME'),
  password: config.getOrThrow<string>('DB_PASSWORD'),
  database: config.getOrThrow<string>('DB_NAME'),
  entities: [User, Incident, IncidentEvent, Attachment, AuditLog],
  // Migrations are the source of truth for schema (see database/migrations);
  // synchronize is only ever true in local dev as a convenience, and even
  // then only via explicit env var, never a hardcoded default of true.
  synchronize: config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
  logging: config.get<string>('NODE_ENV') === 'development',
  ssl:
    config.get<string>('DB_SSL', 'false') === 'true'
      ? { rejectUnauthorized: false }
      : false,
});
