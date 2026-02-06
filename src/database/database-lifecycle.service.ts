import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { Database } from 'better-sqlite3';
import { DATABASE_CONNECTION } from '../common/constants/tokens';

@Injectable()
export class DatabaseLifecycleService implements OnModuleDestroy {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  onModuleDestroy() {
    if (this.db) {
      this.db.close();
    }
  }
}
