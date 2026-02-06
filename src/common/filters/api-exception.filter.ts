import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: {
      success: boolean;
      error: string;
      code: string;
    } = {
      success: false,
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, any>;

        if (responseObj.code) {
          errorResponse = responseObj as typeof errorResponse;
        } else if (responseObj.message) {
          errorResponse = {
            success: false,
            error: Array.isArray(responseObj.message)
              ? responseObj.message.join(", ")
              : responseObj.message,
            code:
              status === HttpStatus.BAD_REQUEST
                ? "VALIDATION_ERROR"
                : "HTTP_ERROR",
          };
        }
      } else {
        errorResponse.error = String(exceptionResponse);
      }
    } else {
      console.error("Unhandled exception:", exception);
    }

    response.status(status).json(errorResponse);
  }
}
