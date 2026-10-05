// src/sources/jobsdb/jobsdb.types.ts

export interface JobsDbSearchItem {
  id: string;

  title: string;

  company?: string;

  location?: string;

  salary?: string;

  workArrangement?: string;

  shortDescription?: string;

  classification?: string;

  subClassification?: string;

  listedText?: string;

  jobUrl: string;
}

export interface JobsDbDetailPageData {
  title?: string;

  company?: string;

  location?: string;

  classification?: string;

  workType?: string;

  salary?: string;

  description?: string;

  bullets: string[];

  applyUrl?: string;

  jobUrl: string;
}

export interface JobsDbRawJob {
  search: JobsDbSearchItem;

  detail: JobsDbDetailPageData;
}