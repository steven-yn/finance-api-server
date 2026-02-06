import {
  Controller,
  Get,
  Query,
  Param,
  ValidationPipe,
  Sse,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Request } from "express";
import { Observable } from "rxjs";
import { NewsService } from "./news.service";
import { NewsSseService } from "./news-sse.service";
import { NewsDto } from "./dto/news.dto";
import {
  NewsQueryDto,
  NewsSearchDto,
  NewsStatsDto,
} from "./dto/news-query.dto";
import { SkipResponseWrap } from "../../common/decorators/skip-response-wrap.decorator";

@ApiTags("news")
@Controller("news")
export class NewsController {
  constructor(
    private readonly newsService: NewsService,
    private readonly newsSseService: NewsSseService,
  ) {}

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

  @Sse("stream")
  @SkipResponseWrap()
  @ApiOperation({ summary: "실시간 뉴스 스트림 (SSE)" })
  @ApiResponse({
    status: 200,
    description: "Server-Sent Events 스트림",
  })
  stream(
    @Query(ValidationPipe) query: NewsQueryDto,
    @Req() req: Request,
  ): Observable<{ data: string; id?: string; type?: string }> {
    // req.on('close')로 클라이언트 연결 해제를 감지하여 구독 정리
    return new Observable((subscriber) => {
      const sub = this.newsSseService
        .subscribe(query.source, query.category)
        .subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
        });

      req.on("close", () => {
        sub.unsubscribe();
        subscriber.complete();
      });
    });
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
