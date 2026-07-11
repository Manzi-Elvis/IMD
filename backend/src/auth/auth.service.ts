import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { Role } from '../common/enums/roles.enum';
import { AuditService } from '../audit/audit.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersService.createUser({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: Role.VIEWER, // always VIEWER on self-registration, see auth.dto.ts
    });
    await this.auditService.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.registered',
      entityType: 'user',
      entityId: user.id,
    });
    return this.issueToken(user.id, user.email, user.role);
  }

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    // Same error message whether the email doesn't exist or the password is
    // wrong — avoids leaking which accounts exist (user enumeration).
    const invalidCredentials = () => new UnauthorizedException('Invalid email or password');

    if (!user) throw invalidCredentials();

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      await this.auditService.record({
        actorId: user.id,
        actorEmail: user.email,
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user.id,
        ipAddress,
      });
      throw invalidCredentials();
    }

    await this.auditService.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.login_succeeded',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
    });

    return this.issueToken(user.id, user.email, user.role);
  }

  private issueToken(id: string, email: string, role: Role) {
    // Short-lived (see JwtModule config: 15m) rather than a long-lived
    // session token, because JwtStrategy trusts the role embedded in the
    // token without a fresh DB lookup on every request (see jwt.strategy.ts)
    // — a short TTL bounds how long a just-revoked/downgraded role stays
    // valid.
    const accessToken = this.jwtService.sign({ sub: id, email, role });
    return {
      accessToken,
      user: { id, email, role },
    };
  }
}
