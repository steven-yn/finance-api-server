import { HttpException, HttpStatus } from "@nestjs/common";

export class DatabaseException extends HttpException {
  constructor(message: string, originalError?: Error) {
    super(
      {
        success: false,
        error: "Database operation failed",
        code: "DATABASE_ERROR",
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    if (originalError) {
      console.error("Database error details:", originalError);
    }
  }
}

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, id?: string | number) {
    const message = id
      ? `${resource}을(를) 찾을 수 없습니다 (ID: ${id})`
      : `${resource}을(를) 찾을 수 없습니다`;

    super(
      {
        success: false,
        error: message,
        code: "NOT_FOUND",
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
