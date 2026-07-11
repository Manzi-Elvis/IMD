import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Role } from '../common/enums/roles.enum';
import { IncidentStatus } from '../common/enums/incident.enum';
import { IncidentsService } from './incidents.service';
import {
  AddCommentDto,
  AssignOwnerDto,
  CreateIncidentDto,
  QueryIncidentsDto,
  UpdateSeverityDto,
  UpdateStatusDto,
} from './dto/incident.dto';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  // Any authenticated user can report an incident — the whole point of the
  // tool is a low-friction path from "something's wrong" to a tracked
  // incident, so this isn't role-gated beyond being logged in.
  @Post()
  create(@Body() dto: CreateIncidentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: QueryIncidentsDto) {
    return this.incidentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string) {
    return this.incidentsService.getTimeline(id);
  }

  // Severity classification is restricted to on-call engineers/admins —
  // it drives paging and escalation, so it shouldn't be changeable by an
  // arbitrary reporter.
  @Patch(':id/severity')
  @Roles(Role.ON_CALL_ENGINEER, Role.ADMIN)
  updateSeverity(
    @Param('id') id: string,
    @Body() dto: UpdateSeverityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incidentsService.updateSeverity(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(Role.ON_CALL_ENGINEER, Role.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Instance-level check (is this actor the owner?) on top of the
    // role-level check above — resolving specifically requires ownership,
    // see IncidentsService.assertCanClose for why this can't be a static
    // @Roles() decorator alone.
    if (dto.status === IncidentStatus.RESOLVED) {
      const incident = await this.incidentsService.findOne(id);
      this.incidentsService.assertCanClose(incident, user);
    }
    return this.incidentsService.updateStatus(id, dto, user);
  }

  @Patch(':id/owner')
  @Roles(Role.ON_CALL_ENGINEER, Role.ADMIN)
  assignOwner(
    @Param('id') id: string,
    @Body() dto: AssignOwnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incidentsService.assignOwner(id, dto, user);
  }

  // Comments are open to any authenticated role (RESPONDER included) —
  // triage communication shouldn't be gated the same way state changes are.
  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incidentsService.addComment(id, dto, user);
  }
}
