import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IncidentsGateway } from './incidents.gateway';

// Standalone module so both IncidentsModule and AttachmentsModule can
// broadcast updates without importing each other.
//
// JwtModule must be configured with the same secret AuthModule uses —
// IncidentsGateway.handleConnection calls jwtService.verify(token), which
// throws if no secret is registered on this module's JwtService instance.
// (Nest's DI gives each module its own JwtService when JwtModule is
// registered separately, so this can't just rely on AuthModule having
// configured it elsewhere.)
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [IncidentsGateway],
  exports: [IncidentsGateway],
})
export class WebsocketModule {}
