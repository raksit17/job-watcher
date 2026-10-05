// src/sources/jobthai/jobthai.source.ts

import { Injectable, Logger } from '@nestjs/common';

import { BrowserContext, Page } from 'playwright';

import { BrowserService } from '../../browser/browser.service';

import { Job } from '../../jobs/job/job.interface';

import { JobSource } from '../source/job-source.interface';

import { JobThaiNormalizer } from './jobthai.normalizer';

import {
  JobThaiCompanyPageData,
  JobThaiDetailPageData,
  JobThaiRawJob,
  JobThaiSearchItem,
} from './jobthai.types';
import { JobDto } from '../common/job.dto';

@Injectable()
export class JobThaiSource implements JobSource {
  readonly name = 'jobthai';

  private readonly logger = new Logger(JobThaiSource.name);

  private readonly searchUrl = 'https://www.jobthai.com/th/jobs?keyword=nestjs';

  constructor(
    private readonly browser: BrowserService,
    private readonly normalizer: JobThaiNormalizer,
  ) {}

  /**
   * จุดเริ่มต้นของ JobThai scraper
   */
  async collect(): Promise<JobDto[]> {
    const context = await this.browser.createContext();

    const searchPage = await this.browser.createPage(context);

    try {
      this.logger.log(`Opening JobThai: ${this.searchUrl}`);

      /*
       * STEP 1
       * เปิดหน้า Search
       */
      await searchPage.goto(this.searchUrl, {
        waitUntil: 'domcontentloaded',

        timeout: 30_000,
      });

      await searchPage.waitForSelector(
        'a[id^="job-list-job-"]:not(#job-list-job-on-map)',
      );

      /*
       * STEP 2
       * เก็บรายการงานทั้งหมด
       */
      const searchJobs = await this.collectSearchPage(searchPage);

      this.logger.log(`Found ${searchJobs.length} jobs`);

      /*
       * STEP 3
       * เปิดแต่ละงาน
       */
      const results: JobDto[] = [];

      for (const searchJob of searchJobs) {
        try {
          const raw = await this.collectJob(context, searchJob);

          const normalized = this.normalizer.normalize(raw);

          results.push(normalized);

          this.logger.log(`Collected #${searchJob.id}: ${searchJob.title}`);
        } catch (error) {
          this.logger.error(
            `Cannot collect job #${searchJob.id}: ${searchJob.title}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
      this.logger.log(`Completed: ${results.length}/${searchJobs.length} jobs`);

      return results;
    } finally {
      await context.close();
    }
  }

  /**
   * หน้า Search
   *
   * /th/jobs?keyword=nestjs
   *
   * เก็บ:
   * - id
   * - title
   * - company
   * - location
   * - salary
   * - companyJobUrl
   */
  private async collectSearchPage(page: Page): Promise<JobThaiSearchItem[]> {
    const jobs = await page
      .locator('a[id^="job-list-job-"]:not(#job-list-job-on-map)')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const link = element as HTMLAnchorElement;

          const id = element.id.replace('job-list-job-', '');

          const title =
            element
              .querySelector('h2[id^="job-card-item-"]')
              ?.textContent?.trim() ?? '';

          const company =
            element
              .querySelector('[id^="job-list-company-name-"] h2')
              ?.textContent?.trim() ?? '';

          const location = element
            .querySelector('#location-text')
            ?.textContent?.trim();

          const salary = element
            .querySelector('#salary-text')
            ?.textContent?.trim();

          return {
            id,
            title,
            company,
            location,
            salary,

            companyJobUrl: link.href,
          };
        }),
      );

    /*
     * กันงานซ้ำ
     */
    const uniqueJobs = new Map<string, JobThaiSearchItem>();

    for (const job of jobs) {
      uniqueJobs.set(job.id, job);
    }

    return [...uniqueJobs.values()];
  }

  /**
   * เก็บงาน 1 งานแบบเต็ม
   *
   * Search
   * ↓
   * /company/job/:id
   * ↓
   * กด "ดูรายละเอียดงาน"
   * ↓
   * /job/:id
   */
  private async collectJob(
    context: BrowserContext,
    searchJob: JobThaiSearchItem,
  ): Promise<JobThaiRawJob> {
    const page = await this.browser.createPage(context);

    try {
      this.logger.log(`Collecting job #${searchJob.id}`);

      /*
       * STEP 1
       * เปิดหน้า Company Job
       */
      await page.goto(searchJob.companyJobUrl, {
        waitUntil: 'domcontentloaded',

        timeout: 30_000,
      });

      await page.waitForSelector('#job-title');

      /*
       * STEP 2
       * เก็บข้อมูลหน้า Company Job
       */
      const companyPage = await this.collectCompanyPage(page);

      /*
       * STEP 3
       * กด "ดูรายละเอียดงาน"
       */
      await this.openJobDetail(page);

      /*
       * STEP 4
       * เก็บข้อมูลหน้า Detail
       */
      const detailPage = await this.collectDetailPage(page);

      return {
        search: searchJob,

        companyPage,

        detailPage,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * เก็บหน้า
   *
   * /th/company/job/:id
   */
  private async collectCompanyPage(
    page: Page,
  ): Promise<JobThaiCompanyPageData> {
    return {
      title: await this.text(page, '#job-title'),

      company: await this.text(page, '[id^="company-cover-name-"] h2'),

      postedAt: await this.text(page, '#job-update-at'),

      location: await this.text(page, '#location-text'),

      salary: await this.text(page, '#job-salary'),

      positions: await this.text(page, '#job-number-of-position'),

      onlineInterview:
        (await page.locator('#tag-online-interview').count()) > 0,

      summary: await this.text(page, '#job-detail'),

      benefits: await this.lines(page, '#company-benefit'),

      tags: await this.texts(page, '#tag a'),

      contactName: await this.text(page, '#contact-name'),

      contactCompany: await this.text(page, '#contact-company-name'),

      contactPhone: await this.text(page, '#contact-tel'),

      detailUrl: await this.href(page, 'a[id^="job-detail-"]'),
    };
  }

  /**
   * กดปุ่ม
   *
   * "ดูรายละเอียดงาน"
   *
   * จาก:
   * /th/company/job/:id
   *
   * ไป:
   * /th/job/:id
   */
  private async openJobDetail(page: Page): Promise<void> {
    const detailLink = page.locator('a[id^="job-detail-"]').first();

    await detailLink.waitFor({
      state: 'visible',
      timeout: 30_000,
    });

    const href = await detailLink.getAttribute('href');

    try {
      await Promise.all([
        page.waitForURL(/\/th\/job\/\d+/, {
          timeout: 30_000,
        }),

        detailLink.click(),
      ]);
    } catch (error) {
      if (!href) {
        throw error;
      }

      const detailUrl = new URL(href, page.url()).href;

      this.logger.warn(`Click navigation failed, fallback goto: ${detailUrl}`);

      await page.goto(detailUrl, {
        waitUntil: 'domcontentloaded',

        timeout: 30_000,
      });
    }

    /*
     * อย่ารอ #job-detail อย่างเดียว
     * เพราะบางงานอาจไม่มี element นี้
     */
    await page.waitForSelector('#job-title', {
      timeout: 30_000,
    });

    this.logger.debug(`Detail page loaded: ${page.url()}`);
  }

  /**
   * เก็บหน้า
   *
   * /th/job/:id
   */
  private async collectDetailPage(page: Page): Promise<JobThaiDetailPageData> {
    const requirements = await this.texts(page, '#job-properties-wrapper li');

    const applicationMethods = await this.texts(page, '#job-apply-method li');

    const applicationOptions = await this.texts(
      page,
      [
        '[id^="apply-now-method-"]',
        '[id^="upload-file-method-"]',
        '[id^="email-method-"]',
        '[id^="easy-form-method-"]',
      ].join(','),
    );

    return {
      title: await this.text(page, '#job-title'),

      company: await this.text(page, '[id^="job-detail-com-name-"]'),

      postedAt: await this.text(page, '#job-update-at'),

      location: await this.text(page, '#location-text'),

      workLocation: await this.text(page, '#work-location-2'),

      salary: await this.text(page, '#job-salary'),

      positions: await this.text(page, '#job-number-of-position'),

      onlineInterview:
        (await page.locator('#tag-online-interview').count()) > 0,

      description: await this.text(page, '#job-detail'),

      requirements,

      applicationMethods,

      applicationOptions,

      contactName: await this.text(page, '#contact-name'),

      contactCompany: await this.text(page, '#contact-company-name'),

      phone: await this.text(page, '#contact-tel'),

      email: await this.text(page, 'a.mail'),

      lineId: await this.text(page, '#contact-line'),

      benefitUrl: await this.href(page, 'a[id^="job-detail-see-benefit-"]'),

      detailUrl: page.url(),
    };
  }

  /**
   * เอาข้อความ element เดียว
   */
  private async text(
    page: Page,
    selector: string,
  ): Promise<string | undefined> {
    const locator = page.locator(selector).first();

    if ((await locator.count()) === 0) {
      return undefined;
    }

    const value = await locator.innerText().catch(() => '');

    return value.trim() || undefined;
  }

  /**
   * เอาข้อความหลาย element
   */
  private async texts(page: Page, selector: string): Promise<string[]> {
    const values = await page.locator(selector).allInnerTexts();

    return values.map((value) => value.trim()).filter(Boolean);
  }

  /**
   * แยกข้อความเป็น array
   *
   * เช่น Benefits
   */
  private async lines(page: Page, selector: string): Promise<string[]> {
    const value = await this.text(page, selector);

    if (!value) {
      return [];
    }

    return value
      .split('\n')
      .map((value) => value.replace(/^[-•]\s*/, '').trim())
      .filter(Boolean);
  }

  /**
   * ดึง href แล้วแปลง
   * relative URL → absolute URL
   */
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
