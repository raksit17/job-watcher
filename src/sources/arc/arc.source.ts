// src/sources/arc/arc.source.ts

import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  BrowserContext,
  Page,
} from 'playwright';

import {
  BrowserService,
} from '../../browser/browser.service';

import {
  JobDto,
} from '../common/job.dto';

import {
  JobSource,
} from '../source/job-source.interface';

import {
  ArcNormalizer,
} from './arc.normalizer';

import {
  ArcDetailJob,
  ArcRawJob,
  ArcSearchItem,
} from './arc.types';

@Injectable()
export class ArcSource
  implements JobSource
{
  readonly name =
    'arc';

  private readonly logger =
    new Logger(
      ArcSource.name,
    );

  private readonly baseUrl =
    'https://arc.dev';

  private readonly searchUrl =
    'https://arc.dev/remote-jobs/nestjs';

  constructor(
    private readonly browser:
      BrowserService,

    private readonly normalizer:
      ArcNormalizer,
  ) {}
  async collect():
  Promise<JobDto[]>
{
  const context =
    await this.browser.createContext();

  const searchPage =
    await this.browser.createPage(
      context,
    );

  try {
    this.logger.log(
      `Opening Arc: ${this.searchUrl}`,
    );

    await searchPage.goto(
      this.searchUrl,
      {
        waitUntil:
          'domcontentloaded',

        timeout:
          60_000,
      },
    );

    await searchPage.waitForSelector(
      '#__NEXT_DATA__',
      {
        timeout:
          30_000,
      },
    );

    const {
      jobs,
      total,
    } =
      await this.collectSearchData(
        searchPage,
      );

    this.logger.log(
      `Arc exposed ${jobs.length}/${total} jobs`,
    );

    if (
      jobs.length < total
    ) {
      this.logger.warn(
        `Arc public page exposes only ${jobs.length} of ${total} jobs`,
      );
    }

    const results:
      JobDto[] = [];

    for (const searchJob of jobs) {
      try {
        const raw =
          await this.collectJob(
            context,
            searchJob,
          );

        /*
         * ปิดแล้วไม่เอา
         */
        if (
          raw.detail.closed
        ) {
          this.logger.warn(
            `Skip closed Arc job: ${searchJob.randomKey}`,
          );

          continue;
        }

        const normalized =
          this.normalizer.normalize(
            raw,
          );

        results.push(
          normalized,
        );

        this.logger.log(
          `Collected ${searchJob.randomKey}: ${searchJob.title}`,
        );
      } catch (error) {
        this.logger.error(
          `Cannot collect Arc ${searchJob.randomKey}: ${searchJob.title}`,
          error instanceof Error
            ? error.stack
            : String(error),
        );
      }
    }

    this.logger.log(
      `Completed Arc: ${results.length}/${jobs.length}`,
    );

    return results;
  } finally {
    await context.close();
  }
}
private async collectSearchData(
  page: Page,
): Promise<{
  jobs: ArcSearchItem[];
  total: number;
}> {
  const data =
    await page.locator(
      '#__NEXT_DATA__',
    ).textContent();

  if (!data) {
    throw new Error(
      'Arc __NEXT_DATA__ not found',
    );
  }

  const json =
    JSON.parse(
      data,
    );

  const pageProps =
    json?.props?.pageProps;

  if (!pageProps) {
    throw new Error(
      'Arc pageProps not found',
    );
  }

  const externalJobs =
    Array.isArray(
      pageProps.externalJobs,
    )
      ? pageProps.externalJobs
      : [];

  const arcJobs =
    Array.isArray(
      pageProps.arcJobs,
    )
      ? pageProps.arcJobs
      : [];

  /*
   * เผื่อ Arc มี internal job
   * ในอนาคต
   */
  const rawJobs = [
    ...arcJobs,
    ...externalJobs,
  ];

  const unique =
    new Map<
      string,
      ArcSearchItem
    >();

  for (const raw of rawJobs) {
    if (
      !raw.randomKey ||
      !raw.title ||
      !raw.urlString
    ) {
      continue;
    }

    const item:
      ArcSearchItem = {
      randomKey:
        raw.randomKey,

      title:
        raw.title,

      jobType:
        raw.jobType,

      requiredCountries:
        Array.isArray(
          raw.requiredCountries,
        )
          ? raw.requiredCountries
          : [],

      positionType:
        raw.positionType,

      experienceLevels:
        Array.isArray(
          raw.experienceLevels,
        )
          ? raw.experienceLevels
          : [],

      urlString:
        raw.urlString,

      postedAt:
        raw.postedAt,

      company: {
        randomKey:
          raw.company?.randomKey ?? '',

        urlString:
          raw.company?.urlString ?? '',

        name:
          raw.company?.name ?? '',

        logo:
          raw.company?.logo,
      },

      categories:
        Array.isArray(
          raw.categories,
        )
          ? raw.categories
          : [],

      jobUrl:
        `${this.baseUrl}/remote-jobs/j/${raw.urlString}-${raw.randomKey}`,
    };

    unique.set(
      item.randomKey,
      item,
    );
  }

  return {
    jobs:
      [...unique.values()],

    total:
      Number(
        pageProps.totalExternalJobCount ??
        rawJobs.length,
      ),
  };
}
private async collectJob(
  context: BrowserContext,
  searchJob:
    ArcSearchItem,
): Promise<ArcRawJob> {
  const page =
    await this.browser.createPage(
      context,
    );

  try {
    this.logger.log(
      `Collecting Arc ${searchJob.randomKey}`,
    );

    await page.goto(
      searchJob.jobUrl,
      {
        waitUntil:
          'domcontentloaded',

        timeout:
          60_000,
      },
    );

    await page.waitForSelector(
      '#__NEXT_DATA__',
      {
        timeout:
          30_000,
      },
    );

    const detail =
      await this.collectDetailData(
        page,
      );

    return {
      search:
        searchJob,

      detail,
    };
  } finally {
    await page.close();
  }
}
private async collectDetailData(
  page: Page,
): Promise<ArcDetailJob> {
  const data =
    await page.locator(
      '#__NEXT_DATA__',
    ).textContent();

  if (!data) {
    throw new Error(
      'Arc detail __NEXT_DATA__ not found',
    );
  }

  const json =
    JSON.parse(
      data,
    );

  const job =
    json?.props?.pageProps?.job;

  if (!job) {
    throw new Error(
      `Arc detail job not found: ${page.url()}`,
    );
  }

  return {
    randomKey:
      job.randomKey,

    requiredCountries:
      Array.isArray(
        job.requiredCountries,
      )
        ? job.requiredCountries
        : [],

    title:
      job.title,

    companyName:
      job.companyName,

    url:
      job.url,

    urlString:
      job.urlString,

    description:
      job.description,

    experienceLevels:
      Array.isArray(
        job.experienceLevels,
      )
        ? job.experienceLevels
        : [],

    contractType:
      job.contractType,

    usVisaRequired:
      job.usVisaRequired,

    postedAt:
      job.postedAt,

    closed:
      Boolean(
        job.closed,
      ),

    techStackDetails:
      Array.isArray(
        job.techStackDetails,
      )
        ? job.techStackDetails
        : [],

    categories:
      Array.isArray(
        job.categories,
      )
        ? job.categories
        : [],

    company:
      job.company,
  };
}
private async collectDetailFallback(
  page: Page,
) {
  const title =
    await page
      .locator(
        '[role="dialog"] h1.title',
      )
      .first()
      .innerText();

  const company =
    await page
      .locator(
        '[aria-label="dialog-company-header"] .company-name',
      )
      .first()
      .innerText();

  const description =
    await page
      .locator(
        '[aria-label="job-detail-content"]',
      )
      .innerText();

  const applyUrl =
    await page
      .locator(
        '[aria-label="apply-button"]',
      )
      .getAttribute(
        'href',
      );

  return {
    title,
    company,
    description,
    applyUrl,
  };
}
}