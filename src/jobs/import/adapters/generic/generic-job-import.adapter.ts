import { Injectable } from '@nestjs/common';

import { JobDto } from '../../../../sources/common/job.dto';

import { ImportedJobPayload } from '../../job-import.types';

import {
  cleanMultiline,
  cleanText,
  cleanUrl,
  createStableExternalId,
  inferSourceFromUrl,
  parseDateValue,
  toStringArray,
  uniqueStrings,
} from '../../utils/import-normalize.util';

import { JobImportAdapter } from '../job-import-adapter.interface';

@Injectable()
export class GenericJobImportAdapter implements JobImportAdapter {
  readonly name = 'generic';

  supports(raw: ImportedJobPayload): boolean {
    /*
     * อย่างน้อยต้องมี title
     * และรู้ว่า source ไหน
     */
    const source = cleanText(raw.source) ?? inferSourceFromUrl(raw.jobUrl);

    return Boolean(source && cleanText(raw.title) && cleanUrl(raw.jobUrl));
  }

  normalize(raw: ImportedJobPayload): JobDto | undefined {
    const jobUrl = cleanUrl(raw.jobUrl);

    const title = cleanText(raw.title);

    const source = (
      cleanText(raw.source) ?? inferSourceFromUrl(jobUrl)
    )?.toLowerCase();

    if (!source || !title || !jobUrl) {
      return undefined;
    }

    const description = cleanMultiline(raw.description);

    const requirements = uniqueStrings(toStringArray(raw.requirements));

    const technologies = uniqueStrings(toStringArray(raw.technologies));

    const externalId =
      cleanText(raw.externalId) ??
      createStableExternalId(source, jobUrl, title, raw.company);

    return {
      source,

      externalId,

      title,

      company: cleanText(raw.company),

      location: cleanText(raw.location),

      salaryText: cleanText(raw.salaryText),

      description,

      requirements,

      technologies,

      jobUrl,

      postedAt: parseDateValue(raw.postedAt),

      /*
       * ถ้า JobDto ของคุณเพิ่ม fields พวกนี้แล้ว
       */
      contacts: uniqueStrings([
        ...toStringArray(raw.contact),

        ...toStringArray(raw.contacts),
      ]),

      emails: uniqueStrings([
        ...toStringArray(raw.email),

        ...toStringArray(raw.emails),
      ]),

      contractText: cleanText(raw.contractText ?? raw.contract),

      postedBy: cleanText(raw.postedBy),

      posterProfileUrl: cleanUrl(raw.posterProfileUrl),

      imageUrls: uniqueStrings([
        ...toStringArray(raw.imageUrls),

        ...toStringArray(raw.images),
      ]),
    };
  }
}
