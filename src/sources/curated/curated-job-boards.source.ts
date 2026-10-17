import { Injectable, Logger } from '@nestjs/common';
import { BrowserService } from '../../browser/browser.service';
import { JobDto } from '../common/job.dto';
import { JobSource } from '../source/job-source.interface';

interface Board {
  name: string;
  url: string;
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
  url?: string;
}

const BOARDS: Board[] = [
  { name: 'hiredly', url: 'https://my.hiredly.com/Software-Developer-jobs' },
  { name: 'tokyodev', url: 'https://www.tokyodev.com/jobs' },
  { name: 'japandev', url: 'https://japan-dev.com/jobs' },
  { name: 'relocate-me', url: 'https://relocate.me/international-jobs/software-engineer' },
  { name: 'we-work-remotely', url: 'https://weworkremotely.com/remote-jobs-node-js' },
  { name: 'himalayas', url: 'https://himalayas.app/jobs/nestjs' },
  { name: 'remote-ok', url: 'https://remoteok.com/remote-nodejs-jobs' },
  { name: 'landing-jobs', url: 'https://landing.jobs/jobs?query=Node.js' },
  { name: 'wearedevelopers', url: 'https://www.wearedevelopers.com/en/jobs?search=Node.js' },
  { name: 'nodeflair', url: 'https://nodeflair.com/jobs?query=Node.js' },
  { name: 'turing', url: 'https://www.turing.com/jobs/node-js-jobs' },
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

const STACK_PATTERN = /\b(nest\.?js|nestjs|node\.?js|nodejs|typescript|javascript|next\.?js|express|fastify)\b/i;

@Injectable()
export class CuratedJobBoardsSource implements JobSource {
  readonly name = 'curated-job-boards';
  private readonly logger = new Logger(CuratedJobBoardsSource.name);

  constructor(private readonly browser: BrowserService) {}

  async collect(): Promise<JobDto[]> {
    const context = await this.browser.createContext();
    const jobs = new Map<string, JobDto>();

    try {
      for (const board of BOARDS) {
        const page = await this.browser.createPage(context);
        try {
          this.logger.log(`Opening ${board.name}: ${board.url}`);
          await page.goto(board.url, {
            waitUntil: 'domcontentloaded',
            timeout: 60_000,
          });

          const discovered = await page.evaluate(() => {
            const results: Array<Record<string, unknown>> = [];
            const visit = (value: unknown): void => {
              if (Array.isArray(value)) {
                value.forEach(visit);
                return;
              }
              if (!value || typeof value !== 'object') return;
              const item = value as Record<string, unknown>;
              const type = item['@type'];
              if (
                (type === 'JobPosting' ||
                  (Array.isArray(type) && type.includes('JobPosting'))) &&
                typeof item.title === 'string'
              ) {
                results.push(item);
              }
              if (item['@graph']) visit(item['@graph']);
              if (item.itemListElement) visit(item.itemListElement);
            };

            document
              .querySelectorAll('script[type="application/ld+json"]')
              .forEach((script) => {
                try {
                  visit(JSON.parse(script.textContent ?? ''));
                } catch {
                  // Ignore malformed structured data and continue with other scripts.
                }
              });

            if (results.length === 0) {
              document.querySelectorAll('a[href]').forEach((anchor) => {
                const link = anchor as HTMLAnchorElement;
                const title = link.innerText.trim();
                const href = link.href;
                if (
                  title.length < 8 ||
                  !/\/(jobs?|positions?)\//i.test(new URL(href).pathname)
                ) return;
                const card =
                  link.closest('article, li, [class*="job"], [data-testid*="job"]') ??
                  link.parentElement;
                results.push({
                  title,
                  url: href,
                  description: card?.textContent?.trim() ?? '',
                });
              });
            }

            return results;
          });

          for (const raw of discovered as StructuredJob[]) {
            const title = raw.title?.trim();
            const url = raw.url?.startsWith('http')
              ? raw.url
              : raw.url
                ? new URL(raw.url, board.url).href
                : undefined;
            const description = this.stripHtml(raw.description ?? '');
            const searchable = [title, description, raw.skills].flat().join(' ');
            const normalizedSearch = searchable.toLowerCase();
            const matchesKeyword = SEARCH_KEYWORDS.some((keyword) =>
              normalizedSearch.includes(keyword.toLowerCase()),
            );
            if (
              !title ||
              !url ||
              !STACK_PATTERN.test(searchable) ||
              !matchesKeyword
            ) continue;

            const externalId =
              (typeof raw.identifier === 'string'
                ? raw.identifier
                : raw.identifier?.value) ??
              new URL(url).pathname.replace(/\/$/, '') ??
              url;
            const location = this.locationText(raw.jobLocation);
            const technologies = [
              'NestJS', 'Node.js', 'TypeScript', 'JavaScript', 'Next.js',
              'Express', 'Fastify', 'PostgreSQL', 'MySQL', 'Redis', 'Docker',
            ].filter((technology) =>
              new RegExp(technology.replace('.', '\\.?'), 'i').test(searchable),
            );
            const dto: JobDto = {
              source: board.name,
              externalId: String(externalId).slice(0, 500),
              title,
              company: raw.hiringOrganization?.name,
              location:
                raw.jobLocationType === 'TELECOMMUTE'
                  ? 'Remote'
                  : location,
              description: description.slice(0, 20_000) || undefined,
              requirements: [],
              technologies,
              jobUrl: url,
              postedAt: raw.datePosted ? new Date(raw.datePosted) : undefined,
            };

            if (Number.isNaN(dto.postedAt?.getTime())) delete dto.postedAt;
            jobs.set(`${dto.source}:${dto.externalId}`, dto);
          }
          this.logger.log(`${board.name}: ${jobs.size} matching jobs discovered so far`);
        } catch (error) {
          this.logger.warn(
            `Could not collect ${board.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        } finally {
          await page.close();
        }
      }
      return [...jobs.values()];
    } finally {
      await context.close();
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
