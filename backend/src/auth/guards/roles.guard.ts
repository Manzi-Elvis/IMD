import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

/**
 * Runs after JwtAuthGuard (order matters — see @UseGuards(JwtAuthGuard,
 * RolesGuard) on controllers). Reads the @Roles(...) metadata off the route
 * and checks it against req.user.role.
 *
 * If a route has no @Roles() decorator at all, this guard allows access —
 * "authenticated" is the default requirement, role restriction is opt-in
 * per-route. That's intentional: most reads (GET incidents, GET timeline)
 * should be available to any authenticated user; only mutating,
 * severity-relevant actions need role checks.
 */
@Injectable()
export class RolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) return false;

    const allowed = requiredRoles.includes(user.role);
    if (!allowed) {
      throw new ForbiddenException(
        `This action requires one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}
