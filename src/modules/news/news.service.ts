import { Injectable } from "@nestjs/common";
import { NewsRepository } from "./news.repository";
import { NewsDto } from "./dto/news.dto";
import {
  NewsQueryDto,
  NewsSearchDto,
  NewsStatsDto,
} from "./dto/news-query.dto";
import { ResourceNotFoundException } from "../../common/exceptions/app.exceptions";

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

@Injectable()
export class NewsService {
  constructor(private readonly repository: NewsRepository) {}

  async findRecent(query: NewsQueryDto): Promise<PaginatedResponse<NewsDto>> {
    const { items, total } = this.repository.findRecent({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      source: query.source,
      category: query.category,
    });

    return {
      items: items.map((row) => NewsDto.fromRow(row)),
      meta: {
        total,
        limit: query.limit ?? 20,
        offset: query.offset ?? 0,
      },
    };
  }

  async findById(newsId: string): Promise<NewsDto> {
    const news = this.repository.findById(newsId);

    if (!news) {
      throw new ResourceNotFoundException("뉴스", newsId);
    }

    return NewsDto.fromRow(news);
  }

  async search(query: NewsSearchDto): Promise<PaginatedResponse<NewsDto>> {
    const { items, total } = this.repository.search({
      keyword: query.q,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });

    return {
      items: items.map((row) => NewsDto.fromRow(row)),
      meta: {
        total,
        limit: query.limit ?? 20,
        offset: query.offset ?? 0,
      },
    };
  }

  async getStats(): Promise<NewsStatsDto> {
    return this.repository.getStats();
  }

  async findAfter(lastId: number): Promise<NewsDto[]> {
    const items = this.repository.findAfter(lastId);
    return items.map((row) => NewsDto.fromRow(row));
  }
}
