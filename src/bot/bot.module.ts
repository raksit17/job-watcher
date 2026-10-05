import { Module } from '@nestjs/common';

import { SourcesModule } from '../sources/sources.module';
import { JobsModule } from '../jobs/jobs.module';

import { BotRunnerService } from './bot-runner/bot-runner.service';
import { StartupScanService } from './startup-scan/startup-scan.service';
import { JobSchedulerService } from './job-scheduler/job-scheduler.service';

@Module({
  imports: [
    SourcesModule,
    JobsModule,
  ],

  providers: [
    BotRunnerService,
    StartupScanService,
    JobSchedulerService,
  ],

  exports: [
    BotRunnerService,
    StartupScanService
  ],
})
export class BotModule {}