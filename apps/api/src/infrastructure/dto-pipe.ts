import { ValidationPipe, type Type } from '@nestjs/common';
/** Explicit DTO metadata also supports runtimes/transpilers that omit decorator type metadata. */
export function dtoPipe(expectedType: Type<unknown>) {
  return new ValidationPipe({
    expectedType,
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
}
