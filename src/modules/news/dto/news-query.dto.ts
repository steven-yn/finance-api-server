import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min, Max, Length } from "class-validator";

export class NewsQueryDto {
  @ApiProperty({
    description: "페이지 크기",
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: "오프셋",
    required: false,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiProperty({ description: "소스 필터", required: false })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ description: "카테고리 필터", required: false })
  @IsOptional()
  @IsString()
  category?: string;
}

export class NewsSearchDto {
  @ApiProperty({ description: "검색 키워드", minLength: 1, maxLength: 200 })
  @IsString()
  @Length(1, 200)
  q: string;

  @ApiProperty({
    description: "페이지 크기",
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: "오프셋",
    required: false,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class NewsStatsDto {
  @ApiProperty({ description: "전체 뉴스 수" })
  total: number;

  @ApiProperty({ description: "알림 전송된 뉴스 수" })
  notified: number;

  @ApiProperty({ description: "소스별 통계" })
  bySource: Record<string, number>;

  @ApiProperty({ description: "카테고리별 통계" })
  byCategory: Record<string, number>;
}
