import { Test, TestingModule } from "@nestjs/testing";
import { NewsService } from "../../src/modules/news/news.service";
import { NewsRepository } from "../../src/modules/news/news.repository";
import { ResourceNotFoundException } from "../../src/common/exceptions/app.exceptions";

describe("NewsService", () => {
  let service: NewsService;
  let repository: NewsRepository;

  const mockRepository = {
    findRecent: jest.fn(),
    findById: jest.fn(),
    search: jest.fn(),
    getStats: jest.fn(),
    findAfter: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        {
          provide: NewsRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<NewsService>(NewsService);
    repository = module.get<NewsRepository>(NewsRepository);

    // 각 테스트 전 mock 초기화
    jest.clearAllMocks();
  });

  describe("findRecent", () => {
    it("Repository의 findRecent를 호출하고 DTO로 변환한다", async () => {
      const mockData = {
        items: [
          {
            id: 1,
            news_id: "test-1",
            headline: "Test News",
            summary: "Summary",
            url: "https://test.com",
            source: "finnhub",
            category: "general",
            published_at: "2024-01-01T00:00:00Z",
            symbols: '["AAPL"]',
            notified_at: null,
          },
        ],
        total: 1,
      };

      mockRepository.findRecent.mockReturnValue(mockData);

      const result = await service.findRecent({
        limit: 20,
        offset: 0,
      });

      expect(mockRepository.findRecent).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].newsId).toBe("test-1");
      expect(result.items[0].symbols).toEqual(["AAPL"]);
      expect(result.meta).toEqual({
        total: 1,
        limit: 20,
        offset: 0,
      });
    });

    it("source와 category 필터를 전달한다", async () => {
      mockRepository.findRecent.mockReturnValue({ items: [], total: 0 });

      await service.findRecent({
        limit: 10,
        offset: 0,
        source: "sec",
        category: "earnings",
      });

      expect(mockRepository.findRecent).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        source: "sec",
        category: "earnings",
      });
    });
  });

  describe("findById", () => {
    it("존재하는 뉴스를 DTO로 변환하여 반환한다", async () => {
      const mockData = {
        id: 1,
        news_id: "test-1",
        headline: "Test News",
        summary: null,
        url: "https://test.com",
        source: "finnhub",
        category: "general",
        published_at: "2024-01-01T00:00:00Z",
        symbols: null,
        notified_at: null,
      };

      mockRepository.findById.mockReturnValue(mockData);

      const result = await service.findById("test-1");

      expect(mockRepository.findById).toHaveBeenCalledWith("test-1");
      expect(result.newsId).toBe("test-1");
      expect(result.summary).toBeUndefined();
      expect(result.symbols).toBeUndefined();
    });

    it("존재하지 않는 뉴스는 ResourceNotFoundException을 던진다", async () => {
      mockRepository.findById.mockReturnValue(null);

      await expect(service.findById("non-existent")).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe("search", () => {
    it("검색 키워드로 Repository를 호출하고 DTO로 변환한다", async () => {
      const mockData = {
        items: [
          {
            id: 1,
            news_id: "test-1",
            headline: "Bitcoin News",
            summary: "BTC price",
            url: "https://test.com",
            source: "finnhub",
            category: "general",
            published_at: "2024-01-01T00:00:00Z",
            symbols: null,
            notified_at: null,
          },
        ],
        total: 1,
      };

      mockRepository.search.mockReturnValue(mockData);

      const result = await service.search({
        q: "Bitcoin",
        limit: 20,
        offset: 0,
      });

      expect(mockRepository.search).toHaveBeenCalledWith({
        keyword: "Bitcoin",
        limit: 20,
        offset: 0,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].headline).toBe("Bitcoin News");
      expect(result.meta).toEqual({
        total: 1,
        limit: 20,
        offset: 0,
      });
    });
  });

  describe("getStats", () => {
    it("Repository의 통계를 그대로 반환한다", async () => {
      const mockStats = {
        total: 100,
        notified: 50,
        bySource: { finnhub: 60, sec: 40 },
        byCategory: { general: 70, earnings: 30 },
      };

      mockRepository.getStats.mockReturnValue(mockStats);

      const result = await service.getStats();

      expect(mockRepository.getStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe("findAfter", () => {
    it("특정 ID 이후의 뉴스를 DTO 배열로 변환한다", async () => {
      const mockData = [
        {
          id: 11,
          news_id: "test-11",
          headline: "News 11",
          summary: null,
          url: "https://test.com/11",
          source: "finnhub",
          category: "general",
          published_at: "2024-01-01T00:00:00Z",
          symbols: null,
          notified_at: null,
        },
        {
          id: 12,
          news_id: "test-12",
          headline: "News 12",
          summary: "Summary 12",
          url: "https://test.com/12",
          source: "sec",
          category: "earnings",
          published_at: "2024-01-02T00:00:00Z",
          symbols: '["TSLA"]',
          notified_at: "2024-01-02T01:00:00Z",
        },
      ];

      mockRepository.findAfter.mockReturnValue(mockData);

      const result = await service.findAfter(10);

      expect(mockRepository.findAfter).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(11);
      expect(result[1].symbols).toEqual(["TSLA"]);
      expect(result[1].notifiedAt).toBe("2024-01-02T01:00:00Z");
    });

    it("결과가 없으면 빈 배열을 반환한다", async () => {
      mockRepository.findAfter.mockReturnValue([]);

      const result = await service.findAfter(999);

      expect(result).toEqual([]);
    });
  });
});
