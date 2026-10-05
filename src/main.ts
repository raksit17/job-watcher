import { NestFactory } from '@nestjs/core';

import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { StartupScanService } from './bot/startup-scan/startup-scan.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    /*
     * ปิด default parser
     * เพื่อกำหนด limit เอง
     */
    bodyParser: false,
  });

  app.use(
    json({
      limit: '10mb',
    }),
  );

  app.use(
    urlencoded({
      extended: true,

      limit: '10mb',
    }),
  );

  app.setGlobalPrefix('api');

  const config = app.get(ConfigService);

  const frontendUrl = config.get<string>(
    'FRONTEND_URL',
    'http://localhost:5173',
  );

  const apiPrefix = config.get<string>('API_PREFIX', 'api');

  app.enableCors({
    origin: frontendUrl,

    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    credentials: true,
  });

  app.setGlobalPrefix(apiPrefix);

  const port = config.get<number>('PORT', 3000);

  await app.listen(port);
  const startupScan = app.get(StartupScanService);

  void startupScan.run();
  console.log(`API: http://localhost:${port}/${apiPrefix}`);
}

bootstrap();
