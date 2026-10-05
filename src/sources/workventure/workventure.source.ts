// src/sources/workventure/workventure.source.ts

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
  WorkVentureNormalizer,
} from './workventure.normalizer';

import {
  WorkVentureDetailPageData,
  WorkVentureRawJob,
  WorkVentureSearchItem,
} from './workventure.types';

@Injectable()
export class WorkVentureSource
  implements JobSource
{
  readonly name =
    'workventure';

  private readonly logger =
    new Logger(
      WorkVentureSource.name,
    );

  private readonly searchUrl =
    'https://www.workventure.com/jobs/keyword/nestjs';

  constructor(
    private readonly browser:
      BrowserService,

    private readonly normalizer:
      WorkVentureNormalizer,
  ) {

  }
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
      `Opening WorkVenture: ${this.searchUrl}`,
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
      '.job-card-div[data-id]',
      {
        timeout:
          30_000,
      },
    );

    /*
     * เก็บ Search ทุกหน้า
     */
    const searchJobs =
      await this.collectAllSearchPages(
        searchPage,
      );

    this.logger.log(
      `Total WorkVenture jobs: ${searchJobs.length}`,
    );

    /*
     * เปิด detail
     */
    const results:
      JobDto[] = [];

    for (const searchJob of searchJobs) {
      try {
        const raw =
          await this.collectJob(
            context,
            searchJob,
          );

        const normalized =
          this.normalizer.normalize(
            raw,
          );

        results.push(
          normalized,
        );

        this.logger.log(
          `Collected ${searchJob.id}: ${searchJob.title}`,
        );
      } catch (error) {
        this.logger.error(
          `Cannot collect ${searchJob.id}: ${searchJob.title}`,
          error instanceof Error
            ? error.stack
            : String(error),
        );
      }
    }

    this.logger.log(
      `Completed WorkVenture: ${results.length}/${searchJobs.length}`,
    );

    return results;
  } finally {
    await context.close();
  }
}
private async collectAllSearchPages(
  page: Page,
): Promise<WorkVentureSearchItem[]> {
  const unique =
    new Map<
      string,
      WorkVentureSearchItem
    >();

  let pageNumber =
    1;

  while (true) {
    await page.waitForSelector(
      '.job-card-div[data-id]',
      {
        timeout:
          30_000,
      },
    );

    const jobs =
      await this.collectSearchPage(
        page,
      );

    this.logger.log(
      `WorkVenture page ${pageNumber}: ${jobs.length} jobs`,
    );

    for (const job of jobs) {
      unique.set(
        job.id,
        job,
      );
    }

    const nextButton =
      page.locator(
        '.all-job-pagination .btn-next',
      );

    if (
      await nextButton.count() ===
      0
    ) {
      break;
    }

    const className =
      await nextButton.getAttribute(
        'class',
      );

    if (
      className?.includes(
        'disabled',
      )
    ) {
      break;
    }

    /*
     * จำ id งานแรก
     * เพื่อรอหน้าถัดไปเปลี่ยนจริง
     */
    const firstId =
      jobs[0]?.id;

    await nextButton.click();

    if (firstId) {
      await page.waitForFunction(
        previousId => {
          const first =
            document.querySelector(
              '.job-card-div[data-id]',
            );

          return (
            first?.getAttribute(
              'data-id',
            ) !== previousId
          );
        },
        firstId,
        {
          timeout:
            30_000,
        },
      );
    } else {
      await page.waitForTimeout(
        1000,
      );
    }

    pageNumber++;
  }

  return [
    ...unique.values(),
  ];
}
private async collectSearchPage(
  page: Page,
): Promise<WorkVentureSearchItem[]> {
  const jobs =
    await page
      .locator(
        '.job-card-div[data-id]',
      )
      .evaluateAll(cards =>
        cards.map(card => {
          const id =
            card.getAttribute(
              'data-id',
            ) ?? '';

          const titleLink =
            card.querySelector(
              '.job-title a',
            ) as HTMLAnchorElement | null;

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

          const location =
            card
              .querySelector(
                '.job-info .location',
              )
              ?.textContent
              ?.replace(
                /,\s*$/,
                '',
              )
              .trim();

          /*
           * อ่าน topic block
           *
           * ประสบการณ์:
           * ทักษะ:
           * ประเภทงาน:
           * เงินเดือน:
           */
          const topicBlocks =
            Array.from(
              card.querySelectorAll(
                '.more-detail-container__topic-block',
              ),
            );

          const getTopic =
            (
              label: string,
            ): string | undefined => {
              const block =
                topicBlocks.find(
                  item =>
                    item
                      .querySelector(
                        '.title',
                      )
                      ?.textContent
                      ?.trim()
                      .startsWith(
                        label,
                      ),
                );

              return (
                block
                  ?.querySelector(
                    '.description',
                  )
                  ?.textContent
                  ?.replace(
                    /\s+/g,
                    ' ',
                  )
                  .trim() ||
                undefined
              );
            };

          const experience =
            getTopic(
              'ประสบการณ์',
            );

          const skillsText =
            getTopic(
              'ทักษะ',
            );

          const jobType =
            getTopic(
              'ประเภทงาน',
            );

          const salary =
            getTopic(
              'เงินเดือน',
            );

          const skills =
            skillsText
              ? skillsText
                  .split(',')
                  .map(value =>
                    value.trim(),
                  )
                  .filter(Boolean)
              : [];

          const postedText =
            card
              .querySelector(
                '.days-ago span',
              )
              ?.textContent
              ?.trim();

          return {
            id,

            title,

            company,

            location,

            experience,

            skills,

            jobType,

            salary,

            postedText,

            jobUrl:
              titleLink?.href ??
              '',
          };
        }),
      );

  const unique =
    new Map<
      string,
      WorkVentureSearchItem
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
private async collectJob(
  context: BrowserContext,
  searchJob:
    WorkVentureSearchItem,
): Promise<WorkVentureRawJob> {
  const page =
    await this.browser.createPage(
      context,
    );

  try {
    this.logger.log(
      `Collecting WorkVenture ${searchJob.id}`,
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
      '.jobdescription__jobtitle',
      {
        timeout:
          30_000,
      },
    );

    const detail =
      await this.collectDetailPage(
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
private async collectDetailPage(
  page: Page,
): Promise<WorkVentureDetailPageData> {
  const title =
    await this.text(
      page,
      '.jobdescription__jobtitle',
    );

  const company =
    await this.text(
      page,
      '.jobdescription__link--name',
    );

  const responsibilities =
    await this.detailSectionLines(
      page,
      'Responsibilities',
    );

  const qualifications =
    await this.detailSectionLines(
      page,
      'Qualifications',
    );

  const experience =
    await this.smallerHeadValue(
      page,
      'ประสบการณ์ที่จำเป็น',
    );

  const level =
    await this.smallerHeadValue(
      page,
      'ระดับตำแหน่งงาน',
    );

  const salary =
    await this.smallerHeadValue(
      page,
      'เงินเดือน',
    );

  const functionName =
    await this.smallerHeadValue(
      page,
      'สายงาน',
    );

  const jobType =
    await this.smallerHeadValue(
      page,
      'ประเภทงาน',
    );

  const age =
    await this.smallerHeadValue(
      page,
      'อายุ',
    );

  const applyUrl =
    await this.href(
      page,
      'a[href$="/quick"]',
    );

  return {
    title,

    company,

    responsibilities,

    qualifications,

    experience,

    level,

    salary,

    function:
      functionName,

    jobType,

    age,

    applyUrl,

    jobUrl:
      page.url(),
  };
}
private async detailSectionLines(
  page: Page,
  heading: string,
): Promise<string[]> {
  return page.evaluate(
    label => {
      const root =
        document.querySelector(
          '.custom__jobdescription',
        );

      if (!root) {
        return [];
      }

      const strongElements =
        Array.from(
          root.querySelectorAll(
            'strong',
          ),
        );

      const strong =
        strongElements.find(
          element =>
            element.textContent
              ?.trim()
              .toLowerCase() ===
            label.toLowerCase(),
        );

      if (!strong) {
        return [];
      }

      const paragraph =
        strong.closest('p');

      if (!paragraph) {
        return [];
      }

      let next =
        paragraph.nextElementSibling;

      while (next) {
        if (
          next.tagName === 'UL'
        ) {
          return Array.from(
            next.querySelectorAll(
              'li',
            ),
          )
            .map(element =>
              element.textContent
                ?.replace(
                  /^[-•]\s*/,
                  '',
                )
                .replace(
                  /\s+/g,
                  ' ',
                )
                .trim() ?? '',
            )
            .filter(Boolean);
        }

        /*
         * เจอ heading ถัดไปแล้ว
         * ไม่ต้องไล่ต่อ
         */
        if (
          next.querySelector(
            'strong',
          )
        ) {
          break;
        }

        next =
          next.nextElementSibling;
      }

      return [];
    },
    heading,
  );
}
private async smallerHeadValue(
  page: Page,
  heading: string,
): Promise<
  string | undefined
> {
  return page.evaluate(
    label => {
      const blocks =
        Array.from(
          document.querySelectorAll(
            '.jobdescription__smallerhead',
          ),
        );

      const block =
        blocks.find(
          element =>
            element
              .querySelector(
                'h6',
              )
              ?.textContent
              ?.trim()
              .replace(/\s+/g, ' ') ===
            label,
        );

      if (!block) {
        return undefined;
      }

      const value =
        block
          .querySelector(
            'ul',
          )
          ?.textContent
          ?.replace(
            /\s+/g,
            ' ',
          )
          .trim();

      return (
        value ||
        undefined
      );
    },
    heading,
  );
}
private async text(
  page: Page,
  selector: string,
): Promise<
  string | undefined
> {
  const locator =
    page
      .locator(selector)
      .first();

  if (
    await locator.count() === 0
  ) {
    return undefined;
  }

  const value =
    await locator
      .innerText()
      .catch(
        () => '',
      );

  return (
    value
      .replace(/\s+/g, ' ')
      .trim() ||
    undefined
  );
}

private async href(
  page: Page,
  selector: string,
): Promise<
  string | undefined
> {
  const locator =
    page
      .locator(selector)
      .first();

  if (
    await locator.count() === 0
  ) {
    return undefined;
  }

  const href =
    await locator.getAttribute(
      'href',
    );

  if (!href) {
    return undefined;
  }

  return new URL(
    href,
    page.url(),
  ).href;
}
}