import {
  ImportedJobPayload,
} from '../../job-import.types';

export interface LinkedInFeedImportPayload
  extends ImportedJobPayload
{
  source?: 'linkedin';

  pageType?: 'feed';

  postedBy?: string | null;

  posterProfileUrl?: string | null;

  dmContact?: {
    type?: 'linkedin_dm' | string | null;

    name?: string | null;

    profileUrl?: string | null;
  } | null;
}