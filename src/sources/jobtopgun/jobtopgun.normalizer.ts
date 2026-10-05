// src/sources/jobtopgun/jobtopgun.normalizer.ts

import {
  Injectable,
} from '@nestjs/common';

import {
  JobDto,
} from '../common/job.dto';

import {
  JobNormalizer,
} from '../common/job-normalizer.interface';

import {
  cleanLines,
  cleanText,
  extractTechnologies,
} from '../common/normalize.util';

import {
  JobTopGunRawJob,
} from './jobtopgun.types';

@Injectable()
export class JobTopGunNormalizer
  implements JobNormalizer<JobTopGunRawJob>
{
  normalize(
    raw: JobTopGunRawJob,
  ): JobDto {
    const title =
      cleanText(
        raw.detail.title ??
        raw.search.title,
      ) ?? '';

    const company =
      cleanText(
        raw.detail.company ??
        raw.search.company,
      );

    const location =
      cleanText(
        raw.detail.location ??
        raw.search.location,
      );

    const salaryText =
      cleanText(
        raw.detail.salary ??
        raw.search.salary,
      );

    const responsibilities =
      cleanLines(
        raw.detail.responsibilities,
      );

    const qualifications =
      cleanLines(
        raw.detail.qualifications,
      );

    const overview =
      cleanText(
        raw.detail.overview,
      );

    const description =
      [
        overview,

        responsibilities.length
          ? responsibilities.join('\n')
          : undefined,
      ]
        .filter(Boolean)
        .join('\n\n') ||
      undefined;

    const technologies =
      extractTechnologies(
        title,
        description,
        qualifications,
        raw.search.highlights,
      );

    return {
      source:
        'jobtopgun',

      externalId:
        raw.search.id,

      title,

      company,

      location,

      salaryText,

      description,

      requirements:
        qualifications,

      technologies,

      jobUrl:
        raw.detail.jobUrl ??
        raw.search.jobUrl,

      postedAt:
        this.parsePostedAt(
          raw.search.postedAt,
        ),
    };
  }

  /**
   * รองรับ:
   *
   * 2026-10-01
   * 2569-10-01
   */
  private parsePostedAt(
    value?: string,
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    const match =
      value.match(
        /^(\d{4})-(\d{2})-(\d{2})$/,
      );

    if (!match) {
      return undefined;
    }

    let year =
      Number(match[1]);

    const month =
      Number(match[2]);

    const day =
      Number(match[3]);

    /*
     * พ.ศ. -> ค.ศ.
     */
    if (year > 2400) {
      year -= 543;
    }

    const date =
      new Date(
        year,
        month - 1,
        day,
        0,
        0,
        0,
        0,
      );

    return Number.isNaN(
      date.getTime(),
    )
      ? undefined
      : date;
  }
}