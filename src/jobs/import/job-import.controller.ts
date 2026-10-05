import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { JobImportService } from './job-import.service';
import type { JobImportBody } from './job-import.types';

@Controller('jobs')
export class JobImportController {
  constructor(
    private readonly jobImportService: JobImportService,
  ) {}

  /**
   * POST /api/jobs/import
   *
   * รองรับทั้ง:
   *
   * [
   *   {...},
   *   {...}
   * ]
   *
   * และ
   *
   * {
   *   "jobs": [
   *     {...},
   *     {...}
   *   ]
   * }
   */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  async importJobs(
    @Body() body: JobImportBody,
  ) {
    return this.jobImportService.import(
      body,
    );
  }

  /**
   * ใช้เช็กว่า import endpoint พร้อมทำงาน
   *
   * GET /api/jobs/import/status
   */
  @Get('import/status')
  getImportStatus() {
    return {
      ok: true,
      endpoint: '/api/jobs/import',
      method: 'POST',
      message: 'Job import endpoint is ready',
    };
  }
}