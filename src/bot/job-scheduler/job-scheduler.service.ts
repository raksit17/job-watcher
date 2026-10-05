// src/bot/job-scheduler/job-scheduler.service.ts

import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  Cron,
} from '@nestjs/schedule';

import {
  BotRunnerService,
} from '../bot-runner/bot-runner.service';

@Injectable()
export class JobSchedulerService {
  private readonly logger =
    new Logger(JobSchedulerService.name);

  constructor(
    private readonly botRunner:
      BotRunnerService,
  ) {}

  /**
   * ทุก 10 นาที
   */
  @Cron('0 */10 * * * *')
  async handleCron(): Promise<void> {
    this.logger.log(
      'Scheduled job scan started',
    );

    try {
      const jobs =
        await this.botRunner.run();

      this.logger.log(
        `Scheduled scan completed: ${jobs.length} jobs`,
      );
    } catch (error) {
      this.logger.error(
        'Scheduled scan failed',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }
  }
}