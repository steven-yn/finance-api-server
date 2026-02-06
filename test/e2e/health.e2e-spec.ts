import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { DATABASE_CONNECTION } from "../../src/common/constants/tokens";
import { createTestDatabase } from "../fixtures/setup-test-db";
import Database from "better-sqlite3";
import { ApiExceptionFilter } from "../../src/common/filters/api-exception.filter";
import { ResponseInterceptor } from "../../src/common/interceptors/response.interceptor";
import { Reflector } from "@nestjs/core";

describe("Health API (e2e)", () => {
  let app: INestApplication;
  let db: Database.Database;

  beforeAll(async () => {
    // 테스트용 인메모리 DB 생성
    db = createTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE_CONNECTION)
      .useValue(db)
      .compile();

    app = moduleFixture.createNestApplication();

    // 전역 설정 적용 (main.ts와 동일)
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

    await app.init();
  });

  afterAll(async () => {
    db.close();
    await app.close();
  });

  describe("GET /api/v1/health", () => {
    it("헬스체크가 성공하고 데이터베이스 상태를 반환한다", () => {
      return request(app.getHttpServer())
        .get("/api/v1/health")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("status");
          expect(res.body.status).toBe("ok");
          expect(res.body).toHaveProperty("info");
          expect(res.body.info).toHaveProperty("database");
          expect(res.body.info.database.status).toBe("up");
          expect(res.body.info.database.message).toBe(
            "Database connection is healthy",
          );
        });
    });

    it("헬스체크 응답이 ResponseInterceptor를 거치지 않는다", () => {
      return request(app.getHttpServer())
        .get("/api/v1/health")
        .expect(200)
        .expect((res) => {
          // Terminus 표준 응답이므로 success 필드가 없어야 함
          expect(res.body).not.toHaveProperty("success");
          expect(res.body).toHaveProperty("status");
        });
    });
  });
});
