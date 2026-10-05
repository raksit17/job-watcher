// src/source/common/job-normalizer.interface.ts

import { JobDto } from './job.dto';

export interface JobNormalizer<TRaw> {
  normalize(
    raw: TRaw,
  ): JobDto;
}