export interface Job {
  source: string;

  externalId: string;

  title: string;

  company?: string;

  location?: string;

  salary?: string;

  description?: string;

  requirements?: string[];

  jobUrl: string;

  technologies: string[];

  postedAt?: Date;

  discoveredAt: Date;

  collectedAt: Date;
}