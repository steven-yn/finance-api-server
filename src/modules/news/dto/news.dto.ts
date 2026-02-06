import { ApiProperty } from "@nestjs/swagger";

export class NewsDto {
  @ApiProperty({ description: "뉴스 고유 ID" })
  id: number;

  @ApiProperty({ description: "뉴스 식별자" })
  newsId: string;

  @ApiProperty({ description: "제목" })
  headline: string;

  @ApiProperty({ description: "요약", required: false })
  summary?: string;

  @ApiProperty({ description: "URL", required: false })
  url?: string;

  @ApiProperty({ description: "소스 (finnhub, sec, fred, rss)" })
  source: string;

  @ApiProperty({ description: "카테고리" })
  category: string;

  @ApiProperty({ description: "발행 시각" })
  publishedAt: string;

  @ApiProperty({ description: "관련 심볼", type: [String], required: false })
  symbols?: string[];

  @ApiProperty({ description: "알림 전송 시각", required: false })
  notifiedAt?: string;

  static fromRow(row: any): NewsDto {
    return {
      id: row.id,
      newsId: row.news_id,
      headline: row.headline,
      summary: row.summary ?? undefined,
      url: row.url ?? undefined,
      source: row.source,
      category: row.category,
      publishedAt: row.published_at,
      symbols: row.symbols ? JSON.parse(row.symbols) : undefined,
      notifiedAt: row.notified_at ?? undefined,
    };
  }
}
