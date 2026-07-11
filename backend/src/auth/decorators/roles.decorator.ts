import { SetMetadata } from '@nestjs/common';
import { Role } from '../../common/enums/roles.enum';

export const ROLES_KEY = 'roles';

// Usage: @Roles(Role.ADMIN, Role.ON_CALL_ENGINEER)
// Attaches required roles as route metadata; RolesGuard reads it and checks
// against req.user.role (populated by JwtAuthGuard, which runs first).
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
