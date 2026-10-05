// src/sources/techinasia/techinasia.source.ts

import { Injectable, Logger } from '@nestjs/common';

import { BrowserContext, Page } from 'playwright';

import { BrowserService } from '../../browser/browser.service';

import { JobDto } from '../common/job.dto';

import { JobSource } from '../source/job-source.interface';

import { TechInAsiaNormalizer } from './techinasia.normalizer';

import {
  TechInAsiaDetailPageData,
  TechInAsiaRawJob,
  TechInAsiaSearchItem,
} from './techinasia.types';

@Injectable()
export class TechInAsiaSource implements JobSource {
  readonly name = 'techinasia';

  private readonly logger = new Logger(TechInAsiaSource.name);

  private readonly baseUrl = 'https://www.techinasia.com';

  private readonly searchUrl = 'https://www.techinasia.com/jobs/search?query=nestjs';

  private readonly keyword = 'nestjs';

  constructor(
    private readonly browser: BrowserService,

    private readonly normalizer: TechInAsiaNormalizer,
  ) {}
  async collect(): Promise<JobDto[]> {
    const context = await this.browser.createContext();

    const searchPage = await this.browser.createPage(context);

    try {
      this.logger.log(`Opening Tech in Asia: ${this.searchUrl}`);

      await searchPage.goto(this.searchUrl, {
        waitUntil: 'domcontentloaded',

        timeout: 60_000,
      });

      /*
       * Search NestJS
       */
      await this.searchKeyword(searchPage);

      /*
       * Tech in Asia ใช้ infinite scroll
       */
      await this.loadAllResults(searchPage);

      /*
       * Collect card ทั้งหมด
       */
      const searchJobs = await this.collectSearchPage(searchPage);

      this.logger.log(`Tech in Asia found ${searchJobs.length} jobs`);

      const results: JobDto[] = [];

      /*
       * เข้า detail ทีละงาน
       */
      for (const searchJob of searchJobs) {
        try {
          const raw = await this.collectJob(context, searchJob);

          const normalized = this.normalizer.normalize(raw);

          results.push(normalized);

          this.logger.log(`Collected ${searchJob.id}: ${searchJob.title}`);
        } catch (error) {
          this.logger.error(
            `Cannot collect ${searchJob.id}: ${searchJob.title}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      this.logger.log(
        `Completed Tech in Asia: ${results.length}/${searchJobs.length}`,
      );

      return results;
    } finally {
      await context.close();
    }
  }
  private async collectSearchPage(
  page: Page,
): Promise<TechInAsiaSearchItem[]> {
  const jobs =
    await page
      .locator(
        '.search-result-list .job-item',
      )
      .evaluateAll(cards =>
        cards.map(card => {
          const titleLink =
            card.querySelector(
              'h3.job-title a[href^="/jobs/"]',
            ) as HTMLAnchorElement | null;

          const href =
            titleLink
              ?.getAttribute(
                'href',
              ) ?? '';

          const idMatch =
            href.match(
              /^\/jobs\/([a-f0-9-]+)$/i,
            );

          const id =
            idMatch?.[1] ??
            '';

          const title =
            titleLink
              ?.textContent
              ?.trim() ?? '';

          const company =
            card
              .querySelector(
                '.company-name a',
              )
              ?.textContent
              ?.trim();

          const industry =
            card
              .querySelector(
                '.company-name .industry',
              )
              ?.textContent
              ?.trim();

          /*
           * datetime มีเวลาโพสต์จริง
           */
          const postedAt =
            card
              .querySelector(
                'time.job-posted-time',
              )
              ?.getAttribute(
                'datetime',
              ) ?? undefined;

          const details =
            Array.from(
              card.querySelectorAll(
                '.job-details-item',
              ),
            );

          /*
           * Location
           */
          const location =
            details[0]
              ?.querySelector(
                '.label',
              )
              ?.textContent
              ?.trim();

          /*
           * on-site / remote / hybrid
           */
          const workArrangement =
            details[0]
              ?.querySelector(
                '.work-type-badge span',
              )
              ?.textContent
              ?.trim();

          /*
           * Contract / Full-time
           */
          const jobType =
            details[1]
              ?.querySelector(
                '.label',
              )
              ?.textContent
              ?.trim();

          const salary =
            card
              .querySelector(
                '.job-details-item.compensation .label',
              )
              ?.textContent
              ?.trim();

          /*
           * 3-5 YOE
           */
          const experience =
            card
              .querySelector(
                '.job-meta .badge.primary span',
              )
              ?.textContent
              ?.trim();

          /*
           * Software Engineer
           */
          const badges =
            Array.from(
              card.querySelectorAll(
                '.job-footer .job-badges .badge span',
              ),
            );

          const functionName =
            badges[0]
              ?.textContent
              ?.trim();

          return {
            id,

            title,

            company,

            industry,

            location,

            workArrangement,

            jobType,

            salary,

            experience,

            functionName,

            postedAt,

            jobUrl:
              href
                ? new URL(
                    href,
                    'https://www.techinasia.com',
                  ).href
                : '',
          };
        }),
      );

  const unique =
    new Map<
      string,
      TechInAsiaSearchItem
    >();

  for (const job of jobs) {
    if (!job.id) {
      continue;
    }

    if (!job.jobUrl) {
      continue;
    }

    unique.set(
      job.id,
      job,
    );
  }

  return [
    ...unique.values(),
  ];
}
  private async searchKeyword(page: Page): Promise<void> {
    const input = page.locator('#jobs-search-input');

    await input.waitFor({
      state: 'visible',

      timeout: 30_000,
    });

    await input.fill(this.keyword);

    await input.press('Enter');

    /*
     * รอผล search
     */
    await page.waitForFunction(
      (keyword) => {
        const tags = Array.from(document.querySelectorAll('button'));

        return tags.some(
          (element) =>
            element.textContent?.trim().toLowerCase() === keyword.toLowerCase(),
        );
      },
      this.keyword,
      {
        timeout: 30_000,
      },
    );

    await page.waitForSelector('.job-list-section', {
      timeout: 30_000,
    });

    this.logger.log(`Search Tech in Asia: ${this.keyword}`);
  }
  private async loadAllResults(page: Page): Promise<void> {
    const expectedTotal = await this.getExpectedTotal(page);

    this.logger.log(
      expectedTotal !== undefined
        ? `Expected Tech in Asia results: ${expectedTotal}`
        : 'Tech in Asia result count unavailable',
    );

    let previousCount = 0;

    let stableRounds = 0;

    const maxRounds = 30;

    for (let round = 1; round <= maxRounds; round++) {
      const currentCount = await page
        .locator('.search-result-list .job-item')
        .count();

      this.logger.debug(`Infinite scroll ${round}: ${currentCount} jobs`);

      /*
       * ถ้าโหลดครบตาม Showing N results
       */
      if (expectedTotal !== undefined && currentCount >= expectedTotal) {
        break;
      }

      /*
       * จำนวนไม่เพิ่ม
       */
      if (currentCount === previousCount) {
        stableRounds++;
      } else {
        stableRounds = 0;
      }

      /*
       * stable 3 รอบ
       * ถือว่าหมดแล้ว
       */
      if (stableRounds >= 3) {
        break;
      }

      previousCount = currentCount;

      const lastJob = page.locator('.search-result-list .job-item').last();

      if (await lastJob.count()) {
        await lastJob.scrollIntoViewIfNeeded();
      }

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await page.waitForTimeout(1000);
    }

    const finalCount = await page
      .locator('.search-result-list .job-item')
      .count();

    this.logger.log(`Loaded ${finalCount} Tech in Asia jobs`);
  }
  private async getExpectedTotal(page: Page): Promise<number | undefined> {
    const metas = await page
      .locator('.job-list-section .meta .meta-item')
      .allInnerTexts();

    for (const value of metas) {
      const match = value.match(/Showing\s+(\d+)\s+results?/i);

      if (match) {
        return Number(match[1]);
      }
    }

    return undefined;
  }
  private async collectJob(
    context: BrowserContext,
    searchJob: TechInAsiaSearchItem,
  ): Promise<TechInAsiaRawJob> {
    const page = await this.browser.createPage(context);

    try {
      this.logger.log(`Collecting Tech in Asia ${searchJob.id}`);

      await page.goto(searchJob.jobUrl, {
        waitUntil: 'domcontentloaded',

        timeout: 60_000,
      });

      await page.waitForSelector('header[data-cy="page-header"] h1', {
        timeout: 30_000,
      });

      const detail = await this.collectDetailPage(page);

      return {
        search: searchJob,

        detail,
      };
    } finally {
      await page.close();
    }
  }
  private async collectDetailPage(
    page: Page,
  ): Promise<TechInAsiaDetailPageData> {
    const header = page.locator('header[data-cy="page-header"]');

    const title = await this.text(page, 'header[data-cy="page-header"] h1');

    const company = await this.text(
      page,
      'header[data-cy="page-header"] a[href^="/companies/"]',
    );

    const salary = await this.text(
      page,
      'header[data-cy="page-header"] .compensation',
    );

    const createdAt = await this.text(
      page,
      'header[data-cy="page-header"] .dates__created',
    );

    const updatedAt = await this.text(
      page,
      'header[data-cy="page-header"] .dates__updated',
    );

    const functionName = await this.metaValue(page, 'Function:');

    const jobType = await this.metaValue(page, 'Type:');

    const experience = await this.metaValue(page, 'Experience:');

    const vacancies = await this.metaValue(page, 'Vacancies:');

    const descriptionData = await this.collectDescription(page);

    const skills = await this.collectSkills(page);

    const applyUrl = await this.href(page, '[data-cy="apply-job-btn"]');

    return {
      title,

      company,

      salary,

      functionName,

      jobType,

      experience,

      vacancies,

      createdAt,

      updatedAt,

      description: descriptionData.fullText,

      responsibilities: descriptionData.responsibilities,

      requirements: descriptionData.requirements,

      skills,

      applyUrl,

      jobUrl: page.url(),
    };
  }
  private async metaValue(
    page: Page,
    label: string,
  ): Promise<string | undefined> {
    return page.evaluate((labelText) => {
      const header = document.querySelector('header[data-cy="page-header"]');

      if (!header) {
        return undefined;
      }

      const divs = Array.from(header.querySelectorAll('div'));

      const target = divs.find((element) => {
        const text = element.textContent?.replace(/\s+/g, ' ').trim();

        return text?.startsWith(labelText) && element.querySelector('b');
      });

      return (
        target?.querySelector('b')?.textContent?.replace(/\s+/g, ' ').trim() ||
        undefined
      );
    }, label);
  }
  private async collectDescription(page: Page): Promise<{
    fullText?: string;
    requirements: string[];
    responsibilities: string[];
  }> {
    return page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('section'));

      const section = sections.find((element) =>
        element
          .querySelector('h2')
          ?.textContent?.trim()
          .toLowerCase()
          .includes('job description'),
      );

      if (!section) {
        return {
          fullText: undefined,

          requirements: [],

          responsibilities: [],
        };
      }

      const clean = (value: string) =>
        value
          .replace(/^[•●\-–]\s*/, '')
          .replace(/\s+/g, ' ')
          .trim();

      const fullText = section.textContent?.replace(/\s+/g, ' ').trim();

      const requirements: string[] = [];

      const responsibilities: string[] = [];

      let mode: 'requirements' | 'responsibilities' | undefined;

      const elements = Array.from(section.querySelectorAll('p, li'));

      for (const element of elements) {
        const raw = element.textContent?.trim();

        if (!raw) {
          continue;
        }

        const normalized = raw.toLowerCase();

        if (normalized.includes('requirements:') && raw.length < 100) {
          mode = 'requirements';

          continue;
        }

        if (
          (normalized.includes('work responsibilities:') ||
            normalized === 'responsibilities:') &&
          raw.length < 100
        ) {
          mode = 'responsibilities';

          continue;
        }

        const value = clean(raw);

        if (!value) {
          continue;
        }

        if (mode === 'requirements') {
          requirements.push(value);
        }

        if (mode === 'responsibilities') {
          responsibilities.push(value);
        }
      }

      return {
        fullText,

        requirements,

        responsibilities,
      };
    });
  }
  private async collectSkills(page: Page): Promise<string[]> {
    return page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('section'));

      const section = sections.find(
        (element) =>
          element.querySelector('h2')?.textContent?.trim().toLowerCase() ===
          'required skills',
      );

      if (!section) {
        return [];
      }

      return Array.from(section.querySelectorAll('[data-cy="tag"]'))
        .map(
          (element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        )
        .filter(Boolean);
    });
  }
  private async text(
    page: Page,
    selector: string,
  ): Promise<string | undefined> {
    const locator = page.locator(selector).first();

    if ((await locator.count()) === 0) {
      return undefined;
    }

    const value = await locator.innerText().catch(() => '');

    return value.replace(/\s+/g, ' ').trim() || undefined;
  }

  private async href(
    page: Page,
    selector: string,
  ): Promise<string | undefined> {
    const locator = page.locator(selector).first();

    if ((await locator.count()) === 0) {
      return undefined;
    }

    const href = await locator.getAttribute('href');

    if (!href) {
      return undefined;
    }

    return new URL(href, page.url()).href;
  }
}
