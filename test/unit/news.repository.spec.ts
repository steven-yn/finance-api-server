import { NewsRepository } from '../../src/modules/news/news.repository';
import { createTestDatabase, createSampleNews } from '../fixtures/setup-test-db';
import { Database } from 'better-sqlite3';

describe('NewsRepository', () => {
  let db: Database;
  let repository: NewsRepository;

  beforeEach(() => {
    const sampleData = createSampleNews(20);
    db = createTestDatabase(sampleData);
    repository = new NewsRepository(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('findRecent', () => {
    it('최근 뉴스를 published_at DESC 순서로 반환해야 함', () => {
      const result = repository.findRecent({ limit: 5, offset: 0 });

      expect(result.items).toHaveLength(5);
      expect(result.items[0].headline).toBe('Test Headline 0');

      for (let i = 0; i < result.items.length - 1; i++) {
        const current = new Date(result.items[i].published_at);
        const next = new Date(result.items[i + 1].published_at);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('source 필터가 작동해야 함', () => {
      const result = repository.findRecent({ limit: 20, offset: 0, source: 'finnhub' });

      expect(result.items.length).toBeGreaterThan(0);
      result.items.forEach(item => {
        expect(item.source).toBe('finnhub');
      });
    });

    it('category 필터가 작동해야 함', () => {
      const result = repository.findRecent({ limit: 20, offset: 0, category: 'crypto' });

      expect(result.items.length).toBeGreaterThan(0);
      result.items.forEach(item => {
        expect(item.category).toBe('crypto');
      });
    });

    it('페이지네이션이 작동해야 함', () => {
      const page1 = repository.findRecent({ limit: 5, offset: 0 });
      const page2 = repository.findRecent({ limit: 5, offset: 5 });

      expect(page1.items).toHaveLength(5);
      expect(page2.items).toHaveLength(5);
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
    });

    it('total count가 정확해야 함', () => {
      const result = repository.findRecent({ limit: 5, offset: 0 });
      expect(result.total).toBe(20);
    });
  });

  describe('findById', () => {
    it('존재하는 뉴스를 반환해야 함', () => {
      const news = repository.findById('test-0');

      expect(news).not.toBeNull();
      expect(news?.news_id).toBe('test-0');
      expect(news?.headline).toBe('Test Headline 0');
    });

    it('존재하지 않는 뉴스는 null을 반환해야 함', () => {
      const news = repository.findById('non-existent');
      expect(news).toBeNull();
    });
  });

  describe('search', () => {
    it('headline에서 키워드를 검색해야 함', () => {
      const result = repository.search({ keyword: 'Headline 1', limit: 20, offset: 0 });

      expect(result.items.length).toBeGreaterThan(0);
      result.items.forEach(item => {
        expect(item.headline).toContain('Headline 1');
      });
    });

    it('summary에서 키워드를 검색해야 함', () => {
      const result = repository.search({ keyword: 'summary', limit: 20, offset: 0 });

      expect(result.items.length).toBeGreaterThan(0);
    });

    it('대소문자 구분 없이 검색해야 함', () => {
      const result = repository.search({ keyword: 'HEADLINE', limit: 20, offset: 0 });

      expect(result.items.length).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('전체 통계를 반환해야 함', () => {
      const stats = repository.getStats();

      expect(stats.total).toBe(20);
      expect(stats.notified).toBeGreaterThan(0);
      expect(Object.keys(stats.bySource).length).toBeGreaterThan(0);
      expect(Object.keys(stats.byCategory).length).toBeGreaterThan(0);
    });

    it('소스별 카운트가 정확해야 함', () => {
      const stats = repository.getStats();
      const totalBySource = Object.values(stats.bySource).reduce((sum, count) => sum + count, 0);

      expect(totalBySource).toBe(20);
    });

    it('카테고리별 카운트가 정확해야 함', () => {
      const stats = repository.getStats();
      const totalByCategory = Object.values(stats.byCategory).reduce((sum, count) => sum + count, 0);

      expect(totalByCategory).toBe(20);
    });
  });

  describe('findAfter', () => {
    it('특정 ID 이후의 뉴스를 반환해야 함', () => {
      const result = repository.findAfter(5);

      expect(result.length).toBeGreaterThan(0);
      result.forEach(item => {
        expect(item.id).toBeGreaterThan(5);
      });
    });

    it('ID 오름차순으로 정렬되어야 함', () => {
      const result = repository.findAfter(0);

      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].id).toBeLessThan(result[i + 1].id);
      }
    });
  });
});
