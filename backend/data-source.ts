import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './src/users/entities/user.entity';
import { Incident } from './src/incidents/entities/incident.entity';
import { IncidentEvent } from './src/events/entities/incident-event.entity';
import { Attachment } from './src/attachments/entities/attachment.entity';
import { AuditLog } from './src/audit/entities/audit-log.entity';

config();

// Used only by the `typeorm` CLI (npm run migration:run / :generate / :revert)
// — the running application gets its config through typeOrmConfigFactory
// instead, which reads from ConfigService rather than process.env directly.
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, Incident, IncidentEvent, Attachment, AuditLog],
  migrations: ['src/database/migrations/*.ts'],
});
