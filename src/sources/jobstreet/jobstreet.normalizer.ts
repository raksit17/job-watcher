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
  JobStreetRawJob,
} from './jobstreet.types';

@Injectable()
export class JobStreetNormalizer
  implements JobNormalizer<JobStreetRawJob>
{
  normalize(
    raw: JobStreetRawJob,
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

    const description =
      cleanText(
        raw.detail.description ??
        raw.search.shortDescription,
      );

    const requirements =
      cleanLines(
        raw.detail.bullets,
      );

    const technologies =
      extractTechnologies(
        title,
        description,
        requirements,
      );

    return {
      source:
        'jobstreet',

      externalId:
        raw.search.id,

      title,

      company,

      location,

      salaryText,

      description,

      requirements,

      technologies,

      jobUrl:
        raw.detail.jobUrl ??
        raw.search.jobUrl,

      postedAt:
        this.parseRelativeDate(
          raw.search.listedText,
        ),
    };
  }

  private parseRelativeDate(
    value?: string,
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    const text =
      value
        .trim()
        .toLowerCase();

    const now =
      new Date();

    /*
     * 12h ago
     */
    const hours =
      text.match(
        /(\d+)\s*h(?:ours?)?\s*ago/,
      );

    if (hours) {
      const result =
        new Date(now);

      result.setHours(
        result.getHours() -
        Number(hours[1]),
      );

      return result;
    }

    /*
     * 3d ago
     */
    const days =
      text.match(
        /(\d+)\s*d(?:ays?)?\s*ago/,
      );

    if (days) {
      const result =
        new Date(now);

      result.setDate(
        result.getDate() -
        Number(days[1]),
      );

      result.setHours(
        0,
        0,
        0,
        0,
      );

      return result;
    }

    /*
     * 30d+ ago
     */
    const daysPlus =
      text.match(
        /(\d+)\s*d\+\s*ago/,
      );

    if (daysPlus) {
      const result =
        new Date(now);

      result.setDate(
        result.getDate() -
        Number(daysPlus[1]),
      );

      result.setHours(
        0,
        0,
        0,
        0,
      );

      return result;
    }

    if (
      text === 'today' ||
      text === 'วันนี้'
    ) {
      now.setHours(
        0,
        0,
        0,
        0,
      );

      return now;
    }

    return undefined;
  }
}