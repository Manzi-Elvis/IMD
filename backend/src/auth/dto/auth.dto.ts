import { IsEmail, IsString, MinLength } from 'class-validator';

// Deliberately no `role` field: public self-registration always lands as
// VIEWER (enforced in AuthService.register). Granting ON_CALL_ENGINEER or
// ADMIN is a separate, admin-only action (UsersController.setRole) — so
// there's no field here for a client to smuggle a role through.
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  name: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
