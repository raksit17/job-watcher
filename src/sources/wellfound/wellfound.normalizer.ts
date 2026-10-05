import { Injectable } from '@nestjs/common';

import { JobDto } from '../common/job.dto';

import { JobNormalizer } from '../common/job-normalizer.interface';

import {
  cleanLines,
  cleanText,
  extractTechnologies,
} from '../common/normalize.util';

import { WellfoundRawJob, WellfoundSearchJob } from './wellfound.types';

@Injectable()
export class WellfoundNormalizer implements JobNormalizer<WellfoundRawJob> {
  normalize(raw: WellfoundRawJob): JobDto {
    const job = raw.search;

    const description = cleanText(this.markdownToText(job.description));

    const requirements = this.extractRequirements(job.description);

    const detected = extractTechnologies(job.title, description, requirements);

    const technologies = Array.from(
      new Set([...raw.matchedTechnologies, ...detected]),
    );

    return {
      source: 'wellfound',

      externalId: job.id,

      title: job.title,

      company: job.company,

      location: this.buildLocation(job),

      salaryText: job.compensation,

      description,

      requirements: cleanLines(requirements),

      technologies,

      jobUrl: job.jobUrl,

      postedAt: job.liveStartAt ? new Date(job.liveStartAt * 1000) : undefined,
    };
  }

private buildLocation(
  job: WellfoundSearchJob,
): string | undefined {
  if (
    job.acceptedRemoteLocationNames.length
  ) {
    return (
      'Remote - ' +
      job.acceptedRemoteLocationNames.join(', ')
    );
  }

  return 'Remote';
}

  private markdownToText(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    return value
      .replace(/\*\*/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractRequirements(description?: string): string[] {
    if (!description) {
      return [];
    }

    const headings = [
      'Qualifications',
      'Qualifications and Skills',
      'Requirements',
      "What We're Looking For",
      'What We’re Looking For',
      'Who You Are',
      'What You Bring',
    ];

    let section: string | undefined;

    for (const heading of headings) {
      const regex = new RegExp(`\\*\\*${this.escapeRegex(heading)}\\*\\*`, 'i');

      const match = regex.exec(description);

      if (!match) {
        continue;
      }

      section = description.substring(match.index + match[0].length);

      break;
    }

    if (!section) {
      return [];
    }

    /*
     * หยุดเมื่อเจอ heading ใหม่
     */
    const nextHeading = section.search(/\n\s*\*\*[^*]+\*\*/);

    if (nextHeading >= 0) {
      section = section.substring(0, nextHeading);
    }

    return section
      .split('\n')
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
