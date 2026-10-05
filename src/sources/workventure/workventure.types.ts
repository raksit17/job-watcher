// src/sources/workventure/workventure.types.ts

export interface WorkVentureSearchItem {
  id: string;

  title: string;
  company?: string;

  location?: string;

  experience?: string;
  skills: string[];

  jobType?: string;
  salary?: string;

  postedText?: string;

  jobUrl: string;
}

export interface WorkVentureDetailPageData {
  title?: string;

  company?: string;

  responsibilities: string[];
  qualifications: string[];

  experience?: string;
  level?: string;

  salary?: string;

  function?: string;

  jobType?: string;

  age?: string;

  applyUrl?: string;

  jobUrl: string;
}

export interface WorkVentureRawJob {
  search: WorkVentureSearchItem;

  detail: WorkVentureDetailPageData;
}