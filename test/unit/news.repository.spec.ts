import { Test, TestingModule } from "@nestjs/testing";
import { NewsRepository } from "../../src/modules/news/news.repository";
import { DATABASE_CONNECTION } from "../../src/common/constants/tokens";
import {
  createTestDatabase,
  createMockNewsData,
} from "../fixtures/setup-test-db";
import Database from "better-sqlite3";

describe("NewsRepository", () => {
  let repository: NewsRepository;
  let db: Database.Database;

  beforeEach(() => {
    // 인메모리 DB 생성 + 시드 데이터 50개
    db = createTestDatabase(createMockNewsData(50));
  });

  afterEach(() => {
    db.close();
  });

  describe("findRecent", () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NewsRepository,
          {
            provide: DATABASE_CONNECTION,
            useValue: db,
          },
        ],
      }).compile();

      repository = module.get<NewsRepository>(NewsRepository);
    });

    it("기본 limit=20, offset=0으로 최근 뉴스를 가져온다", () => {
      const result = repository.findRecent({ limit: 20, offset: 0 });

      expect(result.items).toHaveLength(20);
      expect(result.total).toBe(50);
      // 최근 순 정렬 확인 (published_at DESC)
      const dates = result.items.map((item) =>
        new Date(item.published_at).getTime(),
      );
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    });

    it("source 필터를 적용한다", () => {
      const result = repository.findRecent({
        limit: 100,
        offset: 0,
        source: "finnhub",
      });

      expect(result.items.length).toBeGreaterThan(0);
      result.items.forEach((item) => {
        expect(item.source).toBe("finnhub");
      });
    });

    it("category 필터를 적용한다", () => {
      const result = repository.findRecent({
        limit: 100,
        offset: 0,
        category: "company-news",
      });

      expect(result.items.length).toBeGreaterThan(0);
      result.items.forEach((item) => {
        expect(item.category).toBe("company-news");
      });
    });

    it("source와 category 필터를 동시에 적용한다", () => {
      const result = repository.findRecent({
        limit: 100,
        offset: 0,
        source: "sec",
        category: "general",
      });

      result.items.forEach((item) => {
        expect(item.source).toBe("sec");
        expect(item.category).toBe("general");
      });
    });

    it("offset을 적용하여 페이지네이션 한다", () => {
      const page1 = repository.findRecent({ limit: 10, offset: 0 });
      const page2 = repository.findRecent({ limit: 10, offset: 10 });

      expect(page1.items).toHaveLength(10);
      expect(page2.items).toHaveLength(10);
      // 첫 번째 페이지와 두 번째 페이지의 ID가 달라야 함
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
    });
  });

  describe("findById", () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NewsRepository,
          {
            provide: DATABASE_CONNECTION,
            useValue: db,
          },
        ],
      }).compile();

      repository = module.get<NewsRepository>(NewsRepository);
    });

    it("news_id로 뉴스를 찾는다", () => {
      const result = repository.findById("test-news-1");

      expect(result).toBeDefined();
      expect(result?.news_id).toBe("test-news-1");
    });

    it("존재하지 않는 news_id는 null을 반환한다", () => {
      const result = repository.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NewsRepository,
          {
            provide: DATABASE_CONNECTION,
            useValue: db,
          },
        ],
      }).compile();

      repository = module.get<NewsRepository>(NewsRepository);
    });

    it("headline에서 키워드를 검색한다", () => {
      const result = repository.search({
        keyword: "Headline 1",
        limit: 20,
        offset: 0,
      });

      expect(result.items.length).toBeGreaterThan(0);
      result.items.forEach((item) => {
        expect(item.headline.toLowerCase()).toContain("headline 1");
      });
    });

    it("summary에서 키워드를 검색한다", () => {
      const result = repository.search({
        keyword: "summary",
        limit: 20,
        offset: 0,
      });

      expect(result.items.length).toBeGreaterThan(0);
      result.items.forEach((item) => {
        const text = `${item.headline} ${item.summary}`.toLowerCase();
        expect(text).toContain("summary");
      });
    });

    it("검색 결과도 페이지네이션이 적용된다", () => {
      const page1 = repository.search({
        keyword: "Test",
        limit: 10,
        offset: 0,
      });
      const page2 = repository.search({
        keyword: "Test",
        limit: 10,
        offset: 10,
      });

      expect(page1.total).toBe(page2.total);
      if (page1.items.length > 0 && page2.items.length > 0) {
        expect(page1.items[0].id).not.toBe(page2.items[0].id);
      }
    });
  });

  describe("getStats", () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NewsRepository,
          {
            provide: DATABASE_CONNECTION,
            useValue: db,
          },
        ],
      }).compile();

      repository = module.get<NewsRepository>(NewsRepository);
    });

    it("통계 정보를 반환한다", () => {
      const stats = repository.getStats();

      expect(stats.total).toBe(50);
      expect(stats.notified).toBeGreaterThan(0);
      expect(Object.keys(stats.bySource).length).toBeGreaterThan(0);
      expect(Object.keys(stats.byCategory).length).toBeGreaterThan(0);
    });

    it("소스별 통계의 합이 전체 개수와 같다", () => {
      const stats = repository.getStats();
      const sumBySource = Object.values(stats.bySource).reduce(
        (acc, cnt) => acc + cnt,
        0,
      );

      expect(sumBySource).toBe(stats.total);
    });

    it("카테고리별 통계의 합이 전체 개수와 같다", () => {
      const stats = repository.getStats();
      const sumByCategory = Object.values(stats.byCategory).reduce(
        (acc, cnt) => acc + cnt,
        0,
      );

      expect(sumByCategory).toBe(stats.total);
    });
  });

  describe("findAfter", () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NewsRepository,
          {
            provide: DATABASE_CONNECTION,
            useValue: db,
          },
        ],
      }).compile();

      repository = module.get<NewsRepository>(NewsRepository);
    });

    it("특정 id 이후의 뉴스를 가져온다 (SSE용)", () => {
      const result = repository.findAfter(10);

      expect(result.length).toBe(40); // 50개 중 id > 10
      result.forEach((item) => {
        expect(item.id).toBeGreaterThan(10);
      });
    });

    it("id 오름차순으로 정렬된다", () => {
      const result = repository.findAfter(0);

      const ids = result.map((item) => item.id);
      for (let i = 0; i < ids.length - 1; i++) {
        expect(ids[i]).toBeLessThan(ids[i + 1]);
      }
    });
  });
});
