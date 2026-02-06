/**
 * 테스트용 인메모리 SQLite 데이터베이스 설정
 */
import Database from "better-sqlite3";

export interface NewsRow {
  id?: number;
  news_id: string;
  hash: string;
  headline: string;
  summary?: string;
  url?: string;
  source: string;
  category: string;
  published_at: string;
  symbols?: string;
  raw_data?: string;
  created_at?: string;
  notified_at?: string;
}

const CREATE_NEWS_TABLE = `
CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    news_id TEXT NOT NULL UNIQUE,
    hash TEXT NOT NULL,
    headline TEXT NOT NULL,
    summary TEXT,
    url TEXT,
    source TEXT NOT NULL,
    category TEXT NOT NULL,
    published_at TIMESTAMP NOT NULL,
    symbols TEXT,
    raw_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notified_at TIMESTAMP
);
`;

const CREATE_INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_news_hash ON news(hash);",
  "CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at DESC);",
  "CREATE INDEX IF NOT EXISTS idx_news_source ON news(source);",
  "CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);",
  "CREATE INDEX IF NOT EXISTS idx_news_created_at ON news(created_at DESC);",
];

/**
 * 테스트용 인메모리 SQLite DB 생성
 * @param seedData 시드 데이터 (옵션)
 * @returns Database.Database
 */
export function createTestDatabase(seedData?: NewsRow[]): Database.Database {
  const db = new Database(":memory:");

  // 스키마 생성
  db.exec(CREATE_NEWS_TABLE);
  CREATE_INDEXES.forEach((indexSql) => db.exec(indexSql));

  // 시드 데이터 삽입
  if (seedData && seedData.length > 0) {
    const stmt = db.prepare(`
      INSERT INTO news (
        news_id, hash, headline, summary, url, source, category,
        published_at, symbols, raw_data, created_at, notified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const row of seedData) {
      stmt.run(
        row.news_id,
        row.hash,
        row.headline,
        row.summary ?? null,
        row.url ?? null,
        row.source,
        row.category,
        row.published_at,
        row.symbols ?? null,
        row.raw_data ?? null,
        row.created_at ?? new Date().toISOString(),
        row.notified_at ?? null,
      );
    }
  }

  return db;
}

/**
 * 테스트용 시드 데이터 생성 헬퍼
 */
export function createMockNewsData(count: number): NewsRow[] {
  const sources = ["finnhub", "sec", "fred", "rss"];
  const categories = ["company-news", "general", "earnings", "markets"];
  const now = new Date();

  return Array.from({ length: count }, (_, i) => ({
    news_id: `test-news-${i + 1}`,
    hash: `hash-${i + 1}`,
    headline: `Test Headline ${i + 1}`,
    summary: `Test summary for news ${i + 1}`,
    url: `https://example.com/news/${i + 1}`,
    source: sources[i % sources.length],
    category: categories[i % categories.length],
    published_at: new Date(now.getTime() - i * 60 * 60 * 1000).toISOString(),
    symbols: i % 2 === 0 ? '["AAPL","TSLA"]' : undefined,
    raw_data: JSON.stringify({ test: true }),
    created_at: new Date(now.getTime() - i * 60 * 60 * 1000).toISOString(),
    notified_at: i % 3 === 0 ? new Date().toISOString() : undefined,
  }));
}
