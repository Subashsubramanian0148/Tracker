import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AdminAuditController } from './admin/admin-audit.controller';
import { AdoModule } from './ado/ado.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CsrfGuard, RolesGuard, SessionAuthGuard } from './common/guards';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { APP_CONFIG, type AppConfig } from './config/config';
import { ConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RetentionService } from './retention/retention.service';
import { SyncModule } from './sync/sync.module';
// Tasks mode is parked; the module, tables and data stay. Uncomment (and set TASKS_ENABLED in
// apps/web/src/lib/features.ts) to bring it back.
// import { TasksModule } from './tasks/tasks.module';
import { WorkItemsModule } from './work-items/work-items.module';

/** pino-pretty is a dev dependency: the container image (even in local compose) logs JSON. */
function hasPrettyLogger(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.LOG_LEVEL,
          // The id is assigned (and validated) by the correlation middleware in http-security.ts.
          genReqId: (req: IncomingMessage) => (typeof req.id === 'string' ? req.id : randomUUID()),
          redact: {
            paths: [
              'req.headers.cookie',
              'req.headers.authorization',
              'req.headers["x-csrf-token"]',
              'res.headers["set-cookie"]',
            ],
            censor: '[redacted]',
          },
          customProps: (req: IncomingMessage) => ({
            userId: (req as IncomingMessage & { session?: { user?: { id: string } } }).session?.user?.id,
          }),
          autoLogging: { ignore: (req: IncomingMessage) => req.url?.startsWith('/api/health') ?? false },
          ...(!config.isProduction && hasPrettyLogger()
            ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
            : {}),
        },
      }),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AdoModule,
    AuthModule,
    SyncModule,
    // TasksModule,
    WorkItemsModule,
  ],
  controllers: [HealthController, AdminAuditController],
  providers: [
    RetentionService,
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    // Order matters: rate limit → authenticate → CSRF → authorise.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
