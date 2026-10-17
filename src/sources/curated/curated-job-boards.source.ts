import { Injectable, Logger } from '@nestjs/common';
import { BrowserContext, Page } from 'playwright';
import { BrowserService } from '../../browser/browser.service';
import { JobDto } from '../common/job.dto';
import { JobSource } from '../source/job-source.interface';

interface Board {
  name: string;
  url: string;
  detailLimit: number;
}

interface StructuredJob {
  title?: string;
  identifier?: { value?: string } | string;
  hiringOrganization?: { name?: string };
  jobLocation?: unknown;
  jobLocationType?: string;
  datePosted?: string;
  description?: string;
  skills?: string | string[];
  employmentType?: string | string[];
  salaryText?: string;
  requirements?: string[];
  url?: string;
}

interface JobDetail {
  title?: string;
  company?: string;
  location?: string;
  salaryText?: string;
  description?: string;
  skills?: string[];
  requirements?: string[];
  postedAt?: string;
  remote?: boolean;
}

const BOARDS: Board[] = [
  { name: 'hiredly', url: 'https://my.hiredly.com/Software-Developer-jobs', detailLimit: 5 },
  { name: 'tokyodev', url: 'https://www.tokyodev.com/jobs', detailLimit: 30 },
  { name: 'japandev', url: 'https://japan-dev.com/jobs', detailLimit: 5 },
  { name: 'relocate-me', url: 'https://relocate.me/international-jobs/software-engineer', detailLimit: 5 },
  { name: 'we-work-remotely', url: 'https://weworkremotely.com/remote-jobs-node-js', detailLimit: 5 },
  { name: 'himalayas', url: 'https://himalayas.app/jobs/nestjs', detailLimit: 5 },
  { name: 'remote-ok', url: 'https://remoteok.com/remote-nodejs-jobs', detailLimit: 5 },
  { name: 'landing-jobs', url: 'https://landing.jobs/jobs?query=Node.js', detailLimit: 5 },
  { name: 'wearedevelopers', url: 'https://www.wearedevelopers.com/en/jobs?search=Node.js', detailLimit: 5 },
  { name: 'nodeflair', url: 'https://nodeflair.com/jobs?query=Node.js', detailLimit: 5 },
  { name: 'turing', url: 'https://www.turing.com/jobs/node-js-jobs', detailLimit: 5 },
];

const SEARCH_KEYWORDS = [
  'NestJS', 'Nest.js', 'Node.js', 'NodeJS', 'Node.js Backend',
  'Backend Engineer Node.js', 'Backend Developer TypeScript',
  'Software Engineer TypeScript', 'TypeScript Backend',
  'Full Stack NestJS', 'Next.js NestJS', 'JavaScript Backend',
  'Microservices Node.js', 'Node.js visa sponsorship',
  'TypeScript visa sponsorship', 'Backend Engineer relocation',
  'Node.js relocation', 'Software Engineer relocation',
  'NestJS relocation', 'Backend Engineer APAC',
  'Node.js international candidates', 'Node.js worldwide',
  'NestJS worldwide', 'TypeScript backend worldwide',
  'NestJS remote APAC', 'Node.js remote Asia',
];

const STACK_PATTERN =
  /\b(nest\.?js|nestjs|node\.?js|nodejs|typescript|javascript|next\.?js|express|fastify)\b/i;

@Injectable()
export class CuratedJobBoardsSource implements JobSource {
  readonly name = 'curated-job-boards';
  private readonly logger = new Logger(CuratedJobBoardsSource.name);

  constructor(private readonly browser: BrowserService) {}

  async collect(): Promise<JobDto[]> {
    const results = await Promise.all(
      BOARDS.map((board) => this.collectBoard(board)),
    );
    return results.flat();
  }

  getSources(): JobSource[] {
    return BOARDS.map((board) => ({
      name: board.name,
      collect: () => this.collectBoard(board),
    }));
  }

  private async collectBoard(board: Board): Promise<JobDto[]> {
    const context = await this.browser.createContext();
    const page = await this.browser.createPage(context);
    const jobs = new Map<string, JobDto>();
    let detailPagesVisited = 0;

    try {
      this.logger.log(`Opening ${board.name}: ${board.url}`);
      await page.goto(board.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });

      const discovered = await this.collectSearchResults(page, board);
      this.logger.log(`${board.name} listing returned ${discovered.length} candidates`);

      for (const listingJob of discovered) {
        const title = listingJob.title?.trim();
        const url = listingJob.url?.startsWith('http')
          ? listingJob.url
          : listingJob.url
            ? new URL(listingJob.url, board.url).href
            : undefined;
        if (!title || !url) continue;

        const listingDescription = this.stripHtml(listingJob.description ?? '');
        const listingSearchText = [
          title,
          listingDescription,
          listingJob.skills,
        ].flat().join(' ');
        const matchesStack = STACK_PATTERN.test(listingSearchText);
        const matchesPhrase = SEARCH_KEYWORDS.some((keyword) =>
          listingSearchText.toLowerCase().includes(keyword.toLowerCase()),
        );

        // TokyoDev surfaces its stack and eligibility tags on each listing card.
        // Keep its TypeScript and Node.js listings even when they lack a full phrase.
        if (!matchesStack || (!matchesPhrase && board.name !== 'tokyodev')) continue;

        let detail: JobDetail | undefined;
        if (detailPagesVisited < board.detailLimit) {
          detailPagesVisited++;
          detail = await this.collectDetail(context, board, url);
        }

        const description = detail?.description || listingDescription;
        const searchable = [
          title,
          description,
          listingSearchText,
          detail?.skills,
          detail?.requirements,
        ].flat().join(' ');
        if (!STACK_PATTERN.test(searchable)) continue;

        const externalId =
          (typeof listingJob.identifier === 'string'
            ? listingJob.identifier
            : listingJob.identifier?.value) ??
          new URL(url).pathname.replace(/\/$/, '') ??
          url;
        const technologies = [
          'NestJS', 'Node.js', 'TypeScript', 'JavaScript', 'Next.js',
          'Express', 'Fastify', 'PostgreSQL', 'MySQL', 'Redis', 'Docker',
        ].filter((technology) =>
          new RegExp(technology.replace('.', '\\.?'), 'i').test(searchable),
        );
        const dto: JobDto = {
          source: board.name,
          externalId: String(externalId).slice(0, 500),
          title: detail?.title || title,
          company: detail?.company || listingJob.hiringOrganization?.name,
          location:
            detail?.remote || listingJob.jobLocationType === 'TELECOMMUTE'
              ? 'Remote'
              : detail?.location || this.locationText(listingJob.jobLocation),
          salaryText: detail?.salaryText || listingJob.salaryText,
          description: description.slice(0, 20_000) || undefined,
          requirements: detail?.requirements ?? listingJob.requirements ?? [],
          technologies,
          jobUrl: url,
          postedAt: detail?.postedAt
            ? new Date(detail.postedAt)
            : listingJob.datePosted
              ? new Date(listingJob.datePosted)
              : undefined,
        };

        if (Number.isNaN(dto.postedAt?.getTime())) delete dto.postedAt;
        jobs.set(`${dto.source}:${dto.externalId}`, dto);
      }

      this.logger.log(
        `${board.name}: ${jobs.size} matching jobs; opened ${detailPagesVisited} job detail pages`,
      );
      return [...jobs.values()];
    } catch (error) {
      this.logger.warn(
        `Could not collect ${board.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [...jobs.values()];
    } finally {
      await context.close();
    }
  }

  private async collectSearchResults(
    page: Page,
    board: Board,
  ): Promise<StructuredJob[]> {
    return page.evaluate((sourceName) => {
      const results: Array<Record<string, unknown>> = [];
      const clean = (value?: string | null) => value?.replace(/\s+/g, ' ').trim() || undefined;
      const add = (
        anchor: HTMLAnchorElement | null,
        card: Element | null,
        titleSelector?: string,
        companySelector?: string,
        descriptionSelector?: string,
      ) => {
        const title = clean(card?.querySelector(titleSelector ?? 'h1, h2, h3, [class*="title"]')?.textContent) || clean(anchor?.textContent);
        if (!anchor || !title || title.length < 4) return;
        const href = anchor.href;
        if (!href || href.startsWith('javascript:')) return;
        results.push({
          title,
          url: href,
          description: clean(card?.querySelector(descriptionSelector ?? '[class*="description"], [class*="summary"], p')?.textContent) || clean(card?.textContent) || '',
          hiringOrganization: clean(card?.querySelector(companySelector ?? '[class*="company"], [class*="employer"]')?.textContent)
            ? { name: clean(card?.querySelector(companySelector ?? '[class*="company"], [class*="employer"]')?.textContent) }
            : undefined,
        });
      };
      const cardFor = (anchor: Element) =>
        anchor.closest('article, li, tr, [data-testid*="job"], [class*="job-card"], [class*="JobCard"], [class*="job-listing"]') ?? anchor.parentElement;

      if (sourceName === 'tokyodev') {
        document.querySelectorAll('li[id^="company_"] [data-collapsable-list-target="item"]').forEach((item) => {
          const anchor = item.querySelector('a[href^="/companies/"][href*="/jobs/"]') as HTMLAnchorElement | null;
          const company = item.closest('li[id^="company_"]')?.querySelector('h3 a')?.textContent?.trim();
          const tags = Array.from(item.querySelectorAll('a.tag')).map((tag) => tag.textContent?.trim()).filter(Boolean);
          add(anchor, item, 'a[href*="/jobs/"]');
          const last = results[results.length - 1];
          if (last) {
            last.hiringOrganization = company ? { name: company } : undefined;
            last.skills = tags.join(', ');
            last.description = item.textContent?.trim() ?? '';
          }
        });
      } else if (sourceName === 'remote-ok') {
        document.querySelectorAll('tr.job, [data-id].job').forEach((card) => {
          const anchor = card.querySelector('.company h2 a, h2 a, a[href*="/l/"]') as HTMLAnchorElement | null;
          add(anchor, card, 'h2, .company h2', '.company h3, h3');
        });
      } else if (sourceName === 'we-work-remotely') {
        document.querySelectorAll('section.jobs li, .jobs li, li[class*="job"]').forEach((card) => {
          const anchor = card.querySelector('a[href*="/remote-jobs/"]') as HTMLAnchorElement | null;
          add(anchor, card, 'span.title, h2, h3, a[href*="/remote-jobs/"]', 'span.company, h3');
        });
      } else {
        const selectors: Record<string, string> = {
          hiredly: 'a[href*="/jobs/"], a[href*="/job/"]',
          japandev: 'a[href^="/jobs/"]',
          'relocate-me': 'a[href*="/international-jobs/"], a[href*="/jobs/"], a[href*="/software-engineer-"], a[href*="/developer-"]',
          himalayas: 'a[href*="/jobs/"]',
          'landing-jobs': 'a[href*="/jobs/"], a[href*="/job/"]',
          wearedevelopers: 'a[href*="/jobs/"], a[href*="/job/"]',
          nodeflair: 'a[href*="/jobs/"], a[href*="/job/"]',
          turing: 'a[href*="/jobs/"], a[href*="/job/"]',
        };
        const selector = selectors[sourceName] ?? 'a[href*="/jobs/"]';
        document.querySelectorAll(selector).forEach((element) => {
          const anchor = element as HTMLAnchorElement;
          const path = new URL(anchor.href).pathname;
          const isDetailPath = sourceName === 'relocate-me'
            ? /\/(?:software-engineer|developer|backend|fullstack)[^/]*$/i.test(path) || /\/jobs?\/[^/]+$/i.test(path)
            : /\/(?:jobs?|positions?)\/[^/?#]+(?:\/[^/?#]+)*$/i.test(path);
          if (!isDetailPath) return;
          const card = cardFor(anchor);
          add(anchor, card);
        });
      }

      if (results.length === 0) {
        const pathPatterns: Record<string, RegExp> = {
          hiredly: /\/(?:jobs?|job)\//i,
          japandev: /^\/jobs\/[^/]+/i,
          'relocate-me': /\/(?:jobs?|software-engineer|developer|backend|fullstack)[^/]*$/i,
          'we-work-remotely': /\/remote-jobs\//i,
          himalayas: /\/(?:jobs?|companies)\//i,
          'remote-ok': /\/remote-/i,
          'landing-jobs': /\/(?:jobs?|job)\//i,
          wearedevelopers: /\/(?:jobs?|job)\//i,
          nodeflair: /\/(?:jobs?|job)\//i,
        };
        document.querySelectorAll('a[href]').forEach((element) => {
          const anchor = element as HTMLAnchorElement;
          if (!pathPatterns[sourceName]?.test(new URL(anchor.href).pathname)) return;
          add(anchor, cardFor(anchor));
        });
      }
      const seen = new Set<string>();
      return results.filter((job) => {
        const key = String(job.url);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }, board.name) as Promise<StructuredJob[]>;
  }

  private async collectDetail(
    context: BrowserContext,
    board: Board,
    url: string,
  ): Promise<JobDetail | undefined> {
    const page = await this.browser.createPage(context);
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      return await page.evaluate((sourceName) => {
        const clean = (value?: string | null) =>
          value?.replace(/\s+/g, ' ').trim() || undefined;

        if (sourceName === 'tokyodev') {
          const header = document.querySelector('#job-header');
          const article = document.querySelector('article.prose');
          const company = header
            ?.querySelector('a[href^="/companies/"] .font-bold')
            ?.textContent?.trim();
          const headerText = header?.textContent ?? '';
          const location = headerText.match(
            /(?:[A-Z][\w-]*(?:-ku)?(?:,\s*)?)+(?:Tokyo|Osaka|Kyoto|Japan)/i,
          )?.[0];
          const salaryText = headerText.match(
            /[¥$€]\s?[\d,.]+\s*(?:~|to|-)?\s*[¥$€]?\s?[\d,.]*(?:\s*(?:annually|per year))?/i,
          )?.[0];
          const skills = Array.from(
            document.querySelectorAll('#job-header a.tag, #job-header .tag'),
          )
            .map((tag) => tag.textContent?.trim())
            .filter((tag): tag is string => Boolean(tag));
          const requirements = Array.from(
            (article ?? document).querySelectorAll('li'),
          )
            .map((item) => item.textContent?.trim())
            .filter((item): item is string => Boolean(item));
          const description = [
            header?.innerText,
            article?.innerText,
          ].filter(Boolean).join('\n');

          return {
            title: clean(header?.querySelector('h1.headline')?.textContent),
            company: clean(company),
            location: clean(location),
            salaryText: clean(salaryText),
            description: clean(description),
            skills,
            requirements,
            remote: /remote/i.test(headerText),
          };
        }

        const scripts = Array.from(
          document.querySelectorAll('script[type="application/ld+json"]'),
        );
        let posting: Record<string, unknown> | undefined;
        const visit = (value: unknown): void => {
          if (Array.isArray(value)) {
            value.forEach(visit);
            return;
          }
          if (!value || typeof value !== 'object') return;
          const item = value as Record<string, unknown>;
          const type = item['@type'];
          if (
            type === 'JobPosting' ||
            (Array.isArray(type) && type.includes('JobPosting'))
          ) posting = item;
          if (item['@graph']) visit(item['@graph']);
          if (item.itemListElement) visit(item.itemListElement);
          if (item.item) visit(item.item);
        };
        scripts.forEach((script) => {
          try {
            visit(JSON.parse(script.textContent ?? ''));
          } catch {
            // Ignore malformed structured data.
          }
        });

        const detailSelectors: Record<string, { body: string; company: string; location: string }> = {
          hiredly: { body: '[class*="job-description"], [class*="JobDescription"], main article', company: '[class*="company-name"], [class*="company"]', location: '[class*="location"]' },
          japandev: { body: '[class*="job-description"], [class*="JobDescription"], article, main', company: '[class*="company-name"], [class*="company"]', location: '[class*="location"]' },
          'relocate-me': { body: '#job-description, [class*="job-description"], article, main', company: '[class*="company-name"], [class*="company"]', location: '[class*="location"]' },
          'we-work-remotely': { body: '.listing-container, .job-listing, main article, main', company: '[class*="company"]', location: '[class*="location"], [class*="region"]' },
          himalayas: { body: '[class*="JobPage"], [class*="job-description"], main article, main', company: '[class*="company-name"], [class*="company"]', location: '[class*="location"], [class*="location"]' },
          'remote-ok': { body: '#job_description, #job-description, .description, main', company: '.company h3, [class*="company"]', location: '[class*="location"]' },
          'landing-jobs': { body: '[class*="job-description"], [class*="description"], main article, main', company: '[class*="company-name"], [class*="company"]', location: '[class*="location"]' },
          wearedevelopers: { body: '[class*="job-description"], [class*="description"], main article, main', company: '[class*="company-name"], [class*="company"]', location: '[class*="location"]' },
          nodeflair: { body: '[class*="job-description"], [class*="description"], main article, main', company: '[class*="company-name"], [class*="company"]', location: '[class*="location"]' },
          turing: { body: '[class*="job-description"], [class*="description"], main article, main', company: '[class*="company-name"], [class*="company"]', location: '[class*="location"]' },
        };
        const selectors = detailSelectors[sourceName] ?? {
          body: '[itemprop="description"], article, main, [class*="description"]',
          company: '[itemprop="hiringOrganization"], [class*="company-name"], [class*="company"]',
          location: '[itemprop="jobLocation"], [class*="location"]',
        };
        const main = document.querySelector(selectors.body);
        const description =
          typeof posting?.description === 'string'
            ? posting.description
            : main?.textContent ?? document.body.innerText;
        const company =
          (posting?.hiringOrganization as { name?: string } | undefined)?.name ??
          document.querySelector(selectors.company)?.textContent?.trim();
        const location =
          document.querySelector(selectors.location)?.textContent?.trim();
        const skills =
          typeof posting?.skills === 'string'
            ? posting.skills.split(/[,;|]/).map((skill) => skill.trim())
            : Array.isArray(posting?.skills)
              ? posting.skills.filter(
                  (skill): skill is string => typeof skill === 'string',
                )
              : [];
        const requirements = Array.from(
          document.querySelectorAll('[itemprop="description"] li, article li, main li'),
        )
          .map((item) => item.textContent?.trim())
          .filter((item): item is string => Boolean(item));

        return {
          title:
            (typeof posting?.title === 'string' ? posting.title : undefined) ??
            document.querySelector('h1')?.textContent?.trim(),
          company,
          location,
          salaryText: document.querySelector('[class*="salary"]')?.textContent?.trim(),
          description,
          skills,
          requirements,
          postedAt:
            typeof posting?.datePosted === 'string'
              ? posting.datePosted
              : undefined,
          remote: /remote|telecommute/i.test(document.body.innerText),
        };
      }, board.name);
    } catch (error) {
      this.logger.debug(
        `Could not open ${board.name} detail ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    } finally {
      await page.close();
    }
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private locationText(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    const locations = Array.isArray(value) ? value : [value];
    const names = locations
      .map((location) => {
        if (!location || typeof location !== 'object') return undefined;
        const address = (location as { address?: unknown }).address;
        if (typeof address === 'string') return address;
        if (!address || typeof address !== 'object') return undefined;
        const fields = address as Record<string, unknown>;
        return [
          fields.addressLocality,
          fields.addressRegion,
          fields.addressCountry,
        ]
          .filter((part): part is string => typeof part === 'string')
          .join(', ');
      })
      .filter((name): name is string => Boolean(name));
    return names.length ? [...new Set(names)].join(' / ') : undefined;
  }
}
