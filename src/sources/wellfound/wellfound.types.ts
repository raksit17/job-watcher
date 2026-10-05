// src/sources/wellfound/wellfound.types.ts

export interface WellfoundSearchJob {
  id: string;

  slug: string;

  title: string;

  company: string;
  companySlug?: string;

  description?: string;

  jobType?: string;

  compensation?: string;

  locationNames: string[];

  remote: boolean;

  acceptedRemoteLocationNames: string[];

  yearsExperienceMin?: number;
  yearsExperienceMax?: number;

  /**
   * Unix timestamp seconds
   */
  liveStartAt?: number;

  jobUrl: string;
}

export interface WellfoundExperience {
  min?: number;
  max?: number;

  source:
    | 'metadata'
    | 'description'
    | 'unknown';
}

export interface WellfoundRawJob {
  search: WellfoundSearchJob;

  experience: WellfoundExperience;

  matchedTechnologies: string[];
}