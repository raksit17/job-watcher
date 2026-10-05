import { Module } from '@nestjs/common';
import { JobMatcherService } from './job-matcher/job-matcher.service';

@Module({
  providers: [JobMatcherService]
})
export class MatcherModule {}
