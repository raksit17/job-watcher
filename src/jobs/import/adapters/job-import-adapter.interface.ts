import { JobDto } from '../../../sources/common/job.dto';

import { ImportedJobPayload } from '../job-import.types';

export interface JobImportAdapter {
  readonly name: string;

  /**
   * Adapter นี้รับ payload นี้หรือไม่
   */
  supports(raw: ImportedJobPayload): boolean;

  /**
   * undefined =
   * payload นี้ไม่ควรบันทึกเป็น job
   */
  normalize(raw: ImportedJobPayload): JobDto | undefined;
}
