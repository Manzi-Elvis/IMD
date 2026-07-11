import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marks a route (e.g. POST /auth/login, /auth/register) as not requiring a
// JWT. JwtAuthGuard checks for this metadata before enforcing auth, which
// keeps the guard global-by-default (secure by default) rather than opt-in.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
