// src/sources/workventure/workventure.normalizer.ts

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
  WorkVentureRawJob,
} from './workventure.types';

@Injectable()
export class WorkVentureNormalizer
  implements JobNormalizer<WorkVentureRawJob>
{
  normalize(
    raw: WorkVentureRawJob,
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

    const description =
      responsibilities.length
        ? responsibilities.join('\n')
        : undefined;

    const technologies =
      extractTechnologies(
        title,
        description,
        qualifications,
        raw.search.skills,
      );

    return {
      source:
        'workventure',

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
        this.parseRelativeDate(
          raw.search.postedText,
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

    if (
      text === 'วันนี้' ||
      text.includes('เพิ่งประกาศ')
    ) {
      now.setHours(
        0,
        0,
        0,
        0,
      );

      return now;
    }

    const days =
      text.match(
        /(\d+)\s*วันที่ผ่านมา/,
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

    const hours =
      text.match(
        /(\d+)\s*ชั่วโมงที่ผ่านมา/,
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

    return undefined;
  }
}