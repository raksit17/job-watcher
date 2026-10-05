import {
  Injectable,
} from '@nestjs/common';

import {
  JobDto,
} from '../../../../sources/common/job.dto';

import {
  ImportedJobPayload,
} from '../../job-import.types';

import {
  cleanMultiline,
  cleanText,
  cleanTrackingUrl,
  cleanUrl,
  createStableExternalId,
  parseDateValue,
  toStringArray,
  uniqueStrings,
} from '../../utils/import-normalize.util';

import {
  JobImportAdapter,
} from '../job-import-adapter.interface';

@Injectable()
export class LinkedInFeedImportAdapter
  implements JobImportAdapter
{
  readonly name =
    'linkedin-feed';

  supports(
    raw: ImportedJobPayload,
  ): boolean {
    const source =
      cleanText(
        raw.source,
      )?.toLowerCase();

    if (
      source !==
      'linkedin'
    ) {
      return false;
    }

    /*
     * Extension รุ่นใหม่
     */
    if (
      raw.pageType ===
      'feed'
    ) {
      return true;
    }

    /*
     * backward compatibility
     */
    if (
      raw.externalId
        ?.startsWith(
          'feed-',
        )
    ) {
      return true;
    }

    return Boolean(
      raw.jobUrl &&
      /linkedin\.com\/feed/i.test(
        raw.jobUrl,
      ),
    );
  }

  normalize(
    raw: ImportedJobPayload,
  ): JobDto | undefined {
    const description =
      cleanMultiline(
        raw.description,
      );

    /*
     * LinkedIn Feed มีโพสต์ทั่วไป
     * ไม่ใช่งานเยอะ
     */
    if (
      !this.isLikelyJobPost(
        raw,
        description,
      )
    ) {
      return undefined;
    }

    const title =
      this.resolveTitle(
        raw,
        description,
      );

    if (!title) {
      return undefined;
    }

    const jobUrl =
      this.resolveJobUrl(
        raw,
      );

    const externalId =
      this.resolveExternalId(
        raw,
        jobUrl,
        title,
        description,
      );

    const requirements =
      this.resolveRequirements(
        raw,
        description,
      );

    /*
     * ไม่เชื่อ technologies จาก extension ตรง ๆ
     * เพราะ Feed มี false positive ง่าย
     */
    const technologies =
      this.extractTechnologies(
        [
          title,
          description,
          ...requirements,
        ]
          .filter(Boolean)
          .join('\n'),
      );

    return {
      source:
        'linkedin',

      externalId,

      title,

      company:
        this.resolveCompany(
          raw,
        ),

      location:
        this.resolveLocation(
          raw.location,
          description,
        ),

      salaryText:
        this.resolveSalary(
          raw.salaryText,
          description,
        ),

      description,

      requirements,

      technologies,

      jobUrl,

      postedAt:
        this.resolvePostedAt(
          raw.postedAt,
          description,
        ),

      contacts:
        this.resolveContacts(
          raw,
        ),

      emails:
        this.resolveEmails(
          raw,
          description,
        ),

      contractText:
        this.resolveContract(
          raw,
          description,
        ),

      postedBy:
        cleanText(
          raw.postedBy,
        ),

      posterProfileUrl:
        cleanUrl(
          raw.posterProfileUrl,
        ),

      imageUrls:
        uniqueStrings([
          ...toStringArray(
            raw.imageUrls,
          ),

          ...toStringArray(
            raw.images,
          ),
        ]),
    };
  }

  /*
   * ------------------------------------------------
   * Detect Job Post
   * ------------------------------------------------
   */

  private isLikelyJobPost(
    raw: ImportedJobPayload,
    description?: string,
  ): boolean {
    /*
     * ถ้ามี LinkedIn Job URL
     * ถือว่า strong signal
     */
    const urls = [
      ...toStringArray(
        raw.contact,
      ),

      ...toStringArray(
        raw.contacts,
      ),
    ];

    if (
      urls.some(value =>
        /linkedin\.com\/jobs\/view\/\d+/i.test(
          value,
        ),
      )
    ) {
      return true;
    }

    const content =
      [
        raw.title,
        description,
      ]
        .filter(Boolean)
        .join('\n');

    return (
      /\bwe(?:'|’)re\s+hiring\b/i.test(
        content,
      ) ||

      /\bwe\s+are\s+hiring\b/i.test(
        content,
      ) ||

      /\bnow\s+hiring\b/i.test(
        content,
      ) ||

      /\bjoin\s+my\s+team\b/i.test(
        content,
      ) ||

      /\blooking\s+for\s+(?:an?|experienced|passionate|talented)/i.test(
        content,
      ) ||

      /\bopen\s+position/i.test(
        content,
      ) ||

      /\bjob\s+opening/i.test(
        content,
      ) ||

      /เปิดรับสมัคร/i.test(
        content,
      ) ||

      /รับสมัคร/i.test(
        content,
      ) ||

      /กำลังมองหา.+ร่วมทีม/i.test(
        content,
      )
    );
  }

  /*
   * ------------------------------------------------
   * Title
   * ------------------------------------------------
   */

  private resolveTitle(
    raw: ImportedJobPayload,
    description?: string,
  ): string | undefined {
    const existing =
      cleanText(
        raw.title,
      );

    /*
     * ถ้า extension หา title ได้แล้ว
     */
    if (
      existing &&
      !this.isGenericTitle(
        existing,
      )
    ) {
      return existing;
    }

    if (!description) {
      return existing;
    }

    const lines =
      description
        .split('\n')
        .map(line =>
          line.trim(),
        )
        .filter(Boolean);

    for (const line of lines) {
      /*
       * We're Hiring: Backend Developer
       *
       * We’re Hiring – Power BI Analyst
       */
      const hiring =
        line.match(
          /(?:we(?:'|’)re|we\s+are|now)\s+hiring\s*(?:[:|–—-]\s*)?(.+)/i,
        );

      if (
        hiring?.[1] &&
        hiring[1].length <= 180
      ) {
        return cleanText(
          hiring[1],
        );
      }

      /*
       * เปิดรับสมัคร BI Developer
       */
      const thai =
        line.match(
          /(?:เปิดรับสมัคร|รับสมัคร)\s*[:|–—-]?\s*(.+)/i,
        );

      if (
        thai?.[1] &&
        thai[1].length <= 180
      ) {
        return cleanText(
          thai[1],
        );
      }
    }

    return existing;
  }

  private isGenericTitle(
    value: string,
  ): boolean {
    return (
      /^linkedin\s+job\s+post$/i.test(
        value,
      ) ||

      /^job\s+post$/i.test(
        value,
      )
    );
  }

  /*
   * ------------------------------------------------
   * Company
   * ------------------------------------------------
   */

  private resolveCompany(
    raw: ImportedJobPayload,
  ): string | undefined {
    const direct =
      cleanText(
        raw.company,
      );

    if (direct) {
      return direct;
    }

    /*
     * ถ้าคนโพสต์เป็น LinkedIn Company page
     */
    if (
      raw.posterProfileUrl &&
      /linkedin\.com\/company\//i.test(
        raw.posterProfileUrl,
      )
    ) {
      return cleanText(
        raw.postedBy,
      );
    }

    /*
     * ถ้าเป็น recruiter profile
     * ไม่เดาบริษัท
     */
    return undefined;
  }

  /*
   * ------------------------------------------------
   * URL
   * ------------------------------------------------
   */

  private resolveJobUrl(
    raw: ImportedJobPayload,
  ): string {
    const links = [
      ...toStringArray(
        raw.contact,
      ),

      ...toStringArray(
        raw.contacts,
      ),
    ];

    /*
     * ถ้า feed มี LinkedIn Job detail
     * ใช้อันนี้แทน /feed/
     */
    const linkedInJob =
      links.find(value =>
        /linkedin\.com\/jobs\/view\/\d+/i.test(
          value,
        ),
      );

    if (linkedInJob) {
      return cleanTrackingUrl(
        linkedInJob,
      );
    }

    return (
      cleanUrl(
        raw.jobUrl,
      ) ??
      'https://www.linkedin.com/feed/'
    );
  }

  /*
   * ------------------------------------------------
   * External ID
   * ------------------------------------------------
   */

  private resolveExternalId(
    raw: ImportedJobPayload,
    jobUrl: string,
    title: string,
    description?: string,
  ): string {
    const linkedInJobId =
      jobUrl.match(
        /\/jobs\/view\/(\d+)/i,
      )?.[1];

    if (linkedInJobId) {
      return (
        `job-${linkedInJobId}`
      );
    }

    const existing =
      cleanText(
        raw.externalId,
      );

    if (existing) {
      return existing;
    }

    return createStableExternalId(
      'feed',
      raw.posterProfileUrl,
      title,
      description,
    );
  }

  /*
   * ------------------------------------------------
   * Requirements
   * ------------------------------------------------
   */

  private resolveRequirements(
    raw: ImportedJobPayload,
    description?: string,
  ): string[] {
    const fromPayload =
      toStringArray(
        raw.requirements,
      )
        .map(value =>
          this.cleanRequirement(
            value,
          ),
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        )
        .filter(value =>
          !this.isUiNoise(
            value,
          ),
        );

    const fromDescription =
      this.extractRequirementsFromDescription(
        description,
      );

    return uniqueStrings([
      ...fromPayload,
      ...fromDescription,
    ]);
  }

  private extractRequirementsFromDescription(
    description?: string,
  ): string[] {
    if (!description) {
      return [];
    }

    const lines =
      description
        .split('\n')
        .map(value =>
          value.trim(),
        );

    const result:
      string[] = [];

    let collecting =
      false;

    for (const line of lines) {
      if (!line) {
        continue;
      }

      if (
        /^(?:requirements?|qualifications?|what\s+we(?:'|’)re\s+looking\s+for|คุณสมบัติ(?:เด่น)?)[：:]?$/i.test(
          line,
        )
      ) {
        collecting =
          true;

        continue;
      }

      if (!collecting) {
        continue;
      }

      /*
       * stop section
       */
      if (
        /^(?:benefits?|how\s+to\s+apply|interested|apply|contact|salary|location)[：:]?/i.test(
          line,
        ) ||

        /^📩/.test(
          line,
        ) ||

        /^#/.test(
          line,
        )
      ) {
        break;
      }

      const cleaned =
        this.cleanRequirement(
          line,
        );

      if (
        cleaned &&
        !this.isUiNoise(
          cleaned,
        )
      ) {
        result.push(
          cleaned,
        );
      }
    }

    return uniqueStrings(
      result,
    );
  }

  private cleanRequirement(
    value: string,
  ): string | undefined {
    const cleaned =
      value
        .replace(
          /^[✅🔹▪︎⁞•⭐✔️☑️\-–—]+\s*/,
          '',
        )
        .trim();

    return cleaned || undefined;
  }

  private isUiNoise(
    value: string,
  ): boolean {
    const text =
      value.trim();

    return (
      /^…?\s*เพิ่มเติม$/i.test(
        text,
      ) ||

      /การแสดงความรู้สึก/i.test(
        text,
      ) ||

      /^\d+\s*ความคิดเห็น$/i.test(
        text,
      ) ||

      /^\d+\s*รีโพสต์$/i.test(
        text,
      ) ||

      /^แสดงความคิดเห็น$/i.test(
        text,
      ) ||

      /^รีโพสต์$/i.test(
        text,
      ) ||

      /^ชอบ$/i.test(
        text,
      ) ||

      /^ส่ง$/i.test(
        text,
      ) ||

      /^ดูงาน$/i.test(
        text,
      )
    );
  }

  /*
   * ------------------------------------------------
   * Technologies
   * ------------------------------------------------
   */

  private extractTechnologies(
    content: string,
  ): string[] {
    const technologies:
      Array<[
        string,
        RegExp,
      ]> = [
        [
          'NestJS',
          /\bnest(?:\.?\s*)js\b/i,
        ],

        [
          'Node.js',
          /\bnode(?:\.?\s*)js\b/i,
        ],

        [
          'TypeScript',
          /\btypescript\b/i,
        ],

        [
          'JavaScript',
          /\bjavascript\b/i,
        ],

        [
          'Next.js',
          /\bnext(?:\.?\s*)js\b/i,
        ],

        [
          'React',
          /\breact(?:\.js)?\b/i,
        ],

        [
          'Vue',
          /\bvue(?:\.js)?\b/i,
        ],

        [
          'Angular',
          /\bangular\b/i,
        ],

        [
          'PostgreSQL',
          /\bpostgres(?:ql|\s+sql)?\b/i,
        ],

        [
          'MySQL',
          /\bmysql\b/i,
        ],

        [
          'MongoDB',
          /\bmongodb\b/i,
        ],

        [
          'Redis',
          /\bredis\b/i,
        ],

        [
          'Prisma',
          /\bprisma\b/i,
        ],

        [
          'Docker',
          /\bdocker\b/i,
        ],

        [
          'Kubernetes',
          /\b(?:kubernetes|k8s)\b/i,
        ],

        [
          'AWS',
          /\baws\b|amazon\s+web\s+services/i,
        ],

        [
          'GCP',
          /\bgcp\b|google\s+cloud/i,
        ],

        [
          'Azure',
          /\bazure\b/i,
        ],

        [
          'GitHub',
          /\bgithub\b/i,
        ],

        [
          'GitLab',
          /\bgitlab\b/i,
        ],

        [
          'CI/CD',
          /\bci\s*\/\s*cd\b/i,
        ],

        [
          'GraphQL',
          /\bgraphql\b/i,
        ],

        [
          'RabbitMQ',
          /\brabbitmq\b/i,
        ],

        [
          'Kafka',
          /\bkafka\b/i,
        ],

        /*
         * case-sensitive
         * ป้องกัน Go จากคำทั่ว ๆ ไป
         */
        [
          'Go',
          /\b(?:Go|Golang)\b/,
        ],

        [
          'Rust',
          /\bRust\b/,
        ],

        [
          'REST',
          /\bREST(?:ful)?(?:\s+API)?\b/,
        ],
      ];

    return technologies
      .filter(
        ([, regexp]) =>
          regexp.test(
            content,
          ),
      )
      .map(
        ([name]) =>
          name,
      );
  }

  /*
   * ------------------------------------------------
   * Location
   * ------------------------------------------------
   */

  private resolveLocation(
    current?: string | null,
    description?: string,
  ): string | undefined {
    const direct =
      cleanText(
        current,
      );

    if (
      direct &&
      direct.length <= 180
    ) {
      return direct
        .replace(
          /^[📍🏢🏡🌍]\s*/,
          '',
        )
        .replace(
          /^(?:location|สถานที่)\s*:\s*/i,
          '',
        )
        .trim();
    }

    if (!description) {
      return undefined;
    }

    const line =
      description
        .split('\n')
        .map(value =>
          value.trim(),
        )
        .find(value =>
          /^(?:📍|🏡|🏢)\s*/.test(
            value,
          ) ||

          /^(?:location|สถานที่)\s*:/i.test(
            value,
          )
        );

    if (!line) {
      return undefined;
    }

    return line
      .replace(
        /^[📍🏢🏡]\s*/,
        '',
      )
      .replace(
        /^(?:location|สถานที่)\s*:\s*/i,
        '',
      )
      .trim();
  }

  /*
   * ------------------------------------------------
   * Salary
   * ------------------------------------------------
   */

  private resolveSalary(
    current?: string | null,
    description?: string,
  ): string | undefined {
    const direct =
      cleanText(
        current,
      );

    if (direct) {
      return direct;
    }

    if (!description) {
      return undefined;
    }

    const line =
      description
        .split('\n')
        .map(value =>
          value.trim(),
        )
        .find(value =>
          /(?:salary|เงินเดือน)\s*:/i.test(
            value,
          ),
        );

    if (!line) {
      return undefined;
    }

    return line
      .replace(
        /^💰\s*/,
        '',
      )
      .replace(
        /^(?:salary|เงินเดือน)\s*:\s*/i,
        '',
      )
      .trim();
  }

  /*
   * ------------------------------------------------
   * Contract
   * ------------------------------------------------
   */

  private resolveContract(
    raw: ImportedJobPayload,
    description?: string,
  ): string | undefined {
    const direct =
      cleanText(
        raw.contractText ??
        raw.contract,
      );

    if (direct) {
      return direct;
    }

    if (!description) {
      return undefined;
    }

    const line =
      description
        .split('\n')
        .map(value =>
          value.trim(),
        )
        .find(value =>
          /(?:contract|permanent|full[- ]?time|part[- ]?time|สัญญาจ้าง)/i.test(
            value,
          ),
        );

    return cleanText(
      line,
    );
  }

  /*
   * ------------------------------------------------
   * Contact
   * ------------------------------------------------
   */

  private resolveContacts(
    raw: ImportedJobPayload,
  ): string[] {
    const contacts = [
      ...toStringArray(
        raw.contact,
      ),

      ...toStringArray(
        raw.contacts,
      ),
    ];

    if (
      raw.dmContact?.name ||
      raw.dmContact?.profileUrl
    ) {
      const detail =
        [
          raw.dmContact.name,
          raw.dmContact.profileUrl,
        ]
          .filter(Boolean)
          .join(' | ');

      if (detail) {
        contacts.push(
          `LinkedIn DM: ${detail}`,
        );
      }
    }

    return uniqueStrings(
      contacts

        /*
         * hashtag search ไม่ใช่ contact
         */
        .filter(value =>
          !/linkedin\.com\/search\/results\/all/i.test(
            value,
          ),
        )

        /*
         * job URL ไปอยู่ jobUrl แล้ว
         */
        .filter(value =>
          !/linkedin\.com\/jobs\/view\//i.test(
            value,
          ),
        ),
    );
  }

  private resolveEmails(
    raw: ImportedJobPayload,
    description?: string,
  ): string[] {
    const emails = [
      ...toStringArray(
        raw.email,
      ),

      ...toStringArray(
        raw.emails,
      ),
    ];

    if (description) {
      const matches =
        description.match(
          /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        );

      if (matches) {
        emails.push(
          ...matches,
        );
      }
    }

    return uniqueStrings(
      emails.map(value =>
        value
          .trim()
          .toLowerCase(),
      ),
    );
  }

  /*
   * ------------------------------------------------
   * Posted At
   * ------------------------------------------------
   */

  private resolvePostedAt(
    rawValue?:
      | string
      | number
      | null,
    description?: string,
  ): Date | undefined {
    const direct =
      parseDateValue(
        rawValue,
      );

    if (direct) {
      return direct;
    }

    if (!description) {
      return undefined;
    }

    const now =
      new Date();

    /*
     * Thai
     *
     * 1 ชม.
     * 4 วัน
     * 2 สัปดาห์
     */

    const thaiHours =
      description.match(
        /(?:^|\n)(\d+)\s*ชม\.\s*•?/m,
      );

    if (thaiHours) {
      now.setHours(
        now.getHours() -
        Number(
          thaiHours[1],
        ),
      );

      return now;
    }

    const thaiDays =
      description.match(
        /(?:^|\n)(\d+)\s*วัน\s*•?/m,
      );

    if (thaiDays) {
      now.setDate(
        now.getDate() -
        Number(
          thaiDays[1],
        ),
      );

      return now;
    }

    const thaiWeeks =
      description.match(
        /(?:^|\n)(\d+)\s*สัปดาห์\s*•?/m,
      );

    if (thaiWeeks) {
      now.setDate(
        now.getDate() -
        Number(
          thaiWeeks[1],
        ) *
        7,
      );

      return now;
    }

    /*
     * English
     */
    const englishHours =
      description.match(
        /(?:^|\n)(\d+)\s+hours?\s*•?/im,
      );

    if (englishHours) {
      now.setHours(
        now.getHours() -
        Number(
          englishHours[1],
        ),
      );

      return now;
    }

    const englishDays =
      description.match(
        /(?:^|\n)(\d+)\s+days?\s*•?/im,
      );

    if (englishDays) {
      now.setDate(
        now.getDate() -
        Number(
          englishDays[1],
        ),
      );

      return now;
    }

    const englishWeeks =
      description.match(
        /(?:^|\n)(\d+)\s+weeks?\s*•?/im,
      );

    if (englishWeeks) {
      now.setDate(
        now.getDate() -
        Number(
          englishWeeks[1],
        ) *
        7,
      );

      return now;
    }

    return undefined;
  }
}