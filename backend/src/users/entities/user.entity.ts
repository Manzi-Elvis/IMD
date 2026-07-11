import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../../common/enums/roles.enum';
import { Incident } from '../../incidents/entities/incident.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  email: string;

  // Never selected by default — see UsersService.findByEmailWithPassword.
  // This stops the hash from silently leaking into any endpoint that returns
  // a User (e.g. `GET /incidents` -> reporter -> would otherwise include it).
  @Column({ select: false })
  passwordHash: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: Role, default: Role.VIEWER })
  role: Role;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Incident, (incident) => incident.reporter)
  reportedIncidents: Incident[];
}
