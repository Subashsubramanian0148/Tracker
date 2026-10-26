import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ProblemDetails } from '@ado-metrics/shared';
import type { Request, Response } from 'express';
import { traceIdOf } from './decorators';
import { ValidationFailedException } from './zod-validation.pipe';

const TITLES: Record<number, string> = {
  400: 'Bad request',
  401: 'Authentication required',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  413: 'Payload too large',
  415: 'Unsupported media type',
  422: 'Validation failed',
  429: 'Too many requests',
  500: 'Internal server error',
  503: 'Service unavailable',
};

/**
 * Converts every error into RFC 9457 problem details. Internal errors are logged with the
 * stack trace server-side and reach the client only as a generic message plus the trace id.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const traceId = traceIdOf(req);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail: string | undefined;
    let errors: ProblemDetails['errors'];

    if (exception instanceof ValidationFailedException) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      errors = exception.issues;
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      // Client errors carry a safe, intentional message; server errors never do.
      if (status < 500) detail = extractMessage(exception);
    } else if (isBodyParserError(exception)) {
      status = exception.status;
    }

    if (status >= 500) {
      this.logger.error({ err: exception, traceId }, 'Unhandled error');
    }

    const body: ProblemDetails = {
      type: 'about:blank',
      title: TITLES[status] ?? 'Error',
      status,
      traceId,
      ...(detail ? { detail } : {}),
      ...(errors ? { errors } : {}),
    };
    if (res.headersSent) return;
    res.status(status).type('application/problem+json').json(body);
  }
}

function extractMessage(e: HttpException): string | undefined {
  const r = e.getResponse();
  if (typeof r === 'string') return r;
  if (r && typeof r === 'object' && 'message' in r) {
    const m = (r as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return undefined;
}

function isBodyParserError(e: unknown): e is { status: number; type: string } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'type' in e &&
    'status' in e &&
    typeof (e as { status: unknown }).status === 'number' &&
    (e as { status: number }).status >= 400 &&
    (e as { status: number }).status < 500
  );
}
