import { Test, TestingModule } from "@nestjs/testing";
import { NewsSseService } from "../../src/modules/news/news-sse.service";
import { NewsRepository } from "../../src/modules/news/news.repository";
import { DATABASE_CONNECTION } from "../../src/common/constants/tokens";
import {
  createTestDatabase,
  createMockNewsData,
} from "../fixtures/setup-test-db";
import Database from "better-sqlite3";
import { take, toArray } from "rxjs/operators";

describe("NewsSseService", () => {
  let service: NewsSseService;
  let db: Database.Database;
  let repository: NewsRepository;

  beforeEach(async () => {
    // 인메모리 DB 생성
    db = createTestDatabase(createMockNewsData(10));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsSseService,
        NewsRepository,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<NewsSseService>(NewsSseService);
    repository = module.get<NewsRepository>(NewsRepository);
  });

  afterEach(() => {
    db.close();
  });

  describe("subscribe()", () => {
    it("SSE 스트림을 구독할 수 있다", (done) => {
      const subscription = service.subscribe().subscribe({
        next: (event) => {
          expect(event).toHaveProperty("data");
          expect(event).toHaveProperty("id");
          expect(event).toHaveProperty("type");
          expect(event.type).toBe("news");
          subscription.unsubscribe();
          done();
        },
        error: done,
      });

      // 구독자 수가 증가했는지 확인
      expect(service.getSubscriberCount()).toBe(1);
    });

    it("구독 해제 시 구독자 수가 감소한다", (done) => {
      const subscription = service.subscribe().subscribe(() => {
        // 아무 작업도 하지 않음
      });

      expect(service.getSubscriberCount()).toBe(1);

      subscription.unsubscribe();

      // finalize가 비동기로 실행되므로 약간의 딜레이 후 확인
      setTimeout(() => {
        expect(service.getSubscriberCount()).toBe(0);
        done();
      }, 100);
    });

    it("source 필터가 작동한다", (done) => {
      // DB에 새 뉴스 추가 (finnhub 소스)
      const stmt = db.prepare(`
        INSERT INTO news (news_id, hash, headline, source, category, published_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        "new-finnhub-1",
        "hash-new-1",
        "New Finnhub Article",
        "finnhub",
        "general",
        new Date().toISOString(),
      );

      let timeoutId: NodeJS.Timeout;
      const subscription = service.subscribe("finnhub").subscribe({
        next: (event) => {
          const data = JSON.parse(event.data);
          expect(data.source).toBe("finnhub");
          clearTimeout(timeoutId);
          subscription.unsubscribe();
          done();
        },
        error: (err) => {
          clearTimeout(timeoutId);
          done(err);
        },
      });

      // 5초 후 새 뉴스가 폴링되지 않으면 타임아웃
      timeoutId = setTimeout(() => {
        subscription.unsubscribe();
        done(new Error("Timeout: SSE event not received"));
      }, 6000);
    });

    it("category 필터가 작동한다", (done) => {
      // DB에 새 뉴스 추가 (general 카테고리)
      const stmt = db.prepare(`
        INSERT INTO news (news_id, hash, headline, source, category, published_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        "new-general-1",
        "hash-new-2",
        "New General Article",
        "rss",
        "general",
        new Date().toISOString(),
      );

      let timeoutId: NodeJS.Timeout;
      const subscription = service.subscribe(undefined, "general").subscribe({
        next: (event) => {
          const data = JSON.parse(event.data);
          expect(data.category).toBe("general");
          clearTimeout(timeoutId);
          subscription.unsubscribe();
          done();
        },
        error: (err) => {
          clearTimeout(timeoutId);
          done(err);
        },
      });

      timeoutId = setTimeout(() => {
        subscription.unsubscribe();
        done(new Error("Timeout: SSE event not received"));
      }, 6000);
    });

    it("여러 구독자가 동일한 스트림을 공유한다", () => {
      const sub1 = service.subscribe().subscribe(() => {});
      const sub2 = service.subscribe().subscribe(() => {});

      expect(service.getSubscriberCount()).toBe(2);

      sub1.unsubscribe();
      sub2.unsubscribe();
    });
  });

  describe("getSubscriberCount()", () => {
    it("초기 구독자 수는 0이다", () => {
      expect(service.getSubscriberCount()).toBe(0);
    });

    it("구독 시 구독자 수가 증가한다", () => {
      const sub = service.subscribe().subscribe(() => {});
      expect(service.getSubscriberCount()).toBe(1);
      sub.unsubscribe();
    });
  });
});
