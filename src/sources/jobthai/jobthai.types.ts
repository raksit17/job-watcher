// src/sources/jobthai/jobthai.types.ts

export interface JobThaiSearchItem {
  id: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;

  companyJobUrl: string;
}

export interface JobThaiCompanyPageData {
  title?: string;
  company?: string;

  postedAt?: string;

  location?: string;
  salary?: string;

  positions?: string;

  onlineInterview: boolean;

  summary?: string;

  benefits?: string[];

  tags?: string[];

  contactName?: string;
  contactCompany?: string;
  contactPhone?: string;

  detailUrl?: string;
}

export interface JobThaiDetailPageData {
  title?: string;
  company?: string;

  postedAt?: string;

  location?: string;
  workLocation?: string;

  salary?: string;
  positions?: string;

  onlineInterview: boolean;

  description?: string;

  requirements: string[];

  applicationMethods: string[];

  applicationOptions: string[];

  contactName?: string;
  contactCompany?: string;

  phone?: string;
  email?: string;
  lineId?: string;

  benefitUrl?: string;

  detailUrl: string;
}

export interface JobThaiRawJob {
  search: JobThaiSearchItem;

  companyPage:
    JobThaiCompanyPageData;

  detailPage:
    JobThaiDetailPageData;
}