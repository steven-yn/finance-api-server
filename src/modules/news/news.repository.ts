import { Injectable, Inject } from "@nestjs/common";
import { Database, Statement } from "better-sqlite3";
import { DATABASE_CONNECTION } from "../../common/constants/tokens";
import { DatabaseException } from "../../common/exceptions/app.exceptions";

export interface FindRecentParams {
  limit: number;
  offset: number;
  source?: string;
  category?: string;
}

export interface SearchParams {
  keyword: string;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface NewsStats {
  total: number;
  notified: number;
  bySource: Record<string, number>;
  byCategory: Record<string, number>;
}

@Injectable()
export class NewsRepository {
  private readonly stmts: Record<string, Statement>;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {
    try {
      this.stmts = {
        findRecent: db.prepare(
          `SELECT * FROM news
           WHERE (? IS NULL OR source = ?)
           AND (? IS NULL OR category = ?)
           ORDER BY published_at DESC LIMIT ? OFFSET ?`,
        ),
        countFiltered: db.prepare(
          `SELECT COUNT(*) as total FROM news
           WHERE (? IS NULL OR source = ?)
           AND (? IS NULL OR category = ?)`,
        ),
        findById: db.prepare("SELECT * FROM news WHERE news_id = ?"),
        search: db.prepare(
          `SELECT * FROM news
           WHERE headline LIKE ? OR summary LIKE ?
           ORDER BY published_at DESC LIMIT ? OFFSET ?`,
        ),
        searchCount: db.prepare(
          `SELECT COUNT(*) as total FROM news
           WHERE headline LIKE ? OR summary LIKE ?`,
        ),
        findAfter: db.prepare(
          "SELECT * FROM news WHERE id > ? ORDER BY id ASC",
        ),
        statsBySource: db.prepare(
          "SELECT source, COUNT(*) as cnt FROM news GROUP BY source",
        ),
        statsByCategory: db.prepare(
          "SELECT category, COUNT(*) as cnt FROM news GROUP BY category",
        ),
        statsTotal: db.prepare(
          `SELECT COUNT(*) as total,
           COUNT(CASE WHEN notified_at IS NOT NULL THEN 1 END) as notified
           FROM news`,
        ),
      };
    } catch (error) {
      throw new DatabaseException(
        "Failed to prepare statements",
        error as Error,
      );
    }
  }

  findRecent(params: FindRecentParams): PaginatedResult<any> {
    try {
      const items = this.stmts.findRecent.all(
        params.source ?? null,
        params.source ?? null,
        params.category ?? null,
        params.category ?? null,
        params.limit,
        params.offset,
      ) as any[];

      const result = this.stmts.countFiltered.get(
        params.source ?? null,
        params.source ?? null,
        params.category ?? null,
        params.category ?? null,
      ) as { total: number };

      return { items, total: result.total };
    } catch (error) {
      throw new DatabaseException("Failed to find recent news", error as Error);
    }
  }

  findById(newsId: string): any | null {
    try {
      const news = this.stmts.findById.get(newsId);
      return news ?? null;
    } catch (error) {
      throw new DatabaseException("Failed to find news by ID", error as Error);
    }
  }

  search(params: SearchParams): PaginatedResult<any> {
    try {
      const likePattern = `%${params.keyword}%`;

      const items = this.stmts.search.all(
        likePattern,
        likePattern,
        params.limit,
        params.offset,
      ) as any[];

      const result = this.stmts.searchCount.get(likePattern, likePattern) as {
        total: number;
      };

      return { items, total: result.total };
    } catch (error) {
      throw new DatabaseException("Failed to search news", error as Error);
    }
  }

  findAfter(lastId: number): any[] {
    try {
      return this.stmts.findAfter.all(lastId) as any[];
    } catch (error) {
      throw new DatabaseException(
        "Failed to find news after ID",
        error as Error,
      );
    }
  }

  getStats(): NewsStats {
    try {
      const { total, notified } = this.stmts.statsTotal.get() as {
        total: number;
        notified: number;
      };

      const sourceRows = this.stmts.statsBySource.all() as Array<{
        source: string;
        cnt: number;
      }>;
      const bySource: Record<string, number> = {};
      sourceRows.forEach((row) => {
        bySource[row.source] = row.cnt;
      });

      const categoryRows = this.stmts.statsByCategory.all() as Array<{
        category: string;
        cnt: number;
      }>;
      const byCategory: Record<string, number> = {};
      categoryRows.forEach((row) => {
        byCategory[row.category] = row.cnt;
      });

      return {
        total,
        notified,
        bySource,
        byCategory,
      };
    } catch (error) {
      throw new DatabaseException("Failed to get stats", error as Error);
    }
  }
}
