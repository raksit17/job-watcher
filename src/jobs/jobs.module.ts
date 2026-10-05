import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { JobRepository } from './job-repository/job-repository.service';

import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

/*
 * Job Import
 */
import { JobImportController } from './import/job-import.controller';
import { JobImportService } from './import/job-import.service';

import { JobImportAdapterRegistry } from './import/adapters/job-import-adapter.registry';

import { LinkedInFeedImportAdapter } from './import/adapters/linkedin/linkedin-feed-import.adapter';

import { GenericJobImportAdapter } from './import/adapters/generic/generic-job-import.adapter';

@Module({
  imports: [
    DatabaseModule,
  ],

  controllers: [
    /*
     * ของเดิม
     */
    JobsController,

    /*
     * POST /api/jobs/import
     */
    JobImportController,
  ],

  providers: [
    /*
     * ของเดิม
     */
    JobsService,
    JobRepository,

    /*
     * Import system
     */
    JobImportService,

    /*
     * Import adapters
     */
    LinkedInFeedImportAdapter,
    GenericJobImportAdapter,

    /*
     * เลือก adapter
     */
    JobImportAdapterRegistry,
  ],

  exports: [
    JobRepository,
    JobsService,

    /*
     * optional
     * เผื่อ module อื่นต้องเรียก import
     */
    JobImportService,
  ],
})
export class JobsModule {}