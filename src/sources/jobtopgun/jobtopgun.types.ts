// src/sources/jobtopgun/jobtopgun.types.ts

export interface JobTopGunSearchItem {
  id: string;

  title: string;
  company?: string;

  location?: string;
  jobType?: string;

  salary?: string;

  highlights: string[];

  postedAt?: string;

  jobUrl: string;
}

export interface JobTopGunDetailPageData {
  title?: string;

  company?: string;

  location?: string;

  jobType?: string;

  education?: string;

  salary?: string;

  overview?: string;

  responsibilities: string[];

  qualifications: string[];

  benefits: string[];

  address?: string;

  companyWebsite?: string;

  jobUrl: string;
}

export interface JobTopGunRawJob {
  search: JobTopGunSearchItem;

  detail: JobTopGunDetailPageData;
}