import { Injectable, Logger } from "@nestjs/common";
import { Observable, timer } from "rxjs";
import { switchMap, share, finalize, filter, map } from "rxjs/operators";
import { NewsRepository } from "./news.repository";
import { NewsDto } from "./dto/news.dto";

export interface NewsEvent {
  id: number;
  newsId: string;
  headline: string;
  summary: string | null;
  url: string | null;
  source: string;
  category: string;
  publishedAt: string;
  symbols: string[] | null;
}

@Injectable()
export class NewsSseService {
  private readonly logger = new Logger(NewsSseService.name);
  private subscriberCount = 0;
  private lastId = 0;

  private readonly newsStream$: Observable<NewsEvent>;

  constructor(private readonly newsRepository: NewsRepository) {
    // 5초마다 새로운 뉴스를 폴링하는 스트림
    // share()로 모든 구독자가 단일 폴링을 공유 → DB 부하 최소화
    this.newsStream$ = timer(0, 5000).pipe(
      switchMap(() => this.pollNewArticles()),
      share(), // 모든 구독자가 하나의 폴링 스트림을 공유
    );
  }

  /**
   * SSE 스트림 구독 (선택적 필터링)
   * @param source 뉴스 소스 필터 (선택)
   * @param category 뉴스 카테고리 필터 (선택)
   */
  subscribe(
    source?: string,
    category?: string,
  ): Observable<{ data: string; id?: string; type?: string }> {
    this.subscriberCount++;
    this.logger.log(
      `New SSE subscriber (total: ${this.subscriberCount}). Filters: source=${source ?? "none"}, category=${category ?? "none"}`,
    );

    return this.newsStream$.pipe(
      // 소스 필터링
      filter((event) => !source || event.source === source),
      // 카테고리 필터링
      filter((event) => !category || event.category === category),
      // SSE 메시지 포맷으로 변환
      map((event) => ({
        data: JSON.stringify(event),
        id: String(event.id),
        type: "news",
      })),
      // 구독 종료 시 카운터 감소
      finalize(() => {
        this.subscriberCount--;
        this.logger.log(
          `SSE subscriber disconnected (remaining: ${this.subscriberCount})`,
        );
      }),
    );
  }

  /**
   * DB에서 새로운 뉴스를 폴링
   * lastId 이후의 새 항목만 조회
   */
  private pollNewArticles(): Observable<NewsEvent> {
    return new Observable((subscriber) => {
      try {
        const newArticles = this.newsRepository.findAfter(this.lastId);

        if (newArticles.length > 0) {
          this.logger.debug(`Found ${newArticles.length} new articles`);

          // 각 새 기사를 이벤트로 방출
          newArticles.forEach((row) => {
            const event = this.rowToEvent(row);
            subscriber.next(event);

            // lastId 업데이트
            if (row.id > this.lastId) {
              this.lastId = row.id;
            }
          });
        }

        subscriber.complete();
      } catch (error) {
        this.logger.error("Failed to poll new articles", error);
        subscriber.error(error);
      }
    });
  }

  /**
   * DB row를 NewsEvent로 변환
   */
  private rowToEvent(row: any): NewsEvent {
    return {
      id: row.id,
      newsId: row.news_id,
      headline: row.headline,
      summary: row.summary ?? null,
      url: row.url ?? null,
      source: row.source,
      category: row.category,
      publishedAt: row.published_at,
      symbols: row.symbols ? JSON.parse(row.symbols) : null,
    };
  }

  /**
   * 현재 구독자 수 반환 (모니터링/디버깅용)
   */
  getSubscriberCount(): number {
    return this.subscriberCount;
  }
}
