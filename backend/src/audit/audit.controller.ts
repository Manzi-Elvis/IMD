import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { AuditService } from './audit.service';

// Audit logs are sensitive (who did what, when) — restricted to admins only,
// unlike incident data which more roles can read.
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  search(
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    return this.auditService.search({
      action,
      actorId,
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, parseInt(limit, 10) || 25),
    });
  }
}
