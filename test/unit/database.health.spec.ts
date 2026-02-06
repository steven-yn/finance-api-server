import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseHealthIndicator } from "../../src/modules/health/database.health";
import { DATABASE_CONNECTION } from "../../src/common/constants/tokens";
import { HealthCheckError } from "@nestjs/terminus";
import Database from "better-sqlite3";

describe("DatabaseHealthIndicator", () => {
  let indicator: DatabaseHealthIndicator;
  let mockDb: Partial<Database.Database>;

  beforeEach(async () => {
    // Mock Database
    mockDb = {
      prepare: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseHealthIndicator,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    indicator = module.get<DatabaseHealthIndicator>(DatabaseHealthIndicator);
  });

  describe("isHealthy()", () => {
    it("DB 쿼리가 정상이면 healthy 상태를 반환한다", async () => {
      // Arrange
      const mockStatement = {
        get: jest.fn().mockReturnValue({ ping: 1 }),
      };
      (mockDb.prepare as jest.Mock).mockReturnValue(mockStatement);

      // Act
      const result = await indicator.isHealthy("database");

      // Assert
      expect(result).toEqual({
        database: {
          status: "up",
          message: "Database connection is healthy",
        },
      });
      expect(mockDb.prepare).toHaveBeenCalledWith("SELECT 1 as ping");
      expect(mockStatement.get).toHaveBeenCalled();
    });

    it("DB 쿼리가 예상치 못한 결과를 반환하면 HealthCheckError를 던진다", async () => {
      // Arrange
      const mockStatement = {
        get: jest.fn().mockReturnValue({ ping: 0 }),
      };
      (mockDb.prepare as jest.Mock).mockReturnValue(mockStatement);

      // Act & Assert
      await expect(indicator.isHealthy("database")).rejects.toThrow(
        HealthCheckError,
      );
      await expect(indicator.isHealthy("database")).rejects.toMatchObject({
        message: "Database health check failed",
        causes: {
          database: {
            status: "down",
            message: "Database query returned unexpected result",
          },
        },
      });
    });

    it("DB 쿼리가 예외를 던지면 HealthCheckError를 던진다", async () => {
      // Arrange
      const mockStatement = {
        get: jest.fn().mockImplementation(() => {
          throw new Error("Connection lost");
        }),
      };
      (mockDb.prepare as jest.Mock).mockReturnValue(mockStatement);

      // Act & Assert
      await expect(indicator.isHealthy("database")).rejects.toThrow(
        HealthCheckError,
      );
      await expect(indicator.isHealthy("database")).rejects.toMatchObject({
        message: "Database health check failed",
        causes: {
          database: {
            status: "down",
            message: "Connection lost",
          },
        },
      });
    });

    it("prepare 자체가 예외를 던지면 HealthCheckError를 던진다", async () => {
      // Arrange
      (mockDb.prepare as jest.Mock).mockImplementation(() => {
        throw new Error("Database not initialized");
      });

      // Act & Assert
      await expect(indicator.isHealthy("database")).rejects.toThrow(
        HealthCheckError,
      );
      await expect(indicator.isHealthy("database")).rejects.toMatchObject({
        message: "Database health check failed",
        causes: {
          database: {
            status: "down",
            message: "Database not initialized",
          },
        },
      });
    });

    it("에러가 Error 인스턴스가 아니면 Unknown error 메시지를 사용한다", async () => {
      // Arrange
      const mockStatement = {
        get: jest.fn().mockImplementation(() => {
          throw "String error"; // Error 객체가 아닌 문자열
        }),
      };
      (mockDb.prepare as jest.Mock).mockReturnValue(mockStatement);

      // Act & Assert
      await expect(indicator.isHealthy("database")).rejects.toMatchObject({
        causes: {
          database: {
            status: "down",
            message: "Unknown error",
          },
        },
      });
    });
  });
});
