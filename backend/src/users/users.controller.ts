import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { UsersService } from './users.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

class SetRoleDto {
  @IsEnum(Role)
  role: Role;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  // Any authenticated user can see the roster (needed for e.g. an
  // "assign owner" dropdown) — no @Roles() here means auth-only.
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  async setRole(
    @Param('id') id: string,
    @Body() dto: SetRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const updated = await this.usersService.setRole(id, dto.role);
    await this.auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'user.role_changed',
      entityType: 'user',
      entityId: id,
      metadata: { newRole: dto.role },
    });
    return updated;
  }
}
