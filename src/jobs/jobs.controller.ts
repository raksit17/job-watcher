import { Controller, Get, Param, Query } from '@nestjs/common';

import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // GET /api/jobs/stats/summary

  @Get('stats/summary')
  getSummary() {
    return this.jobsService.getSummary();
  }

  // GET /api/jobs/stats/new-by-hour?hours=24

  @Get('stats/new-by-hour')
  getNewJobsByHour(@Query('hours') hours?: string) {
    return this.jobsService.getNewJobsByHour(Number(hours ?? 24));
  }
  @Get('sources')
  getSources() {
    return this.jobsService.getSources();
  }

  // GET /api/jobs
  //
  // ?hours=24
  // &source=jobsdb
  // &search=nestjs
  // &page=1
  // &limit=50

  @Get()
  findAll(
    @Query('hours') hours?: string,

    @Query('source') source?: string,

    @Query('search') search?: string,

    @Query('page') page?: string,

    @Query('limit') limit?: string,
  ) {
    return this.jobsService.findAll({
      hours: Number(hours ?? 24),

      source,

      search,

      page: Number(page ?? 1),

      limit: Number(limit ?? 50),
    });
  }

  // ต้องวาง :id หลัง stats

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }
}
