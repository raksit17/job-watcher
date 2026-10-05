// src/sources/source/source-registry.service.ts

import { Injectable } from '@nestjs/common';

import { JobSource } from '../source/job-source.interface';
import { JobsDbSource } from '../jobsdb/jobsdb.source';
import { JobThaiSource } from '../jobthai/jobthai.source';
import { JobTopGunSource } from '../jobtopgun/jobtopgun.source';
import { WorkVentureSource } from '../workventure/workventure.source';
import { TechInAsiaSource } from '../techinasia/techinasia.source';
import { ArcSource } from '../arc/arc.source';
import { JobStreetSource } from '../jobstreet/jobstreet.source';
import { WellfoundSource } from '../wellfound/wellfound.source';

@Injectable()
export class SourceRegistryService {
  constructor(
    private readonly jobThaiSource: JobThaiSource,
    private readonly jobsDbSource: JobsDbSource,
    private readonly jobTopGunSource: JobTopGunSource,
    private readonly workVentureSource: WorkVentureSource,
    private readonly techInAsiaSource: TechInAsiaSource,
    private readonly arcSource: ArcSource,
    private readonly jobStreetSource: JobStreetSource,
    private readonly wellfoundSource: WellfoundSource
  ) {}

  /**
   * Source ทั้งหมดที่ระบบรองรับ
   */
  getAll(): JobSource[] {
    return [
      // this.jobThaiSource,
      // this.jobsDbSource,
      // this.jobTopGunSource,
      // this.workVentureSource,
      // this.techInAsiaSource,
      //  this.wellfoundSource,
      //  this.jobStreetSource,
      //  this.arcSource
    ];
  }

  
  get(
    name: string,
  ): JobSource | undefined {
    return this
      .getAll()
      .find(
        source =>
          source.name === name,
      );
  }
}