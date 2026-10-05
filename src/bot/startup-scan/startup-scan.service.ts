// src/bot/startup-scan/startup-scan.service.ts

import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  BotRunnerService,
} from '../bot-runner/bot-runner.service';

@Injectable()
export class StartupScanService {
  private readonly logger =
    new Logger(StartupScanService.name);

  constructor(
    private readonly botRunner:
      BotRunnerService,
  ) {}

  async run(): Promise<void> {
    this.logger.log(
      'Running startup job scan...',
    );

    try {
      const jobs =
        await this.botRunner.run();

      this.logger.log(
        `Startup scan completed: ${jobs.length} jobs`,
      );
    } catch (error) {
      this.logger.error(
        'Startup scan failed',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }
  }
}