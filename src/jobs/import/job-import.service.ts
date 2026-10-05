import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';

import { JobRepository } from '../job-repository/job-repository.service';

import {
  JobImportAdapterRegistry,
} from './adapters/job-import-adapter.registry';

import {
  ImportedJobPayload,
  JobImportBody,
} from './job-import.types';

@Injectable()
export class JobImportService {
  private readonly logger =
    new Logger(
      JobImportService.name,
    );

  constructor(
    private readonly repository:
      JobRepository,

    private readonly adapters:
      JobImportAdapterRegistry,
  ) {}

  async import(
    body: JobImportBody,
  ) {
    const jobs =
      this.extractJobs(
        body,
      );

    const seen =
      new Set<string>();

    let imported =
      0;

    let skipped =
      0;

    let duplicates =
      0;

    let failed =
      0;

    const adapterStats:
      Record<
        string,
        number
      > = {};

    const errors:
      Array<{
        index: number;

        source?: string;

        externalId?: string;

        error: string;
      }> = [];

    this.logger.log(
      `Import received: ${jobs.length} jobs`,
    );

    for (
      let index = 0;
      index < jobs.length;
      index++
    ) {
      const raw =
        jobs[index];

      try {
        const adapter =
          this.adapters.resolve(
            raw,
          );

        /*
         * ไม่มี adapter รองรับ
         */
        if (!adapter) {
          skipped++;

          this.logger.warn(
            `No adapter index=${index} source=${raw.source ?? '?'} pageType=${raw.pageType ?? '?'}`,
          );

          continue;
        }

        adapterStats[
          adapter.name
        ] =
          (
            adapterStats[
              adapter.name
            ] ??
            0
          ) +
          1;

        this.logger.debug(
          `Import index=${index} adapter=${adapter.name}`,
        );

        const normalized =
          adapter.normalize(
            raw,
          );

        /*
         * Adapter ตัดสินว่า
         * ไม่ใช่ job
         */
        if (!normalized) {
          skipped++;

          this.logger.debug(
            `Skipped index=${index} adapter=${adapter.name}`,
          );

          continue;
        }

        /*
         * duplicate ภายใน request
         */
        const key =
          `${normalized.source}:${normalized.externalId}`;

        if (
          seen.has(
            key,
          )
        ) {
          duplicates++;

          this.logger.debug(
            `Duplicate in batch: ${key}`,
          );

          continue;
        }

        seen.add(
          key,
        );

        /*
         * DB upsert
         */
        await this.repository.upsert(
          normalized,
        );

        imported++;

        this.logger.log(
          `Imported ${normalized.source}:${normalized.externalId} | ${normalized.title} | adapter=${adapter.name}`,
        );
      } catch (error) {
        failed++;

        const message =
          error instanceof Error
            ? error.message
            : String(error);

        errors.push({
          index,

          source:
            raw.source ??
            undefined,

          externalId:
            raw.externalId ??
            undefined,

          error:
            message,
        });

        this.logger.error(
          `Import failed index=${index} source=${raw.source ?? '?'} externalId=${raw.externalId ?? '?'}`,
          error instanceof Error
            ? error.stack
            : String(error),
        );
      }
    }

    this.logger.log(
      `Import completed received=${jobs.length} imported=${imported} skipped=${skipped} duplicates=${duplicates} failed=${failed}`,
    );

    return {
      ok:
        failed === 0,

      count:
        imported,

      received:
        jobs.length,

      imported,

      skipped,

      duplicates,

      failed,

      adapters:
        adapterStats,

      errors:
        errors.slice(
          0,
          20,
        ),
    };
  }

  private extractJobs(
    body: JobImportBody,
  ): ImportedJobPayload[] {
    /*
     * POST [
     *   {...},
     *   {...}
     * ]
     */
    if (
      Array.isArray(
        body,
      )
    ) {
      return body;
    }

    /*
     * POST {
     *   jobs: [...]
     * }
     */
    if (
      body &&
      typeof body ===
        'object' &&
      Array.isArray(
        body.jobs,
      )
    ) {
      return body.jobs;
    }

    throw new BadRequestException(
      'Request body must be Job[] or { jobs: Job[] }',
    );
  }
}