import { Injectable, Logger } from '@nestjs/common';

import { Page } from 'playwright';

import { BrowserService } from '../../browser/browser.service';

import { JobDto } from '../common/job.dto';

import { JobSource } from '../source/job-source.interface';

import { WellfoundFilter } from './wellfound.filter';

import { WellfoundNormalizer } from './wellfound.normalizer';

import { WellfoundRawJob, WellfoundSearchJob } from './wellfound.types';

@Injectable()
export class WellfoundSource implements JobSource {
  readonly name = 'wellfound';

  private readonly logger = new Logger(WellfoundSource.name);

  private readonly baseUrl = 'https://wellfound.com';

  /*
   * เอา Software Engineer กว้าง ๆ
   *
   * แล้ว filter Node/Nest เอง
   */
  private readonly searchUrls = [
    'https://wellfound.com/role/r/software-engineer',
    'https://wellfound.com/role/r/backend-engineer',
    'https://wellfound.com/role/r/full-stack-engineer',
    
  ];
  private readonly searches = [
  {
    role: 'software-engineer',
    url: 'https://wellfound.com/role/r/software-engineer',
  },
  {
    role: 'backend-engineer',
    url: 'https://wellfound.com/role/r/backend-engineer',
  },
  {
    role: 'full-stack-engineer',
    url: 'https://wellfound.com/role/r/full-stack-engineer',
  },
];

  constructor(
    private readonly browser: BrowserService,

    private readonly filter: WellfoundFilter,

    private readonly normalizer: WellfoundNormalizer,
  ) {}

async collect(): Promise<JobDto[]> {
  const results = await Promise.all(
    this.searches.map((search) =>
      this.collectSearch(search.role, search.url),
    ),
  );

  const accepted = new Map<string, WellfoundRawJob>();

  for (const jobs of results) {
    for (const job of jobs) {
      accepted.set(job.search.id, job);
    }
  }

  this.logger.log(
    `Wellfound total accepted after dedupe: ${accepted.size} jobs`,
  );

  return [...accepted.values()].map((raw) =>
    this.normalizer.normalize(raw),
  );
}
private async collectSearch(
  role: string,
  searchUrl: string,
): Promise<WellfoundRawJob[]> {
  const context = await this.browser.createContext();

  const page = await this.browser.createPage(context);

  try {
    /*
     * Page 1
     */
    const first = await this.collectPage(
      page,
      searchUrl,
      1,
    );

    this.logger.log(
      `[${role}] Wellfound total pages: ${first.pageCount}`,
    );

    this.logger.log(
      `[${role}] Wellfound total jobs: ${first.totalJobCount}`,
    );

    const accepted = new Map<string, WellfoundRawJob>();

    this.filterJobs(first.jobs, accepted);

    /*
     * Page 2 -> N
     */
    for (
      let pageNumber = 2;
      pageNumber <= first.pageCount;
      pageNumber++
    ) {
      const result = await this.collectPage(
        page,
        searchUrl,
        pageNumber,
      );

      this.filterJobs(result.jobs, accepted);
    }

    this.logger.log(
      `[${role}] Wellfound accepted: ${accepted.size} jobs`,
    );

    return [...accepted.values()];
  } finally {
    await context.close();
  }
}

 private async collectPage(
  page: Page,
  searchUrl: string,
  pageNumber: number,
): Promise<{
  jobs: WellfoundSearchJob[];
  pageCount: number;
  totalJobCount: number;
}> {
  const url =
    pageNumber === 1
      ? searchUrl
      : `${searchUrl}?page=${pageNumber}`;

  this.logger.log(
    `Opening Wellfound page ${pageNumber}: ${url}`,
  );

  const response = await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  if (!response || !response.ok()) {
    throw new Error(
      `Wellfound HTTP ${response?.status()} page=${pageNumber}`,
    );
  }

  await page.waitForSelector('#__NEXT_DATA__', {
    state: 'attached',
    timeout: 30_000,
  });

  return this.parseNextData(page);
}
    private filterJobs(
    jobs: WellfoundSearchJob[],
    output: Map<string, WellfoundRawJob>,
  ): void {
    for (const job of jobs) {
      const reason = this.filter.getRejectReason(job);

      if (reason) {
        this.logger.debug(`Rejected ${job.id}: ${job.title} | ${reason}`);

        continue;
      }

      const experience = this.filter.resolveExperience(job);

      const matchedTechnologies = this.filter.getMatchedTechnologies(job);

      this.logger.log(
        `Accepted ${job.id}: ${job.title} | Remote | tech=${matchedTechnologies.join(',')} | exp=${experience.min ?? '?'}-${experience.max ?? '?'}`,
      );

      output.set(job.id, {
        search: job,

        experience,

        matchedTechnologies,
      });
    }
  }
  private async parseNextData(page: Page): Promise<{
    jobs: WellfoundSearchJob[];

    pageCount: number;

    totalJobCount: number;
  }> {
    const content = await page.locator('#__NEXT_DATA__').textContent();

    if (!content) {
      throw new Error('Wellfound __NEXT_DATA__ missing');
    }

    const json = JSON.parse(content);

    /*
     * Wellfound:
     *
     * props
     *   pageProps
     *     apolloState
     *       data
     */
    const store = json?.props?.pageProps?.apolloState?.data;

    if (!store) {
      throw new Error('Wellfound Apollo state missing');
    }

    const root = store.ROOT_QUERY;

    if (!root) {
      throw new Error('Wellfound ROOT_QUERY missing');
    }

    /*
     * จุดที่โค้ดเดิมผิด:
     *
     * seoLandingPageJobSearchResults
     * ไม่ได้อยู่ตรง ROOT_QUERY
     *
     * แต่อยู่:
     *
     * ROOT_QUERY.talent
     */
    const talent = root.talent;

    if (!talent) {
      this.logger.error(
        `Wellfound ROOT_QUERY keys: ${Object.keys(root).join(', ')}`,
      );

      throw new Error('Wellfound talent state missing');
    }

    /*
     * ตัวอย่าง key:
     *
     * seoLandingPageJobSearchResults(
     *   {"page":1,"role":"software-engineer"}
     * )
     */
    const resultKey = Object.keys(talent).find((key) =>
      key.startsWith('seoLandingPageJobSearchResults('),
    );

    if (!resultKey) {
      this.logger.error(
        `Wellfound talent keys: ${Object.keys(talent).join(', ')}`,
      );

      throw new Error('Wellfound search result missing');
    }

    const searchResult = talent[resultKey];

    if (!searchResult) {
      throw new Error(`Wellfound search result data missing: ${resultKey}`);
    }

    this.logger.debug(`Wellfound search key: ${resultKey}`);

    this.logger.debug(
      `Wellfound search result: totalJobs=${searchResult.totalJobCount}, totalStartups=${searchResult.totalStartupCount}, pages=${searchResult.pageCount}`,
    );

    const jobs = new Map<string, WellfoundSearchJob>();

    /*
     * searchResult.startups:
     *
     * [
     *   {
     *     __ref:
     *     'StartupResult:8887646'
     *   }
     * ]
     */
    const startupRefs = Array.isArray(searchResult.startups)
      ? searchResult.startups
      : [];

    for (const startupRef of startupRefs) {
      const ref = startupRef?.__ref;

      if (!ref) {
        continue;
      }

      const startup = store[ref];

      if (!startup) {
        continue;
      }

      const companyName = startup.name ?? '';

      const companySlug = startup.slug;

      /*
       * startup:
       *
       * highlightedJobListings:
       *
       * [
       *   {
       *     __ref:
       *     'JobListingSearchResult:4787364'
       *   }
       * ]
       */
      const jobRefs = Array.isArray(startup.highlightedJobListings)
        ? startup.highlightedJobListings
        : [];

      for (const jobRef of jobRefs) {
        const jobRefName = jobRef?.__ref;

        if (!jobRefName) {
          continue;
        }

        const job = store[jobRefName];

        if (!job) {
          continue;
        }

        if (!job.id || !job.title) {
          continue;
        }

        const id = String(job.id);

        const slug = String(job.slug ?? '');

        jobs.set(id, {
          id,

          slug,

          title: String(job.title),

          company: companyName,

          companySlug,

          description:
            typeof job.description === 'string' ? job.description : undefined,

          jobType: typeof job.jobType === 'string' ? job.jobType : undefined,

          compensation:
            typeof job.compensation === 'string' ? job.compensation : undefined,

          locationNames: Array.isArray(job.locationNames)
            ? job.locationNames
            : [],

          remote: Boolean(job.remote),

          acceptedRemoteLocationNames: Array.isArray(
            job.acceptedRemoteLocationNames,
          )
            ? job.acceptedRemoteLocationNames
            : [],

          yearsExperienceMin:
            typeof job.yearsExperienceMin === 'number'
              ? job.yearsExperienceMin
              : undefined,

          yearsExperienceMax:
            typeof job.yearsExperienceMax === 'number'
              ? job.yearsExperienceMax
              : undefined,

          liveStartAt:
            typeof job.liveStartAt === 'number' ? job.liveStartAt : undefined,

          jobUrl: `${this.baseUrl}/jobs/${id}-${slug}`,
        });
      }
    }

    this.logger.log(`Wellfound page parsed: ${jobs.size} jobs`);

    return {
      jobs: [...jobs.values()],

      pageCount: Number(searchResult.pageCount ?? 1),

      totalJobCount: Number(searchResult.totalJobCount ?? jobs.size),
    };
  }
}
