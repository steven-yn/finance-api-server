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

const CREATE_TABLE_SQL = `
CREATE TABLE news (
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

CREATE INDEX idx_news_published_at ON news(published_at DESC);
CREATE INDEX idx_news_source ON news(source);
CREATE INDEX idx_news_category ON news(category);
CREATE INDEX idx_news_created_at ON news(created_at DESC);
CREATE INDEX idx_news_hash ON news(hash);
`;

export function createTestDatabase(seedData?: NewsRow[]): Database.Database {
  const db = new Database(":memory:");

  db.exec(CREATE_TABLE_SQL);

  if (seedData && seedData.length > 0) {
    const insert = db.prepare(`
      INSERT INTO news (
        news_id, hash, headline, summary, url, source, category,
        published_at, symbols, raw_data, notified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const row of seedData) {
      insert.run(
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
        row.notified_at ?? null,
      );
    }
  }

  return db;
}

export function createSampleNews(count: number = 10): NewsRow[] {
  const news: NewsRow[] = [];
  const sources = ["finnhub", "sec", "fred", "rss"];
  const categories = ["general", "crypto", "forex", "merger"];

  for (let i = 0; i < count; i++) {
    const date = new Date();
    date.setHours(date.getHours() - i);

    news.push({
      news_id: `test-${i}`,
      hash: `hash-${i}`,
      headline: `Test Headline ${i}`,
      summary: `Test summary for news ${i}`,
      url: `https://example.com/news/${i}`,
      source: sources[i % sources.length],
      category: categories[i % categories.length],
      published_at: date.toISOString(),
      symbols: i % 2 === 0 ? JSON.stringify(["BTC", "AAPL"]) : undefined,
      raw_data: JSON.stringify({ test: true }),
      notified_at: i % 3 === 0 ? date.toISOString() : undefined,
    });
  }

  return news;
}
