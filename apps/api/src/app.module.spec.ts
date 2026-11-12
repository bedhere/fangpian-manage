import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';

describe('AppModule security guards', () => {
  it('enforces configured throttling globally', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) as Array<{
      provide?: unknown;
      useClass?: unknown;
    }>;

    expect(providers).toEqual(
      expect.arrayContaining([{ provide: APP_GUARD, useClass: ThrottlerGuard }]),
    );
  });
});
