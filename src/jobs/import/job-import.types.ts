export type ImportPageType = 'feed' | 'search' | 'detail' | 'job' | 'unknown';

export interface ImportedDmContact {
  type?: string | null;

  name?: string | null;

  profileUrl?: string | null;
}

export interface ImportedJobPayload {
  /**
   * linkedin
   * jobthai
   * jobsdb
   * jobstreet
   * workventure
   * wellfound
   * techinasia
   * arc
   */
  source?: string | null;

  /**
   * feed / search / detail / job
   */
  pageType?: ImportPageType | null;

  externalId?: string | null;

  title?: string | null;

  company?: string | null;

  location?: string | null;

  salaryText?: string | null;

  description?: string | null;

  requirements?: unknown;

  technologies?: unknown;

  jobUrl?: string | null;

  postedAt?: string | number | null;

  /*
   * Social / feed fields
   */
  contact?: unknown;

  contacts?: unknown;

  email?: unknown;

  emails?: unknown;

  contract?: string | null;

  contractText?: string | null;

  imageUrls?: unknown;

  images?: unknown;

  postedBy?: string | null;

  posterProfileUrl?: string | null;

  dmContact?: ImportedDmContact | null;

  /**
   * future payload
   */
  raw?: unknown;
}

export type JobImportBody =
  | ImportedJobPayload[]
  | {
      jobs: ImportedJobPayload[];
    };
