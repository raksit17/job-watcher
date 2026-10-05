// src/sources/techinasia/techinasia.types.ts

export interface TechInAsiaSearchItem {
  id: string;

  title: string;
  company?: string;
  industry?: string;

  location?: string;
  workArrangement?: string;

  jobType?: string;

  salary?: string;

  experience?: string;
  functionName?: string;

  /**
   * ตัวอย่าง:
   * 2026-09-18 07:42:08
   */
  postedAt?: string;

  jobUrl: string;
}

export interface TechInAsiaDetailPageData {
  title?: string;

  company?: string;

  location?: string;
  workArrangement?: string;

  salary?: string;

  functionName?: string;

  jobType?: string;

  experience?: string;

  vacancies?: string;

  createdAt?: string;
  updatedAt?: string;

  description?: string;

  responsibilities: string[];

  requirements: string[];

  skills: string[];

  applyUrl?: string;

  jobUrl: string;
}

export interface TechInAsiaRawJob {
  search: TechInAsiaSearchItem;

  detail: TechInAsiaDetailPageData;
}