import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  PrismaService,
} from '../../database/prisma/prisma.service';

import {
  JobDto,
} from '../../sources/common/job.dto';

import {
  sanitizeUnicode,
} from '../import/utils/import-normalize.util';

@Injectable()
export class JobRepository {
  private readonly logger =
    new Logger(
      JobRepository.name,
    );

  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async upsert(
    job: JobDto,
  ) {
    const now =
      new Date();

    /*
     * Debug ก่อน sanitize
     *
     * เอาไว้ดูว่า field ไหน
     * มี broken Unicode
     */
    this.logBrokenUnicode(
      job,
    );

    /*
     * Safety ชั้นสุดท้าย
     *
     * ทุก string ต้องผ่าน
     * sanitizeUnicode ก่อน Prisma
     */
    const safe = {
      ...job,

      source:
        sanitizeUnicode(
          job.source,
        ),

      externalId:
        sanitizeUnicode(
          job.externalId,
        ),

      title:
        sanitizeUnicode(
          job.title,
        ),

      company:
        this.sanitizeString(
          job.company,
        ),

      location:
        this.sanitizeString(
          job.location,
        ),

      salaryText:
        this.sanitizeString(
          job.salaryText,
        ),

      description:
        this.sanitizeString(
          job.description,
        ),

      requirements:
        this.sanitizeStrings(
          job.requirements,
        ),

      technologies:
        this.sanitizeStrings(
          job.technologies,
        ),

      jobUrl:
        sanitizeUnicode(
          job.jobUrl,
        ),

      /*
       * Import / LinkedIn fields
       */
      contacts:
        this.sanitizeStrings(
          job.contacts,
        ),

      emails:
        this.sanitizeStrings(
          job.emails,
        ),

      contractText:
        this.sanitizeString(
          job.contractText,
        ),

      postedBy:
        this.sanitizeString(
          job.postedBy,
        ),

      posterProfileUrl:
        this.sanitizeString(
          job.posterProfileUrl,
        ),

      imageUrls:
        this.sanitizeStrings(
          job.imageUrls,
        ),
    };

    return this.prisma.job.upsert({
      where: {
        source_externalId: {
          source:
            safe.source,

          externalId:
            safe.externalId,
        },
      },

      /*
       * งานใหม่
       */
      create: {
        source:
          safe.source,

        externalId:
          safe.externalId,

        title:
          safe.title,

        company:
          safe.company,

        location:
          safe.location,

        salaryText:
          safe.salaryText,

        description:
          safe.description,

        requirements:
          safe.requirements,

        technologies:
          safe.technologies,

        jobUrl:
          safe.jobUrl,

        postedAt:
          safe.postedAt,

        /*
         * Imported/social fields
         */
        contacts:
          safe.contacts ?? [],

        emails:
          safe.emails ?? [],

        contractText:
          safe.contractText,

        postedBy:
          safe.postedBy,

        posterProfileUrl:
          safe.posterProfileUrl,

        imageUrls:
          safe.imageUrls ?? [],

        /*
         * discoveredAt
         * ไม่ต้องใส่
         *
         * Prisma:
         * @default(now())
         */

        lastSeenAt:
          now,

        isActive:
          true,
      },

      /*
       * งานเดิม
       */
      update: {
        title:
          safe.title,

        company:
          safe.company,

        location:
          safe.location,

        salaryText:
          safe.salaryText,

        description:
          safe.description,

        requirements:
          safe.requirements,

        technologies:
          safe.technologies,

        jobUrl:
          safe.jobUrl,

        postedAt:
          safe.postedAt,

        contacts:
          safe.contacts ?? [],

        emails:
          safe.emails ?? [],

        contractText:
          safe.contractText,

        postedBy:
          safe.postedBy,

        posterProfileUrl:
          safe.posterProfileUrl,

        imageUrls:
          safe.imageUrls ?? [],

        /*
         * ห้าม update discoveredAt
         */

        lastSeenAt:
          now,

        isActive:
          true,
      },
    });
  }

  async upsertMany(
    jobs: JobDto[],
  ): Promise<void> {
    if (
      jobs.length === 0
    ) {
      return;
    }

    this.logger.log(
      `Saving ${jobs.length} jobs...`,
    );

    let saved =
      0;

    let failed =
      0;

    for (const job of jobs) {
      try {
        await this.upsert(
          job,
        );

        saved++;
      } catch (error) {
        failed++;

        this.logger.error(
          `Cannot save ${job.source}:${job.externalId}`,
          error instanceof Error
            ? error.stack
            : String(error),
        );
      }
    }

    this.logger.log(
      `Finished saving jobs: saved=${saved}, failed=${failed}, total=${jobs.length}`,
    );
  }

  /*
   * =========================================
   * Unicode Safety
   * =========================================
   */

  private sanitizeString(
    value?: string | null,
  ): string | undefined {
    if (
      value === undefined ||
      value === null
    ) {
      return undefined;
    }

    return sanitizeUnicode(
      value,
    );
  }

  private sanitizeStrings(
    values?: string[],
  ): string[] {
    if (!values) {
      return [];
    }

    return values
      .map(value =>
        sanitizeUnicode(
          value,
        ),
      )
      .filter(Boolean);
  }

  /*
   * เช็กว่ามี surrogate ที่เสียหรือไม่
   *
   * เช่น emoji ถูกตัดครึ่ง
   */
  private hasBrokenSurrogate(
    value?: string | null,
  ): boolean {
    if (!value) {
      return false;
    }

    for (
      let i = 0;
      i < value.length;
      i++
    ) {
      const code =
        value.charCodeAt(i);

      /*
       * High surrogate
       */
      if (
        code >= 0xd800 &&
        code <= 0xdbff
      ) {
        const next =
          i + 1 < value.length
            ? value.charCodeAt(i + 1)
            : -1;

        /*
         * ไม่มี low surrogate
         * ตามมา
         */
        if (
          next < 0xdc00 ||
          next > 0xdfff
        ) {
          return true;
        }

        /*
         * เป็น pair ที่ถูกต้อง
         * ข้ามตัวถัดไป
         */
        i++;

        continue;
      }

      /*
       * เจอ low surrogate
       * โดยไม่มี high surrogate
       */
      if (
        code >= 0xdc00 &&
        code <= 0xdfff
      ) {
        return true;
      }
    }

    return false;
  }

  private logBrokenUnicode(
    job: JobDto,
  ): void {
    const fields: Array<
      [
        string,
        string | null | undefined,
      ]
    > = [
      [
        'source',
        job.source,
      ],

      [
        'externalId',
        job.externalId,
      ],

      [
        'title',
        job.title,
      ],

      [
        'company',
        job.company,
      ],

      [
        'location',
        job.location,
      ],

      [
        'salaryText',
        job.salaryText,
      ],

      [
        'description',
        job.description,
      ],

      [
        'jobUrl',
        job.jobUrl,
      ],

      [
        'contractText',
        job.contractText,
      ],

      [
        'postedBy',
        job.postedBy,
      ],

      [
        'posterProfileUrl',
        job.posterProfileUrl,
      ],
    ];

    for (
      const [
        name,
        value,
      ]
      of fields
    ) {
      if (
        this.hasBrokenSurrogate(
          value,
        )
      ) {
        this.logger.warn(
          `Broken unicode externalId=${job.externalId} field=${name}`,
        );
      }
    }

    /*
     * Array fields
     */
    this.logBrokenUnicodeArray(
      job.externalId,
      'requirements',
      job.requirements,
    );

    this.logBrokenUnicodeArray(
      job.externalId,
      'technologies',
      job.technologies,
    );

    this.logBrokenUnicodeArray(
      job.externalId,
      'contacts',
      job.contacts,
    );

    this.logBrokenUnicodeArray(
      job.externalId,
      'emails',
      job.emails,
    );

    this.logBrokenUnicodeArray(
      job.externalId,
      'imageUrls',
      job.imageUrls,
    );
  }

  private logBrokenUnicodeArray(
    externalId: string,
    field:
      string,
    values?:
      string[],
  ): void {
    if (!values) {
      return;
    }

    for (
      let index = 0;
      index < values.length;
      index++
    ) {
      if (
        this.hasBrokenSurrogate(
          values[index],
        )
      ) {
        this.logger.warn(
          `Broken unicode externalId=${externalId} field=${field}[${index}]`,
        );
      }
    }
  }
}