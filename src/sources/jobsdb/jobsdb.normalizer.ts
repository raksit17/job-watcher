// src/sources/jobsdb/jobsdb.normalizer.ts

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
  JobsDbRawJob,
} from './jobsdb.types';

@Injectable()
export class JobsDbNormalizer
  implements JobNormalizer<JobsDbRawJob>
{
  normalize(
    raw: JobsDbRawJob,
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
        'jobsdb',

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

  /**
   * ตัวอย่าง:
   *
   * วันนี้
   * 1 วันที่ผ่านมา
   * 6 วันที่ผ่านมา
   * 3 ชั่วโมงที่ผ่านมา
   *
   * รองรับภาษาอังกฤษเผื่อ JobsDB
   * เปลี่ยน locale
   */
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
      text === 'today'
    ) {
      return now;
    }

    const thaiHours =
      text.match(
        /(\d+)\s*ชั่วโมงที่ผ่านมา/,
      );

    if (thaiHours) {
      const result =
        new Date(now);

      result.setHours(
        result.getHours() -
        Number(thaiHours[1]),
      );

      return result;
    }

    const thaiDays =
      text.match(
        /(\d+)\s*วันที่ผ่านมา/,
      );

    if (thaiDays) {
      const result =
        new Date(now);

      result.setDate(
        result.getDate() -
        Number(thaiDays[1]),
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
     * English locale
     *
     * 1d ago
     * 6d ago
     */
    const englishDays =
      text.match(
        /(\d+)\s*d(?:ays?)?\s*ago/,
      );

    if (englishDays) {
      const result =
        new Date(now);

      result.setDate(
        result.getDate() -
        Number(englishDays[1]),
      );

      result.setHours(
        0,
        0,
        0,
        0,
      );

      return result;
    }

    return undefined;
  }
}