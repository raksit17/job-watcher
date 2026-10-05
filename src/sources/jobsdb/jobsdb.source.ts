// src/sources/jobsdb/jobsdb.source.ts

import { Injectable, Logger } from '@nestjs/common';

import { BrowserContext, Page } from 'playwright';

import { BrowserService } from '../../browser/browser.service';

import { JobDto } from '../common/job.dto';

import { JobSource } from '../source/job-source.interface';

import { JobsDbNormalizer } from './jobsdb.normalizer';

import {
  JobsDbDetailPageData,
  JobsDbRawJob,
  JobsDbSearchItem,
} from './jobsdb.types';

@Injectable()
export class JobsDbSource implements JobSource {
  readonly name = 'jobsdb';

  private readonly logger = new Logger(JobsDbSource.name);

  private readonly searchUrl = 'https://th.jobsdb.com/nestjs-jobs/in-Thailand';

  constructor(
    private readonly browser: BrowserService,

    private readonly normalizer: JobsDbNormalizer,
  ) {}

  async collect(): Promise<JobDto[]> {
    const context = await this.browser.createContext();

    const searchPage = await this.browser.createPage(context);

    try {
      this.logger.log(`Opening JobsDB: ${this.searchUrl}`);

      await searchPage.goto(this.searchUrl, {
        waitUntil: 'domcontentloaded',

        timeout: 60_000,
      });

      await searchPage.waitForSelector(
        '[data-testid="job-card"][data-job-id]',
        {
          timeout: 30_000,
        },
      );

      const searchJobs = await this.collectSearchPage(searchPage);

      this.logger.log(`Found ${searchJobs.length} jobs`);

      const results: JobDto[] = [];

      for (const searchJob of searchJobs) {
        try {
          const raw = await this.collectJob(context, searchJob);

          const normalized = this.normalizer.normalize(raw);

          results.push(normalized);

          this.logger.log(`Collected #${searchJob.id}: ${searchJob.title}`);
        } catch (error) {
          this.logger.error(
            `Cannot collect JobsDB #${searchJob.id}: ${searchJob.title}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      this.logger.log(
        `Completed JobsDB: ${results.length}/${searchJobs.length}`,
      );

      return results;
    } finally {
      await context.close();
    }
  }
  private async collectSearchPage(page: Page): Promise<JobsDbSearchItem[]> {
    const jobs = await page
      .locator('[data-testid="job-card"][data-job-id]')
      .evaluateAll((cards) =>
        cards.map((card) => {
          const id = card.getAttribute('data-job-id') ?? '';

          const titleElement = card.querySelector(
            '[data-automation="jobTitle"]',
          ) as HTMLAnchorElement | null;

          const title = titleElement?.textContent?.trim() ?? '';

          const company = card
            .querySelector('[data-automation="jobCompany"]')
            ?.textContent?.trim();

          const location = card
            .querySelector('[data-automation="jobLocation"]')
            ?.textContent?.trim();

          const salary = card
            .querySelector('[data-automation="jobSalary"]')
            ?.textContent?.trim();

          const workArrangement = card
            .querySelector('[data-testid="work-arrangement"]')
            ?.textContent?.trim();

          const shortDescription = card
            .querySelector('[data-automation="jobShortDescription"]')
            ?.textContent?.trim();

          const classification = card
            .querySelector('[data-automation="jobClassification"]')
            ?.textContent?.trim();

          const subClassification = card
            .querySelector('[data-automation="jobSubClassification"]')
            ?.textContent?.trim();

          const listedText = card
            .querySelector('[data-automation="jobListingDate"]')
            ?.textContent?.trim();

          /*
           * ใช้ canonical URL
           * ไม่เอา tracking:
           *
           * ?type=
           * &ref=
           * #sol=
           */
          const jobUrl = id
            ? `https://th.jobsdb.com/th/job/${id}`
            : (titleElement?.href ?? '');

          return {
            id,
            title,

            company,
            location,
            salary,

            workArrangement,

            shortDescription,

            classification,
            subClassification,

            listedText,

            jobUrl,
          };
        }),
      );

    /*
     * กัน card แปลก / duplicate
     */
    const unique = new Map<string, JobsDbSearchItem>();

    for (const job of jobs) {
      if (!/^\d+$/.test(job.id)) {
        continue;
      }

      unique.set(job.id, job);
    }

    return [...unique.values()];
  }
  private async collectJob(
    context: BrowserContext,
    searchJob: JobsDbSearchItem,
  ): Promise<JobsDbRawJob> {
    if (!/^\d+$/.test(searchJob.id)) {
      throw new Error(`Invalid JobsDB id: ${searchJob.id}`);
    }

    const page = await this.browser.createPage(context);

    try {
      this.logger.log(`Collecting JobsDB #${searchJob.id}`);

      await page.goto(searchJob.jobUrl, {
        waitUntil: 'domcontentloaded',

        timeout: 60_000,
      });

      await page.waitForSelector('[data-automation="job-detail-title"]', {
        timeout: 30_000,
      });

      const detail = await this.collectDetailPage(page, searchJob.id);

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
    jobId: string,
  ): Promise<JobsDbDetailPageData> {
    const title = await this.text(page, '[data-automation="job-detail-title"]');

    const company = await this.text(
      page,
      '[data-automation="advertiser-name"]',
    );

    const location = await this.text(
      page,
      '[data-automation="job-detail-location"]',
    );

    const classification = await this.text(
      page,
      '[data-automation="job-detail-classifications"]',
    );

    const workType = await this.text(
      page,
      '[data-automation="job-detail-work-type"]',
    );

    const salary = await this.text(
      page,
      '[data-automation="job-detail-salary"]',
    );

    /*
     * รายละเอียดงานทั้งหมด
     */
    const description = await this.text(
      page,
      '[data-automation="jobAdDetails"]',
    );

    /*
     * เก็บ bullet ทั้งหมดในรายละเอียด
     *
     * Responsibilities
     * Qualifications
     * Requirements
     * Benefits
     * ฯลฯ
     */
    const bullets = await this.texts(
      page,
      '[data-automation="jobAdDetails"] li',
    );

    const applyUrl = await this.href(
      page,
      '[data-automation="job-detail-apply"]',
    );

    return {
      title,
      company,

      location,

      classification,

      workType,

      salary,

      description,

      bullets,

      applyUrl,

      jobUrl: `https://th.jobsdb.com/th/job/${jobId}`,
    };
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

  private async texts(page: Page, selector: string): Promise<string[]> {
    const values = await page.locator(selector).allInnerTexts();

    return values
      .map((value) => value.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
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
