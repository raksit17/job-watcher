import { JobDto } from '../common/job.dto';

export interface JobSource {
  readonly name: string;

  collect(): Promise<JobDto[]>;
}