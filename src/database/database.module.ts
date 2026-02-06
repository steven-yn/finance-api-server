import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { DATABASE_CONNECTION } from '../common/constants/tokens';
import { DatabaseLifecycleService } from './database-lifecycle.service';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: (config: ConfigService) => {
        const dbPath = config.getOrThrow<string>('NEWS_DB_PATH');
        const db = new Database(dbPath, {
          readonly: true,
          fileMustExist: true,
        });

        db.pragma('journal_mode = WAL');
        db.pragma('busy_timeout = 5000');

        return db;
      },
      inject: [ConfigService],
    },
    DatabaseLifecycleService,
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
