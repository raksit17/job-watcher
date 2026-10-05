// src/sources/sources.module.ts

import { Module } from '@nestjs/common';

import { BrowserModule } from '../browser/browser.module';

import { JobThaiSource } from './jobthai/jobthai.source';

import { SourceRegistryService } from './source-registry/source-registry.service';
import { JobThaiNormalizer } from './jobthai/jobthai.normalizer';
import { JobsDbNormalizer } from './jobsdb/jobsdb.normalizer';
import { JobsDbSource } from './jobsdb/jobsdb.source';
import { JobTopGunSource } from './jobtopgun/jobtopgun.source';
import { JobTopGunNormalizer } from './jobtopgun/jobtopgun.normalizer';
import { WorkVentureNormalizer } from './workventure/workventure.normalizer';
import { WorkVentureSource } from './workventure/workventure.source';
import { TechInAsiaNormalizer } from './techinasia/techinasia.normalizer';
import { TechInAsiaSource } from './techinasia/techinasia.source';
import { ArcSource } from './arc/arc.source';
import { ArcNormalizer } from './arc/arc.normalizer';
import { JobStreetSource } from './jobstreet/jobstreet.source';
import { JobStreetNormalizer } from './jobstreet/jobstreet.normalizer';
import { WellfoundSource } from './wellfound/wellfound.source';
import { WellfoundNormalizer } from './wellfound/wellfound.normalizer';
import { WellfoundFilter } from './wellfound/wellfound.filter';

@Module({
  imports: [BrowserModule],

  providers: [
    JobThaiSource,
    SourceRegistryService,
    JobThaiNormalizer,
    JobsDbNormalizer,
    JobsDbSource,
    JobTopGunSource,
    JobTopGunNormalizer,
    WorkVentureNormalizer,
    WorkVentureSource,
    TechInAsiaNormalizer,
    TechInAsiaSource,
    ArcNormalizer,
    ArcSource,
    JobStreetNormalizer,
    JobStreetSource,
    WellfoundSource,
    WellfoundNormalizer,
    WellfoundFilter,
  ],

  exports: [SourceRegistryService],
})
export class SourcesModule {}
