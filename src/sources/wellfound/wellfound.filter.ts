// src/sources/wellfound/wellfound.filter.ts

import { Injectable } from '@nestjs/common';

import { WellfoundExperience, WellfoundSearchJob } from './wellfound.types';

@Injectable()
export class WellfoundFilter {
  /*
   * User requirement:
   * required experience <= 4 years
   */
  private readonly maxRequiredExperience = 4;

 
isAccepted(
  job: WellfoundSearchJob,
): boolean {
  /*
   * RULE 0
   * ต้องเป็น Remote เท่านั้น
   */
  if (!job.remote) {
    return false;
  }

  /*
   * RULE 1
   * ต้องเป็น Node.js / NestJS
   */
  if (!this.hasTargetTechnology(job)) {
    return false;
  }

  /*
   * RULE 2
   * ต้องรู้ experience
   */
  const experience =
    this.resolveExperience(job);

  if (
    experience.min === undefined &&
    experience.max === undefined
  ) {
    return false;
  }

  /*
   * RULE 3
   * minimum required experience
   * ต้องไม่เกิน 4 ปี
   */
  const minimumRequired =
    experience.min ?? 0;

  if (
    minimumRequired >
    this.maxRequiredExperience
  ) {
    return false;
  }

  return true;
}getRejectReason(
  job: WellfoundSearchJob,
): string | undefined {
  if (!job.remote) {
    return 'not-remote';
  }

  if (!this.hasTargetTechnology(job)) {
    return 'technology-not-match';
  }

  const experience =
    this.resolveExperience(job);

  if (
    experience.min === undefined &&
    experience.max === undefined
  ) {
    return 'experience-unknown';
  }

  if (
    (experience.min ?? 0) >
    this.maxRequiredExperience
  ) {
    return `experience-too-high:${experience.min}`;
  }

  return undefined;
}

  getMatchedTechnologies(job: WellfoundSearchJob): string[] {
    const content = this.getSearchContent(job);

    const technologies: string[] = [];

    if (this.hasNestJs(content)) {
      technologies.push('NestJS');
    }

    if (this.hasNodeJs(content)) {
      technologies.push('Node.js');
    }

    return technologies;
  }

  resolveExperience(job: WellfoundSearchJob): WellfoundExperience {
    /*
     * Wellfound มี field นี้โดยตรง
     */
    if (
      typeof job.yearsExperienceMin === 'number' ||
      typeof job.yearsExperienceMax === 'number'
    ) {
      return {
        min: job.yearsExperienceMin,

        max: job.yearsExperienceMax,

        source: 'metadata',
      };
    }

    /*
     * metadata ไม่มี
     * ค่อยอ่านจาก description
     */
    const parsed = this.parseExperienceFromDescription(job.description);

    if (parsed) {
      return {
        ...parsed,

        source: 'description',
      };
    }

    /*
     * ไม่รู้จำนวนปี
     * = ไม่เก็บ
     */
    return {
      source: 'unknown',
    };
  }

  private hasTargetTechnology(job: WellfoundSearchJob): boolean {
    const content = this.getSearchContent(job);

    return this.hasNestJs(content) || this.hasNodeJs(content);
  }

  private getSearchContent(job: WellfoundSearchJob): string {
    return [job.title, job.description]
      .filter(Boolean)
      .join('\n')
      .toLowerCase();
  }

  private hasNestJs(content: string): boolean {
    return (
      /\bnestjs\b/i.test(content) ||
      /\bnest\.js\b/i.test(content) ||
      /\bnest\s+js\b/i.test(content)
    );
  }

  private hasNodeJs(content: string): boolean {
    return (
      /\bnode\.js\b/i.test(content) ||
      /\bnodejs\b/i.test(content) ||
      /\bnode\s+js\b/i.test(content)
    );
  }

  private parseExperienceFromDescription(description?: string):
    | {
        min?: number;
        max?: number;
      }
    | undefined {
    if (!description) {
      return undefined;
    }

    const text = description.replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ');

    /*
     * 1-3 years
     * 1 – 3 years
     * 2 to 4 years
     */
    const range = text.match(
      /\b(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\s*(?:years?|yrs?)\b/i,
    );

    if (range) {
      return {
        min: Number(range[1]),

        max: Number(range[2]),
      };
    }

    /*
     * 4+ years
     * 5+ years
     */
    const plus = text.match(/\b(\d{1,2})\s*\+\s*(?:years?|yrs?)\b/i);

    if (plus) {
      return {
        min: Number(plus[1]),
      };
    }

    /*
     * at least 3 years
     */
    const atLeast = text.match(/\bat\s+least\s+(\d{1,2})\s*(?:years?|yrs?)\b/i);

    if (atLeast) {
      return {
        min: Number(atLeast[1]),
      };
    }

    /*
     * minimum 3 years
     * minimum of 3 years
     */
    const minimum = text.match(
      /\bminimum(?:\s+of)?\s+(\d{1,2})\s*(?:years?|yrs?)\b/i,
    );

    if (minimum) {
      return {
        min: Number(minimum[1]),
      };
    }

    /*
     * 3 years of experience
     */
    const yearsOfExperience = text.match(
      /\b(\d{1,2})\s*(?:years?|yrs?)\s+of\s+(?:relevant\s+|professional\s+)?experience\b/i,
    );

    if (yearsOfExperience) {
      return {
        min: Number(yearsOfExperience[1]),
      };
    }

    return undefined;
  }
}
