import { Injectable, Logger } from '@nestjs/common';

import { BrowserContext, Page } from 'playwright';

import { BrowserService } from '../../browser/browser.service';

import { JobDto } from '../common/job.dto';

import { JobSource } from '../source/job-source.interface';

import { JobStreetNormalizer } from './jobstreet.normalizer';

import {
  JobStreetDetailPageData,
  JobStreetRawJob,
  JobStreetSearchItem,
} from './jobstreet.types';

@Injectable()
export class JobStreetSource implements JobSource {
  readonly name = 'jobstreet';

  private readonly logger = new Logger(JobStreetSource.name);

  private readonly baseUrl = 'https://my.jobstreet.com';

  private readonly searchUrl =
    'https://my.jobstreet.com/nestjs-jobs/in-Bangkok-Noi-Bangkok-TH?sortmode=ListedDate';

  constructor(
    private readonly browser: BrowserService,

    private readonly normalizer: JobStreetNormalizer,
  ) {}

  async collect(): Promise<JobDto[]> {
    const context = await this.browser.createContext();

    const searchPage = await this.browser.createPage(context);

    try {
      const searchJobs = await this.collectAllSearchPages(searchPage);

      this.logger.log(`Total unique Jobstreet jobs: ${searchJobs.length}`);

      const results: JobDto[] = [];

      for (const searchJob of searchJobs) {
        try {
          const raw = await this.collectJob(context, searchJob);

          results.push(this.normalizer.normalize(raw));

          this.logger.log(`Collected ${searchJob.id}: ${searchJob.title}`);
        } catch (error) {
          this.logger.error(
            `Cannot collect Jobstreet ${searchJob.id}: ${searchJob.title}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      this.logger.log(
        `Completed Jobstreet: ${results.length}/${searchJobs.length}`,
      );

      return results;
    } finally {
      await context.close();
    }
  }
  private async collectAllSearchPages(
    page: Page,
  ): Promise<JobStreetSearchItem[]> {
    const unique = new Map<string, JobStreetSearchItem>();

    let nextUrl: string | undefined = this.searchUrl;

    const visited = new Set<string>();

    let pageNumber = 1;

    while (nextUrl) {
      if (visited.has(nextUrl)) {
        break;
      }

      visited.add(nextUrl);

      this.logger.log(`Opening Jobstreet page ${pageNumber}: ${nextUrl}`);

      const response = await page.goto(nextUrl, {
        waitUntil: 'domcontentloaded',

        timeout: 60_000,
      });

      this.logger.log(`Jobstreet status: ${response?.status()}`);

      this.logger.log(`Jobstreet final URL: ${page.url()}`);

      this.logger.log(`Jobstreet title: ${await page.title()}`);

      /*
       * อย่า wait visible ที่ card ทันที
       *
       * รอ container ก่อน
       */
      await page
        .locator('[data-automation="search-result-job-list"]')
        .waitFor({
          state: 'attached',

          timeout: 20_000,
        })
        .catch(() => undefined);

      /*
       * selector หลัก + fallback
       */
      const selectors = [
        '[data-testid="job-card"][data-job-id]',
        '[data-automation="normalJob"][data-job-id]',
        'article[data-job-id]',
        '[data-automation="jobTitle"]',
      ];

      let foundSelector: string | undefined;

      for (const selector of selectors) {
        const count = await page.locator(selector).count();

        this.logger.debug(`${selector} => ${count}`);

        if (count > 0) {
          foundSelector = selector;

          break;
        }
      }

      /*
       * ยังไม่เจอจริง ๆ
       */
      if (!foundSelector) {
        await this.debugSearchPage(page, pageNumber);

        throw new Error(
          `Jobstreet jobs not found on page ${pageNumber}. Final URL: ${page.url()}`,
        );
      }

      /*
       * ถ้าเจอแค่ title fallback
       * รอให้ DOM render เสร็จอีกนิด
       */
      await page.locator('[data-automation="jobTitle"]').first().waitFor({
        state: 'attached',

        timeout: 10_000,
      });

      const jobs = await this.collectSearchPage(page);

      this.logger.log(`Jobstreet page ${pageNumber}: ${jobs.length} jobs`);

      for (const job of jobs) {
        unique.set(job.id, job);
      }

      const newNextUrl = await this.getNextPageUrl(page);

      if (!newNextUrl || visited.has(newNextUrl)) {
        break;
      }

      nextUrl = newNextUrl;

      pageNumber++;
    }

    return [...unique.values()];
  }
  private async debugSearchPage(page: Page, pageNumber: number): Promise<void> {
    const url = page.url();

    const title = await page.title();

    const bodyText = await page
      .locator('body')
      .innerText()
      .catch(() => '');

    this.logger.error(`Jobstreet debug page=${pageNumber}`);

    this.logger.error(`URL: ${url}`);

    this.logger.error(`TITLE: ${title}`);

    this.logger.error(`BODY: ${bodyText.slice(0, 1500)}`);

    const html = await page.content();

    this.logger.debug(`HTML length: ${html.length}`);
  }
  private async getNextPageUrl(page: Page): Promise<string | undefined> {
    const next = page.locator('a[aria-label="Next"]').first();

    if ((await next.count()) === 0) {
      return undefined;
    }

    const ariaDisabled = await next.getAttribute('aria-disabled');

    if (ariaDisabled === 'true') {
      return undefined;
    }

    const href = await next.getAttribute('href');

    if (!href) {
      return undefined;
    }

    return new URL(href, page.url()).href;
  }
  private async collectSearchPage(
  page: Page,
): Promise<JobStreetSearchItem[]> {
  const cards =
    page.locator(
      'article[data-automation="normalJob"][data-job-id]',
    );

  const count =
    await cards.count();

  this.logger.log(
    `Jobstreet cards in DOM: ${count}`,
  );

  const jobs =
    await cards.evaluateAll(
      elements =>
        elements.map(card => {
          const id =
            card.getAttribute(
              'data-job-id',
            ) ?? '';

          const titleLink =
            card.querySelector(
              '[data-automation="jobTitle"]',
            ) as HTMLAnchorElement | null;

          const title =
            titleLink
              ?.textContent
              ?.trim() ?? '';

          const company =
            card
              .querySelector(
                '[data-automation="jobCompany"]',
              )
              ?.textContent
              ?.trim();

          const location =
            card
              .querySelector(
                '[data-automation="jobLocation"]',
              )
              ?.textContent
              ?.trim();

          const workArrangement =
            card
              .querySelector(
                '[data-testid="work-arrangement"]',
              )
              ?.textContent
              ?.replace(
                /[()]/g,
                '',
              )
              .trim();

          const salary =
            card
              .querySelector(
                '[data-automation="jobSalary"]',
              )
              ?.textContent
              ?.replace(
                /\s+/g,
                ' ',
              )
              .trim();

          const shortDescription =
            card
              .querySelector(
                '[data-automation="jobShortDescription"]',
              )
              ?.textContent
              ?.replace(
                /\s+/g,
                ' ',
              )
              .trim();

          const classification =
            card
              .querySelector(
                '[data-automation="jobClassification"]',
              )
              ?.textContent
              ?.trim();

          const subClassification =
            card
              .querySelector(
                '[data-automation="jobSubClassification"]',
              )
              ?.textContent
              ?.trim();

          /*
           * ใน HTML จริงบาง card เป็น
           *
           * Listed twelve hours ago
           *
           * ไม่จำเป็นต้องมี
           * data-automation="jobListingDate"
           */
          const hiddenTexts =
            Array.from(
              card.querySelectorAll(
                'div',
              ),
            )
              .map(element =>
                element.textContent
                  ?.replace(
                    /\s+/g,
                    ' ',
                  )
                  .trim() ?? '',
              );

          const listedText =
            card
              .querySelector(
                '[data-automation="jobListingDate"]',
              )
              ?.textContent
              ?.trim() ??
            hiddenTexts.find(text =>
              /^Listed\s+/i.test(
                text,
              ),
            );

          const paragraphs =
            Array.from(
              card.querySelectorAll(
                'p',
              ),
            )
              .map(element =>
                element.textContent
                  ?.trim() ?? '',
              );

          const jobTypeText =
            paragraphs.find(value =>
              /^This is a .* job$/i.test(
                value,
              ),
            );

          const jobType =
            jobTypeText
              ?.replace(
                /^This is a\s+/i,
                '',
              )
              .replace(
                /\s+job$/i,
                '',
              )
              .trim();

          const href =
            titleLink
              ?.getAttribute(
                'href',
              );

          return {
            id,

            title,

            company,

            location,

            workArrangement,

            jobType,

            salary,

            shortDescription,

            classification,

            subClassification,

            listedText,

            jobUrl:
              href
                ? new URL(
                    href,
                    'https://th.jobstreet.com',
                  ).href
                : '',
          };
        }),
    );

  return jobs.filter(
    job =>
      Boolean(
        job.id &&
        job.title &&
        job.jobUrl,
      ),
  );
}
  private async collectJob(
    context: BrowserContext,
    searchJob: JobStreetSearchItem,
  ): Promise<JobStreetRawJob> {
    const page = await this.browser.createPage(context);

    try {
      this.logger.log(`Collecting Jobstreet ${searchJob.id}`);

      await page.goto(searchJob.jobUrl, {
        waitUntil: 'domcontentloaded',

        timeout: 60_000,
      });

      /*
       * SEEK มี semantic metric identifier
       * สำหรับ standalone detail
       */
      await page
        .waitForSelector('[data-metrics-identifier="jobDetailsPage"]', {
          timeout: 30_000,
        })
        .catch(() => undefined);

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
  ): Promise<JobStreetDetailPageData> {
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

    const description = await this.text(
      page,
      '[data-automation="jobAdDetails"]',
    );

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

      jobUrl: page.url(),
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
