// src/bot/bot-runner/bot-runner.service.ts

import { Injectable, Logger } from '@nestjs/common';

import { Job } from '../../jobs/job/job.interface';

import { SourceRegistryService } from '../../sources/source-registry/source-registry.service';
import { JobDto } from 'src/sources/common/job.dto';
import { JobRepository } from 'src/jobs/job-repository/job-repository.service';

@Injectable()
export class BotRunnerService {
  private readonly logger = new Logger(BotRunnerService.name);

  private running = false;

  constructor(
    private readonly sourceRegistry: SourceRegistryService,
    private readonly jobRepository: JobRepository,
  ) {}

  async run(): Promise<JobDto[]> {
    /*
     * ป้องกัน scheduler ยิงซ้ำ
     * ขณะที่รอบเก่ายังไม่จบ
     */
    if (this.running) {
      this.logger.warn('Bot is already running. Skip this run.');

      return [];
    }

    this.running = true;

    const startedAt = Date.now();

    this.logger.log('================================');

    this.logger.log('Job bot started');

    try {
      const sources = this.sourceRegistry.getAll();

      this.logger.log(`Sources: ${sources.length}`);

      const allJobs: JobDto[] = [];

      for (const source of sources) {
        try {
          this.logger.log(`Running source: ${source.name}`);

          const jobs = await source.collect();

          this.logger.log(`${source.name}: ${jobs.length} jobs`);

          allJobs.push(...jobs);
        } catch (error) {
          this.logger.error(
            `Source failed: ${source.name}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
      await this.jobRepository.upsertMany(allJobs);
      this.logger.log(`Total jobs collected: ${allJobs.length}`);

      return allJobs;
    } finally {
      const duration = Date.now() - startedAt;

      this.logger.log(`Bot finished in ${duration}ms`);

      this.logger.log('================================');

      this.running = false;
    }
  }
}
