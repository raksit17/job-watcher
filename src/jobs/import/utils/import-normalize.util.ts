import { createHash } from 'node:crypto';

/**
 * แก้ Unicode ที่เสีย เช่น lone surrogate
 *
 * ปัญหานี้เจอบ่อยจากข้อความ LinkedIn / emoji
 * และสามารถทำให้ Prisma error:
 *
 * JSON Error: lone leading surrogate in hex escape
 */
export function sanitizeUnicode(
  value: string,
): string {
  let result = '';

  for (
    let i = 0;
    i < value.length;
    i++
  ) {
    const code =
      value.charCodeAt(i);

    /*
     * High surrogate
     * U+D800 - U+DBFF
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
       * Valid surrogate pair
       */
      if (
        next >= 0xdc00 &&
        next <= 0xdfff
      ) {
        result +=
          value[i] +
          value[i + 1];

        i++;

        continue;
      }

      /*
       * Broken high surrogate
       */
      result += '\uFFFD';

      continue;
    }

    /*
     * Lone low surrogate
     */
    if (
      code >= 0xdc00 &&
      code <= 0xdfff
    ) {
      result += '\uFFFD';

      continue;
    }

    result += value[i];
  }

  return result;
}

/**
 * Text บรรทัดเดียว
 */
export function cleanText(
  value?: string | null,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const result =
    sanitizeUnicode(value)
      .replace(/\s+/g, ' ')
      .trim();

  return (
    result ||
    undefined
  );
}

/**
 * Text หลายบรรทัด
 *
 * ใช้กับ description เป็นหลัก
 */
export function cleanMultiline(
  value?: string | null,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const result =
    sanitizeUnicode(value)
      .replace(/\r/g, '')
      .replace(
        /[ \t]+\n/g,
        '\n',
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

/**
 * Clean URL
 */
export function cleanUrl(
  value?: string | null,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const safe =
    sanitizeUnicode(
      value,
    ).trim();

  if (!safe) {
    return undefined;
  }

  try {
    return new URL(
      safe,
    ).href;
  } catch {
    return undefined;
  }
}

/**
 * ตัด tracking parameters ของ LinkedIn
 *
 * เช่น:
 *
 * https://www.linkedin.com/jobs/view/123/?trackingId=xxx
 *
 * ->
 *
 * https://www.linkedin.com/jobs/view/123/
 */
export function cleanTrackingUrl(
  value: string,
): string {
  const safe =
    sanitizeUnicode(
      value,
    ).trim();

  try {
    const url =
      new URL(
        safe,
      );

    if (
      url.hostname ===
        'linkedin.com' ||
      url.hostname.endsWith(
        '.linkedin.com',
      )
    ) {
      return (
        url.origin +
        url.pathname
      );
    }

    return url.href;
  } catch {
    return safe;
  }
}

/**
 * unknown -> string[]
 *
 * พร้อม sanitize Unicode ทุกตัว
 */
export function toStringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item,
      ): item is string =>
        typeof item ===
        'string',
    )
    .map(item =>
      sanitizeUnicode(
        item,
      ).trim(),
    )
    .filter(Boolean);
}

/**
 * ลบ duplicate string
 *
 * พร้อม sanitize Unicode
 */
export function uniqueStrings(
  values: string[],
): string[] {
  return [
    ...new Set(
      values
        .map(value =>
          sanitizeUnicode(
            value,
          ).trim(),
        )
        .filter(Boolean),
    ),
  ];
}

/**
 * รองรับ:
 *
 * ISO Date
 * Unix timestamp seconds
 * Unix timestamp milliseconds
 */
export function parseDateValue(
  value?:
    | string
    | number
    | null,
): Date | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  /*
   * Unix timestamp
   */
  if (
    typeof value ===
    'number'
  ) {
    const milliseconds =
      value <
      10_000_000_000
        ? value * 1000
        : value;

    const result =
      new Date(
        milliseconds,
      );

    return Number.isNaN(
      result.getTime(),
    )
      ? undefined
      : result;
  }

  const text =
    sanitizeUnicode(
      value,
    ).trim();

  if (!text) {
    return undefined;
  }

  const result =
    new Date(
      text,
    );

  return Number.isNaN(
    result.getTime(),
  )
    ? undefined
    : result;
}

/**
 * สร้าง externalId fallback
 *
 * ใช้เมื่อ source ไม่มี ID จริง
 */
export function createStableExternalId(
  prefix: string,
  ...parts:
    Array<
      string |
      null |
      undefined
    >
): string {
  const safePrefix =
    sanitizeUnicode(
      prefix,
    )
      .trim()
      .toLowerCase();

  const content =
    parts
      .map(value =>
        sanitizeUnicode(
          value ?? '',
        ),
      )
      .join('|');

  const hash =
    createHash(
      'sha256',
    )
      .update(
        content,
      )
      .digest(
        'hex',
      )
      .slice(
        0,
        24,
      );

  return (
    `${safePrefix}-${hash}`
  );
}

/**
 * เดา source จาก URL
 *
 * ใช้กับ GenericJobImportAdapter
 * ในกรณี payload ไม่มี source
 */
export function inferSourceFromUrl(
  value?: string | null,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const safe =
    sanitizeUnicode(
      value,
    ).trim();

  try {
    const hostname =
      new URL(
        safe,
      )
        .hostname
        .toLowerCase();

    if (
      hostname.includes(
        'linkedin.com',
      )
    ) {
      return 'linkedin';
    }

    if (
      hostname.includes(
        'jobthai.com',
      )
    ) {
      return 'jobthai';
    }

    if (
      hostname.includes(
        'jobsdb.com',
      )
    ) {
      return 'jobsdb';
    }

    if (
      hostname.includes(
        'jobstreet.',
      )
    ) {
      return 'jobstreet';
    }

    if (
      hostname.includes(
        'workventure.com',
      )
    ) {
      return 'workventure';
    }

    if (
      hostname.includes(
        'wellfound.com',
      )
    ) {
      return 'wellfound';
    }

    if (
      hostname.includes(
        'techinasia.com',
      )
    ) {
      return 'techinasia';
    }

    if (
      hostname.includes(
        'arc.dev',
      )
    ) {
      return 'arc';
    }

    /*
     * เว็บอื่นในอนาคต
     *
     * www.example.com
     * ->
     * example
     */
    return hostname
      .replace(
        /^www\./,
        '',
      )
      .split('.')[0];
  } catch {
    return undefined;
  }
}