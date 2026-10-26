import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { ChangeQueueConsumer } from './change-queue.consumer';
import { JobLeaseService } from './job-lease.service';
import { AdminSyncController, WebhookController } from './sync.controller';
import { SyncScheduler } from './sync.scheduler';
import { SyncService } from './sync.service';

@Module({
  imports: [MetricsModule],
  controllers: [AdminSyncController, WebhookController],
  providers: [SyncService, SyncScheduler, ChangeQueueConsumer, JobLeaseService],
  exports: [SyncService, JobLeaseService],
})
export class SyncModule {}
