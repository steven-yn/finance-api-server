import { Injectable, Inject } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { Database } from "better-sqlite3";
import { DATABASE_CONNECTION } from "../../common/constants/tokens";

/**
 * 데이터베이스 연결 상태를 확인하는 헬스 인디케이터
 */
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {
    super();
  }

  /**
   * 데이터베이스 연결 및 쿼리 가능 여부 확인
   * @param key 헬스체크 결과의 키 이름
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // 간단한 쿼리로 DB 연결 확인
      const result = this.db.prepare("SELECT 1 as ping").get() as {
        ping: number;
      };

      if (result.ping !== 1) {
        throw new Error("Database query returned unexpected result");
      }

      return this.getStatus(key, true, {
        message: "Database connection is healthy",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      throw new HealthCheckError(
        "Database health check failed",
        this.getStatus(key, false, {
          message: errorMessage,
        }),
      );
    }
  }
}
