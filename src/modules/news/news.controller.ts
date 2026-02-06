import { Controller, Get, Query, Param, ValidationPipe } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { NewsService } from "./news.service";
import { NewsDto } from "./dto/news.dto";
import {
  NewsQueryDto,
  NewsSearchDto,
  NewsStatsDto,
} from "./dto/news-query.dto";

@ApiTags("news")
@Controller("news")
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  @ApiOperation({ summary: "최근 뉴스 목록 조회" })
  @ApiResponse({
    status: 200,
    description: "뉴스 목록",
    type: [NewsDto],
  })
  async findRecent(@Query(ValidationPipe) query: NewsQueryDto) {
    return this.newsService.findRecent(query);
  }

  @Get("search")
  @ApiOperation({ summary: "뉴스 검색" })
  @ApiResponse({
    status: 200,
    description: "검색 결과",
    type: [NewsDto],
  })
  async search(@Query(ValidationPipe) query: NewsSearchDto) {
    return this.newsService.search(query);
  }

  @Get("stats")
  @ApiOperation({ summary: "뉴스 통계 조회" })
  @ApiResponse({
    status: 200,
    description: "통계 정보",
    type: NewsStatsDto,
  })
  async getStats() {
    return this.newsService.getStats();
  }

  @Get(":newsId")
  @ApiOperation({ summary: "뉴스 상세 조회" })
  @ApiResponse({
    status: 200,
    description: "뉴스 상세",
    type: NewsDto,
  })
  @ApiResponse({
    status: 404,
    description: "뉴스를 찾을 수 없음",
  })
  async findById(@Param("newsId") newsId: string) {
    return this.newsService.findById(newsId);
  }
}
