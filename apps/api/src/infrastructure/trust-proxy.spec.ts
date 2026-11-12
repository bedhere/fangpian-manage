import { afterEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { RegistrationController } from '../modules/auth/registration.controller.js';
import { RegistrationService } from '../modules/auth/registration.service.js';
import { configureTrustProxy } from './trust-proxy.js';

describe('bounded Express proxy trust with real registration HTTP throttling', () => {
  let app: NestExpressApplication | undefined;
  async function start(hops?: string) {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [RegistrationController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        {
          provide: RegistrationService,
          useValue: { register: async () => ({ username: 'zhangsan999' }) },
        },
      ],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureTrustProxy(app, hops);
    app.setGlobalPrefix('api');
    await app.init();
    return (forwardedFor: string) =>
      request(app!.getHttpServer())
        .post('/api/auth/register')
        .set('X-Forwarded-For', forwardedFor)
        .send({ displayName: '张三' });
  }
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('gives each nearest forwarded client five requests behind the same single proxy', async () => {
    const register = await start('1');
    for (let i = 0; i < 5; i++) {
      await register('198.51.100.10').expect(201);
      await register('198.51.100.20').expect(201);
    }
    await register('198.51.100.10').expect(429);
    await register('198.51.100.20').expect(429);
    await register('198.51.100.30').expect(201);
  });

  it('ignores spoofed earlier list entries when the nearest client has exhausted its budget', async () => {
    const register = await start('1');
    for (let i = 1; i <= 5; i++)
      await register(`203.0.113.${i}, 198.51.100.10`).expect(201);
    await register('203.0.113.99, 203.0.113.100, 198.51.100.10').expect(429);
    await register('203.0.113.99, 198.51.100.20').expect(201);
  });

  it.each([undefined, '0'])(
    'ignores forwarded clients for direct requests with trust setting %j',
    async (hops) => {
      const register = await start(hops);
      for (let i = 1; i <= 5; i++)
        await register(`198.51.100.${i}`).expect(201);
      await register('198.51.100.99').expect(429);
      expect(app!.getHttpAdapter().getInstance().get('trust proxy')).toBe(
        false,
      );
    },
  );

  it.each([
    '',
    ' ',
    'true',
    'false',
    '-1',
    '1.5',
    '1e0',
    '01',
    '2',
    '99999999999999999999',
    'Infinity',
    'loopback',
    '*',
  ])('rejects invalid or unsupported trust setting %j', (hops) => {
    const set = vi.fn();
    expect(() => configureTrustProxy({ set }, hops)).toThrow(
      /TRUST_PROXY_HOPS/,
    );
    expect(set).not.toHaveBeenCalled();
  });
});
