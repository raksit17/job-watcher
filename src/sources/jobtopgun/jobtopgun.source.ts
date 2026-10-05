// src/sources/jobtopgun/jobtopgun.source.ts

import { Injectable, Logger } from '@nestjs/common';

import { BrowserContext, Page } from 'playwright';

import { BrowserService } from '../../browser/browser.service';

import { JobDto } from '../common/job.dto';

import { JobSource } from '../source/job-source.interface';

import { JobTopGunNormalizer } from './jobtopgun.normalizer';

import {
  JobTopGunDetailPageData,
  JobTopGunRawJob,
  JobTopGunSearchItem,
} from './jobtopgun.types';

@Injectable()
export class JobTopGunSource implements JobSource {
  readonly name = 'jobtopgun';

  private readonly logger = new Logger(JobTopGunSource.name);

  private readonly searchUrl =
    'https://www.jobtopgun.com/th/jobs/nestjs-nodejs-jobs-in-it-technology';

  constructor(
    private readonly browser: BrowserService,

    private readonly normalizer: JobTopGunNormalizer,
  ) {}
  async collect(): Promise<JobDto[]> {
    const context = await this.browser.createContext();

    const searchPage = await this.browser.createPage(context);

    try {
      /*
       * STEP 1
       * เปิดหน้าแรก
       */
      await this.openSearchPage(searchPage, 1);

      /*
       * STEP 2
       * หา total pages
       */
      const totalPages = await this.getTotalPages(searchPage);

      this.logger.log(`JobTopGun total pages: ${totalPages}`);

      /*
       * STEP 3
       * เก็บงานทุกหน้า
       */
      const allSearchJobs = new Map<string, JobTopGunSearchItem>();

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        if (pageNumber > 1) {
          await this.openSearchPage(searchPage, pageNumber);
        }

        const pageJobs = await this.collectSearchPage(searchPage);

        this.logger.log(
          `Page ${pageNumber}/${totalPages}: ${pageJobs.length} jobs`,
        );

        for (const job of pageJobs) {
          allSearchJobs.set(job.id, job);
        }
      }

      const searchJobs = [...allSearchJobs.values()];

      this.logger.log(`Total unique JobTopGun jobs: ${searchJobs.length}`);

      /*
       * STEP 4
       * เปิด detail ทุกงาน
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
            `Cannot collect ${searchJob.id}: ${searchJob.title}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      this.logger.log(
        `Completed JobTopGun: ${results.length}/${searchJobs.length}`,
      );

      return results;
    } finally {
      await context.close();
    }
  }
  private async openSearchPage(page: Page, pageNumber: number): Promise<void> {
    const url = new URL(this.searchUrl);

    if (pageNumber > 1) {
      url.searchParams.set('page', String(pageNumber));
    }

    this.logger.log(`Opening JobTopGun page ${pageNumber}: ${url.href}`);

    await page.goto(url.href, {
      waitUntil: 'domcontentloaded',

      timeout: 60_000,
    });

    await page.waitForSelector('aside article a[href^="/th/jobs/j"]', {
      timeout: 30_000,
    });
  }
  private async getTotalPages(page: Page): Promise<number> {
    /*
     * ตัวอย่าง:
     *
     * แสดง 1 - 30 จาก 86
     */
    const asideText = await page.locator('aside').innerText();

    const summaryMatch = asideText.match(
      /แสดง\s*(\d+)\s*-\s*(\d+)\s*จาก\s*(\d+)/,
    );

    if (summaryMatch) {
      const start = Number(summaryMatch[1]);

      const end = Number(summaryMatch[2]);

      const total = Number(summaryMatch[3]);

      const pageSize = end - start + 1;

      if (pageSize > 0 && total > 0) {
        return Math.ceil(total / pageSize);
      }
    }

    /*
     * fallback:
     * อ่าน ?page=x จาก pagination
     */
    const pageNumbers = await page
      .locator('aside a[href*="?page="]')
      .evaluateAll((elements) =>
        elements
          .map((element) => {
            const link = element as HTMLAnchorElement;

            const url = new URL(link.href);

            return Number(url.searchParams.get('page'));
          })
          .filter((value) => Number.isFinite(value)),
      );

    return Math.max(1, ...pageNumbers);
  }
  private async collectSearchPage(page: Page): Promise<JobTopGunSearchItem[]> {
    const jobs = await page
      .locator('aside article:has(a[href^="/th/jobs/j"])')
      .evaluateAll((articles) =>
        articles.map((article) => {
          const jobLink = article.querySelector(
            'h2 a[href^="/th/jobs/j"]',
          ) as HTMLAnchorElement | null;

          const fallbackLink = article.querySelector(
            'a[href^="/th/jobs/j"]',
          ) as HTMLAnchorElement | null;

          const link = jobLink ?? fallbackLink;

          const href = link?.getAttribute('href') ?? '';

          /*
           * /th/jobs/j262203-27
           *
           * externalId:
           * j262203-27
           */
          const idMatch = href.match(/\/th\/jobs\/(j\d+-\d+)/);

          const id = idMatch?.[1] ?? '';

          const title = jobLink?.textContent?.trim() ?? '';

          const company = article
            .querySelector('a[href*="/companies/company-c"]')
            ?.textContent?.trim();

          const location = article
            .querySelector('a[href^="/th/jobs/in-"]')
            ?.textContent?.trim();

          const postedAt =
            article.querySelector('time')?.getAttribute('datetime') ??
            undefined;

          const highlights = Array.from(article.querySelectorAll('ul li'))
            .map((element) => element.textContent?.trim() ?? '')
            .filter(Boolean);

          /*
           * salary ไม่มี attribute เฉพาะ
           * จึงเลือกจากข้อความ
           */
          const texts = Array.from(article.querySelectorAll('span')).map(
            (element) => element.textContent?.trim() ?? '',
          );

          const salary = texts.find((text) =>
            /บาท|ขึ้นอยู่กับคุณสมบัติ|ตามตกลง/i.test(text),
          );

          /*
           * job type
           */
          const articleText = article.textContent ?? '';

          let jobType: string | undefined;

          const jobTypes = [
            'งานประจำ',
            'งานพาร์ทไทม์',
            'งานตามสัญญาจ้าง',
            'งานตามสัญญาจ้าง รายเดือน/รายปี',
          ];

          jobType = jobTypes.find((type) => articleText.includes(type));

          return {
            id,

            title,

            company,

            location,

            jobType,

            salary,

            highlights,

            postedAt,

            jobUrl: href
              ? new URL(
                  href,
                  location
                    ? 'https://www.jobtopgun.com'
                    : 'https://www.jobtopgun.com',
                ).href
              : '',
          };
        }),
      );

    const unique = new Map<string, JobTopGunSearchItem>();

    for (const job of jobs) {
      if (!job.id) {
        continue;
      }

      if (!job.jobUrl) {
        continue;
      }

      unique.set(job.id, job);
    }

    return [...unique.values()];
  }
  private async collectJob(
    context: BrowserContext,
    searchJob: JobTopGunSearchItem,
  ): Promise<JobTopGunRawJob> {
    const page = await this.browser.createPage(context);

    try {
      this.logger.log(`Collecting JobTopGun #${searchJob.id}`);

      await page.goto(searchJob.jobUrl, {
        waitUntil: 'domcontentloaded',

        timeout: 60_000,
      });

      /*
       * รอ title หลัก
       */
      await page
        .locator('.topgun-title-2.font-semibold.text-neutral-900')
        .first()
        .waitFor({
          state: 'visible',

          timeout: 30_000,
        });

      const detail = await this.collectDetailPage(page, searchJob);

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
    searchJob: JobTopGunSearchItem,
  ): Promise<JobTopGunDetailPageData> {
    const title = await this.text(
      page,
      '.topgun-title-2.font-semibold.text-neutral-900',
    );

    /*
     * company link
     */
    const company = await this.text(
      page,
      'a[href*="/companies/"] .topgun-title-2',
    );

    const location = await this.text(page, 'a[href^="/th/jobs/in-"]');

    const jobType = await this.text(page, 'a[href*="jobType="]');

    /*
     * detail sections
     */
    const overview = await this.sectionText(page, 'ภาพรวมของงาน');

    const responsibilities = await this.sectionLines(
      page,
      'หน้าที่และความรับผิดชอบ',
    );

    const qualifications = await this.sectionLines(page, 'คุณสมบัติ');

    const benefits = await this.sectionLines(page, 'สวัสดิการ');

    const salary = await this.findMatchingText(
      page,
      /บาท|ขึ้นอยู่กับคุณสมบัติ|ตามตกลง/i,
    );

    return {
      title: title ?? searchJob.title,

      company: company ?? searchJob.company,

      location: location ?? searchJob.location,

      jobType: jobType ?? searchJob.jobType,

      salary: salary ?? searchJob.salary,

      overview,

      responsibilities,

      qualifications,

      benefits,

      jobUrl: page.url(),
    };
  }
  private async sectionText(
    page: Page,
    heading: string,
  ): Promise<string | undefined> {
    return page.evaluate((label) => {
      const elements = Array.from(
        document.querySelectorAll('span, p, h1, h2, h3, h4'),
      );

      const headingElement = elements.find(
        (element) => element.textContent?.trim() === label,
      );

      if (!headingElement) {
        return undefined;
      }

      let parent: HTMLElement | null = headingElement.parentElement;

      for (let depth = 0; depth < 4 && parent; depth++) {
        const prose = parent.querySelector(
          '.prose-content',
        ) as HTMLElement | null;

        if (prose) {
          const text = prose.innerText.trim();

          if (text) {
            return text;
          }
        }

        parent = parent.parentElement;
      }

      return undefined;
    }, heading);
  }
  private async sectionLines(page: Page, heading: string): Promise<string[]> {
    return page.evaluate((label) => {
      const elements = Array.from(
        document.querySelectorAll('span, p, h1, h2, h3, h4'),
      );

      const headingElement = elements.find(
        (element) => element.textContent?.trim() === label,
      );

      if (!headingElement) {
        return [];
      }

      let parent: HTMLElement | null = headingElement.parentElement;

      for (let depth = 0; depth < 4 && parent; depth++) {
        const items = Array.from(parent.querySelectorAll('li'))
          .map(
            (element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          )
          .filter(Boolean);

        if (items.length > 0) {
          return items;
        }

        /*
         * บาง section ไม่มี li
         */
        const prose = parent.querySelector(
          '.prose-content',
        ) as HTMLElement | null;

        if (prose) {
          const text = prose.innerText.trim();

          if (text) {
            return text
              .split('\n')
              .map((value) => value.trim())
              .filter(Boolean);
          }
        }

        parent = parent.parentElement;
      }

      return [];
    }, heading);
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

  private async findMatchingText(
    page: Page,
    regex: RegExp,
  ): Promise<string | undefined> {
    const values = await page.locator('span').allInnerTexts();

    return values
      .map((value) => value.replace(/\s+/g, ' ').trim())
      .find((value) => regex.test(value));
  }
}
