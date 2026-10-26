import { PipeTransform, UnprocessableEntityException } from '@nestjs/common';
import type { ZodType } from 'zod';

export interface ValidationIssue {
  path: string;
  message: string;
}

export class ValidationFailedException extends UnprocessableEntityException {
  constructor(public readonly issues: ValidationIssue[]) {
    super('Request validation failed');
  }
}

/**
 * Validates and normalises a request part against a shared zod schema.
 * Unknown keys are stripped (or rejected for `.strict()` schemas) so mass-assignment is impossible.
 */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new ValidationFailedException(
        result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
    return result.data;
  }
}
