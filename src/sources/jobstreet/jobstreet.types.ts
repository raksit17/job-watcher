export interface JobStreetSearchItem {
  id: string;

  title: string;
  company?: string;

  location?: string;
  workArrangement?: string;

  jobType?: string;

  salary?: string;

  shortDescription?: string;

  classification?: string;
  subClassification?: string;

  listedText?: string;

  jobUrl: string;
}

export interface JobStreetDetailPageData {
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

export interface JobStreetRawJob {
  search: JobStreetSearchItem;

  detail: JobStreetDetailPageData;
}