import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IncidentSeverity, IncidentStatus } from '../../common/enums/incident.enum';

export class CreateIncidentDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(1)
  description: string;

  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;
}

export class UpdateStatusDto {
  @IsEnum(IncidentStatus)
  status: IncidentStatus;
}

export class UpdateSeverityDto {
  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;
}

export class AssignOwnerDto {
  @IsUUID()
  ownerId: string;
}

export class AddCommentDto {
  @IsString()
  @MinLength(1)
  content: string;
}

// Query params for the list endpoint — filtering, search, and pagination
// all live on one DTO so validation/coercion happens in one place.
export class QueryIncidentsDto {
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  // Free-text search against title/description via Postgres full-text search
  // (see IncidentsService.findAll) rather than ILIKE, so it scales and ranks
  // by relevance instead of just substring matching.
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
