import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BrowserModule } from './browser/browser.module';
import { NetworkModule } from './network/network.module';
import { BotModule } from './bot/bot.module';
import { SourcesModule } from './sources/sources.module';
import { JobsModule } from './jobs/jobs.module';
import { MatcherModule } from './matcher/matcher.module';
import { DatabaseModule } from './database/database.module';
import { NotificationService } from './notification/notification/notification.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
@Module({
  imports: [
    BrowserModule,
    NetworkModule,
    BotModule,
    SourcesModule,
    JobsModule,
    MatcherModule,
    DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: Number(config.get<string>('DB_PORT')),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService, NotificationService],
})
export class AppModule {}
