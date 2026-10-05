export interface JobDto {
  source: string;
  externalId: string;

  title: string;

  company?: string;
  location?: string;
  salaryText?: string;
  description?: string;

  requirements: string[];
  technologies: string[];

  jobUrl: string;

  postedAt?: Date;

  /*
   * Imported / social job fields
   */
  contacts?: string[];

  emails?: string[];

  contractText?: string;

  postedBy?: string;

  posterProfileUrl?: string;

  imageUrls?: string[];
}