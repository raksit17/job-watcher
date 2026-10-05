// src/sources/arc/arc.normalizer.ts

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
  ArcRawJob,
} from './arc.types';

@Injectable()
export class ArcNormalizer
  implements JobNormalizer<ArcRawJob>
{
  normalize(
    raw: ArcRawJob,
  ): JobDto {
    const title =
      cleanText(
        raw.detail.title ??
        raw.search.title,
      ) ?? '';

    const company =
      cleanText(
        raw.detail.companyName ??
        raw.detail.company?.name ??
        raw.search.company.name,
      );

    /*
     * Arc เป็น remote board
     *
     * location ที่เหมาะสุดคือ
     * requiredCountries
     */
    const countries =
      raw.detail.requiredCountries?.length
        ? raw.detail.requiredCountries
        : raw.search.requiredCountries;

    const location =
      countries.length
        ? `Remote - ${countries.join(', ')}`
        : 'Remote';

    /*
     * description จาก Arc มี HTML
     */
    const description =
      cleanText(
        this.htmlToText(
          raw.detail.description,
        ),
      );

    const requirements =
      this.extractRequirements(
        raw.detail.description,
      );

    const techStack =
      raw.detail.techStackDetails
        ?.map(item =>
          item.name,
        ) ?? [];

    const detected =
      extractTechnologies(
        title,
        description,
        requirements,
        techStack,
      );

    const technologies =
      Array.from(
        new Set([
          ...techStack,
          ...detected,
        ]),
      );

    return {
      source:
        'arc',

      externalId:
        raw.detail.randomKey ??
        raw.search.randomKey,

      title,

      company,

      location,

      /*
       * Arc detail ตัวอย่าง
       * Salary Estimate = N/A
       *
       * ยังไม่ควรเอา salary estimate
       * มาปนเป็น salary จริง
       */
      salaryText:
        undefined,

      description,

      requirements:
        cleanLines(
          requirements,
        ),

      technologies,

      jobUrl:
        raw.search.jobUrl,

      postedAt:
        this.parseUnixTimestamp(
          raw.detail.postedAt ??
          raw.search.postedAt,
        ),
    };
  }

  private parseUnixTimestamp(
    value?: number,
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    const result =
      new Date(
        value * 1000,
      );

    return Number.isNaN(
      result.getTime(),
    )
      ? undefined
      : result;
  }

  private htmlToText(
    value?: string,
  ): string | undefined {
    if (!value) {
      return undefined;
    }

    const result =
      value
        .replace(
          /<br\s*\/?>/gi,
          '\n',
        )
        .replace(
          /<\/p>/gi,
          '\n',
        )
        .replace(
          /<\/li>/gi,
          '\n',
        )
        .replace(
          /<[^>]+>/g,
          '',
        )
        .replace(
          /&nbsp;/gi,
          ' ',
        )
        .replace(
          /&amp;/gi,
          '&',
        )
        .replace(
          /\n{3,}/g,
          '\n\n',
        )
        .trim();

    return (
      result ||
      undefined
    );
  }

  private extractRequirements(
    html?: string,
  ): string[] {
    if (!html) {
      return [];
    }

    const text =
      this.htmlToText(
        html,
      );

    if (!text) {
      return [];
    }

    /*
     * Arc แต่ละบริษัทตั้ง heading
     * ไม่เหมือนกัน เช่น
     *
     * What We're Looking For
     * Requirements
     * Qualifications
     */
    const headings = [
      'What We’re Looking For',
      "What We're Looking For",
      'Requirements',
      'Qualifications',
      'What You Bring',
      'What we are looking for',
    ];

    for (const heading of headings) {
      const index =
        text
          .toLowerCase()
          .indexOf(
            heading.toLowerCase(),
          );

      if (index === -1) {
        continue;
      }

      const section =
        text.substring(
          index +
          heading.length,
        );

      /*
       * ตัด section ถัดไป
       */
      const stopHeadings = [
        'Nice to Have',
        'Benefits',
        'What We Offer',
        'Your Adventure Benefits',
        'About Us',
      ];

      let end =
        section.length;

      for (
        const stop
        of stopHeadings
      ) {
        const stopIndex =
          section
            .toLowerCase()
            .indexOf(
              stop.toLowerCase(),
            );

        if (
          stopIndex !== -1 &&
          stopIndex < end
        ) {
          end =
            stopIndex;
        }
      }

      return section
        .substring(
          0,
          end,
        )
        .split('\n')
        .map(value =>
          value
            .replace(
              /^[*•\-]\s*/,
              '',
            )
            .trim(),
        )
        .filter(Boolean);
    }

    return [];
  }
}