// src/sources/arc/arc.types.ts

export interface ArcCategory {
  name: string;
  urlString: string;
}

export interface ArcCompanySummary {
  randomKey: string;
  urlString: string;
  name: string;
  logo?: string | null;
}

export interface ArcSearchItem {
  randomKey: string;

  title: string;

  jobType?: string;

  requiredCountries: string[];

  positionType?: string;

  experienceLevels: string[];

  urlString: string;

  /**
   * Unix timestamp seconds
   */
  postedAt?: number;

  company: ArcCompanySummary;

  categories: ArcCategory[];

  jobUrl: string;
}

export interface ArcCompanyDetail {
  name?: string;

  employeeSizeMin?: number | null;
  employeeSizeMax?: number | null;

  logoUrl?: string | null;

  randomKey?: string;
  urlString?: string;

  headline?: string | null;

  industry?: string | null;

  headquartersName?: string | null;

  officialSiteUrl?: string | null;

  remoteLevel?: string | null;

  country?: string | null;

  city?: string | null;
}

export interface ArcDetailJob {
  randomKey: string;

  requiredCountries: string[];

  title: string;

  companyName?: string;

  /**
   * original external job URL
   * เช่น LinkedIn
   */
  url?: string;

  urlString: string;

  description?: string;

  experienceLevels: string[];

  contractType?: string;

  usVisaRequired?: boolean;

  /**
   * Unix timestamp seconds
   */
  postedAt?: number;

  closed?: boolean;

  techStackDetails: ArcCategory[];

  categories: ArcCategory[];

  company?: ArcCompanyDetail;
}

export interface ArcRawJob {
  search: ArcSearchItem;

  detail: ArcDetailJob;
}