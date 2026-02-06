import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import {
  HealthCheckService,
  HealthCheck,
  HealthCheckResult,
} from "@nestjs/terminus";
import { DatabaseHealthIndicator } from "./database.health";
import { SkipResponseWrap } from "../../common/decorators/skip-response-wrap.decorator";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly databaseHealthIndicator: DatabaseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @SkipResponseWrap()
  @ApiOperation({ summary: "헬스체크 (데이터베이스 연결 상태 포함)" })
  @ApiResponse({
    status: 200,
    description: "서비스가 정상 동작 중",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
        info: {
          type: "object",
          properties: {
            database: {
              type: "object",
              properties: {
                status: { type: "string", example: "up" },
                message: {
                  type: "string",
                  example: "Database connection is healthy",
                },
              },
            },
          },
        },
        error: { type: "object" },
        details: { type: "object" },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: "서비스가 비정상 상태 (DB 연결 실패 등)",
  })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.databaseHealthIndicator.isHealthy("database"),
    ]);
  }
}
