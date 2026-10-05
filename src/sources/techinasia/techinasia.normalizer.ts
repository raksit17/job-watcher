// src/sources/techinasia/techinasia.normalizer.ts

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
  TechInAsiaRawJob,
} from './techinasia.types';

@Injectable()
export class TechInAsiaNormalizer
  implements JobNormalizer<TechInAsiaRawJob>
{
  normalize(
    raw: TechInAsiaRawJob,
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

    const requirements =
      cleanLines(
        raw.detail.requirements,
      );

    const description =
      cleanText(
        raw.detail.description,
      ) ??
      (
        responsibilities.length
          ? responsibilities.join('\n')
          : undefined
      );

    /*
     * Tech in Asia มี Required skills
     * แยกชัดเจนใน detail
     */
    const detected =
      extractTechnologies(
        title,
        description,
        requirements,
        responsibilities,
        raw.detail.skills,
      );

    const technologies =
      Array.from(
        new Set(
          [
            ...raw.detail.skills,
            ...detected,
          ]
            .map(value =>
              cleanText(value),
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(value),
            ),
        ),
      );

    return {
      source:
        'techinasia',

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
        this.parsePostedAt(
          raw.search.postedAt,
        ),
    };
  }

  /**
   * Tech in Asia:
   *
   * 2026-09-18 07:42:08
   */
  private parsePostedAt(
    value?: string,
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    const match =
      value.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
      );

    if (!match) {
      return undefined;
    }

    const year =
      Number(match[1]);

    const month =
      Number(match[2]);

    const day =
      Number(match[3]);

    const hour =
      Number(match[4]);

    const minute =
      Number(match[5]);

    const second =
      Number(match[6]);

    const result =
      new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        second,
        0,
      );

    return Number.isNaN(
      result.getTime(),
    )
      ? undefined
      : result;
  }
}