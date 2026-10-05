import { Injectable } from '@nestjs/common';

import { ImportedJobPayload } from '../job-import.types';

import { GenericJobImportAdapter } from './generic/generic-job-import.adapter';

import { JobImportAdapter } from './job-import-adapter.interface';

import { LinkedInFeedImportAdapter } from './linkedin/linkedin-feed-import.adapter';

@Injectable()
export class JobImportAdapterRegistry {
  private readonly adapters: JobImportAdapter[];

  constructor(
    linkedInFeed: LinkedInFeedImportAdapter,

    generic: GenericJobImportAdapter,
  ) {
    /*
     * สำคัญ:หหก
     * specific adapter
     * ต้องอยู่ก่อน generic
     */
    this.adapters = [linkedInFeed, generic];
  }

  resolve(raw: ImportedJobPayload): JobImportAdapter | undefined {
    return this.adapters.find((adapter) => adapter.supports(raw));
  }

  getNames(): string[] {
    return this.adapters.map((adapter) => adapter.name);
  }
}
