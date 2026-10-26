import { Module } from '@nestjs/common';
import { DelayCategoriesController, DelaysController } from '../delays/delays.controller';
import { DelaysService } from '../delays/delays.service';
import { MetricsModule } from '../metrics/metrics.module';
import { ProjectsController } from '../projects/projects.controller';
import { WorkItemsController } from './work-items.controller';
import { WorkItemsService } from './work-items.service';

@Module({
  imports: [MetricsModule],
  controllers: [ProjectsController, WorkItemsController, DelaysController, DelayCategoriesController],
  providers: [WorkItemsService, DelaysService],
})
export class WorkItemsModule {}
