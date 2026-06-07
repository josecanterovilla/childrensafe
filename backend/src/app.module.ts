import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';

import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccountModule } from './modules/account/account.module';
import { FamiliesModule } from './modules/families/families.module';
import { DevicesModule } from './modules/devices/devices.module';
import { PairingModule } from './modules/pairing/pairing.module';
import { LocationModule } from './modules/location/location.module';
import { GeofencesModule } from './modules/geofences/geofences.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { SosModule } from './modules/sos/sos.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RetentionModule } from './modules/retention/retention.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuditService } from './modules/audit/audit.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    AccountModule,
    FamiliesModule,
    DevicesModule,
    PairingModule,
    LocationModule,
    GeofencesModule,
    AlertsModule,
    SosModule,
    NotificationsModule,
    RealtimeModule,
    RetentionModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector, audit: AuditService) =>
        new AuditInterceptor(reflector, audit),
      inject: [Reflector, AuditService],
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
