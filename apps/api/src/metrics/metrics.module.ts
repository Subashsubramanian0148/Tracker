import { Module } from '@nestjs/common';
import { ScopeService } from '../common/scope.service';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { WorkItemProcessor } from './work-item-processor.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, WorkItemProcessor, ScopeService],
  exports: [MetricsService, WorkItemProcessor, ScopeService],
})
export class MetricsModule {}
