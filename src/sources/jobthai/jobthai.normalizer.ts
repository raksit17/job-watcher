import {
  JobNormalizer,
} from '../common/job-normalizer.interface';

import {
  JobDto,
} from '../common/job.dto';

import {
  cleanLines,
  cleanText,
  extractTechnologies,
} from '../common/normalize.util';

import {
  JobThaiRawJob,
} from './jobthai.types';

export class JobThaiNormalizer
  implements JobNormalizer<JobThaiRawJob>
{
  normalize(
    raw: JobThaiRawJob,
  ): JobDto {
    const title =
      cleanText(
        raw.detailPage.title ??
        raw.companyPage.title ??
        raw.search.title,
      ) ?? '';

    const company =
      cleanText(
        raw.detailPage.company ??
        raw.companyPage.company ??
        raw.search.company,
      );

    const location =
      cleanText(
        raw.detailPage.workLocation ??
        raw.detailPage.location ??
        raw.companyPage.location ??
        raw.search.location,
      );

    const salaryText =
      cleanText(
        raw.detailPage.salary ??
        raw.companyPage.salary ??
        raw.search.salary,
      );

    const description =
      cleanText(
        raw.detailPage.description ??
        raw.companyPage.summary,
      );

    const requirements =
      cleanLines(
        raw.detailPage.requirements,
      );

    const jobUrl =
      raw.detailPage.detailUrl ??
      raw.companyPage.detailUrl ??
      raw.search.companyJobUrl;

    const technologies =
      extractTechnologies(
        title,
        description,
        requirements,
      );

    return {
      source:
        'jobthai',

      externalId:
        raw.search.id,

      title,

      company,

      location,

      salaryText,

      description,

      requirements,

      technologies,

      jobUrl,

      postedAt:
        this.parseJobThaiDate(
          raw.detailPage.postedAt ??
          raw.companyPage.postedAt,
        ),


    };
  }

  private parseJobThaiDate(
    value?: string,
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    const months: Record<
      string,
      number
    > = {
      'ม.ค.': 0,
      'ก.พ.': 1,
      'มี.ค.': 2,
      'เม.ย.': 3,
      'พ.ค.': 4,
      'มิ.ย.': 5,
      'ก.ค.': 6,
      'ส.ค.': 7,
      'ก.ย.': 8,
      'ต.ค.': 9,
      'พ.ย.': 10,
      'ธ.ค.': 11,
    };

    const match =
      value
        .trim()
        .match(
          /^(\d{1,2})\s+([^\s]+)\s+(\d{2,4})$/,
        );

    if (!match) {
      return undefined;
    }

    const day =
      Number(match[1]);

    const month =
      months[match[2]];

    let year =
      Number(match[3]);

    if (
      month === undefined ||
      Number.isNaN(day) ||
      Number.isNaN(year)
    ) {
      return undefined;
    }

    if (year < 100) {
      year += 2500;
    }

    year -= 543;

    const result =
      new Date(
        year,
        month,
        day,
      );

    return Number.isNaN(
      result.getTime(),
    )
      ? undefined
      : result;
  }
}