import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { LabelingController } from './labeling.controller.js';
import { LabelingService } from './labeling.service.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureLabelingBodyParser } from './labeling-body-parser.js';

describe('labeling HTTP boundaries', () => {
  let app: INestApplication, trainee: boolean;
  const service = { leaderboard: vi.fn(async () => ({ rows: [] })), daily: vi.fn(), save: vi.fn(async () => ({})), import: vi.fn(async () => ({})) };
  const input = { traineeId: '11111111-1111-4111-8111-111111111111', workDate: '2026-11-01', count: 12, version: 0 };
  beforeEach(async () => {
    trainee = false; vi.clearAllMocks();
    const module = await Test.createTestingModule({ controllers: [LabelingController], providers: [JwtAuthGuard, { provide: LabelingService, useValue: service }, { provide: AuthService, useValue: { authenticate: async () => ({ id: 'viewer', organizationId: 'org', roles: trainee ? ['TRAINEE'] : ['OWNER'], mustChangePassword: false }) } }] }).compile();
    const expressApp = module.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureLabelingBodyParser(expressApp); expressApp.useBodyParser('json', { limit: '100kb' });
    app = expressApp; app.setGlobalPrefix('api'); await app.init();
  });
  afterEach(async () => app.close());
  it('requires login', async () => { await request(app.getHttpServer()).get('/api/leaderboards/labeling').expect(401); expect(service.leaderboard).not.toHaveBeenCalled(); });
  it('allows trainee read access but rejects maintenance routes', async () => {
    trainee = true;
    await request(app.getHttpServer()).get('/api/leaderboards/labeling?from=2026-11-01&to=2026-11-02').auth('access', { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).put('/api/leaderboards/labeling/entries').auth('access', { type: 'bearer' }).send(input).expect(403);
    await request(app.getHttpServer()).get('/api/leaderboards/labeling/daily?date=2026-11-01').auth('access', { type: 'bearer' }).expect(403);
  });
  it.each([{ count: -1 }, { count: 0.5 }, { count: '12' }, { count: null }, { count: 1_000_000_001 }, { version: -1 }, { traineeId: 'invalid' }, { organizationId: 'foreign' }, { source: 'API' }])('rejects malformed counts, versions or client privileges %j', async change => {
    await request(app.getHttpServer()).put('/api/leaderboards/labeling/entries').auth('access', { type: 'bearer' }).send({ ...input, ...change }).expect(400); expect(service.save).not.toHaveBeenCalled();
  });
  it('validates every nested import row', async () => {
    await request(app.getHttpServer()).post('/api/leaderboards/labeling/imports').auth('access', { type: 'bearer' }).send({ requestId: input.traineeId, entries: [{ ...input, count: -1 }] }).expect(400); expect(service.import).not.toHaveBeenCalled();
  });
  it('accepts a full batch of 200 Chinese notes beyond the default body limit', async () => {
    const entries = Array.from({ length: 200 }, (_, index) => ({ ...input, workDate: '2026-11-01', traineeId: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`, note: '数'.repeat(1000) }));
    await request(app.getHttpServer()).post('/api/leaderboards/labeling/imports').auth('access', { type: 'bearer' }).send({ requestId: input.traineeId, entries }).expect(201);
    expect(service.import).toHaveBeenCalledOnce();
  });
});
