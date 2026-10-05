import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';

import {
  Browser,
  BrowserContext,
  Page,
  chromium,
} from 'playwright';

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
}

@Injectable()
export class BrowserService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger =
    new Logger(BrowserService.name);

  private browser: Browser | null = null;

  async onModuleInit(): Promise<void> {
    await this.start();
  }
async createContext(): Promise<BrowserContext> {
    if (!this.browser) {
      await this.start();
    }

    const context =
      await this.browser!.newContext({
        viewport: {
          width: 1440,
          height: 900,
        },

        locale: 'th-TH',

        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/153.0.0.0 Safari/537.36',

        serviceWorkers: 'block',
      });

    return context;
  }async createPage(
  context: BrowserContext,
): Promise<Page> {
  const page =
    await context.newPage();

  page.setDefaultTimeout(
    30_000,
  );

  page.setDefaultNavigationTimeout(
    60_000,
  );

  return page;
}
  async start(): Promise<void> {
    if (this.browser) {
      return;
    }

    this.logger.log(
      'Starting Playwright Chromium...',
    );

    this.browser =
      await chromium.launch({
        headless: true,
      });

    this.logger.log(
      'Chromium started',
    );
  }

  async createSession(): Promise<BrowserSession> {
    if (!this.browser) {
      await this.start();
    }

    const context =
      await this.browser!.newContext({
        viewport: {
          width: 1440,
          height: 900,
        },

        locale: 'en-US',

        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/153.0.0.0 Safari/537.36',

        serviceWorkers: 'block',
      });

    const page =
      await context.newPage();

    page.setDefaultTimeout(
      30_000,
    );

    page.setDefaultNavigationTimeout(
      60_000,
    );

    return {
      context,
      page,
    };
  }

  async closeSession(
    session: BrowserSession,
  ): Promise<void> {
    await session.context.close();
  }

  async close(): Promise<void> {
    if (!this.browser) {
      return;
    }

    this.logger.log(
      'Closing Chromium...',
    );

    await this.browser.close();

    this.browser = null;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}