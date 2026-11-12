import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { LabelingTianjiController } from './labeling-tianji.controller.js';
import { LabelingTianjiService } from './labeling-tianji.service.js';
describe('trainee personal Tianji HTTP access', () => {
  let app: INestApplication;
  const service = { status: vi.fn(async () => ({ authenticated: false })), loginStart: vi.fn(async () => ({})), loginCallback: vi.fn(async () => ({ ok: true })), start: vi.fn(async () => ({ id: 'job' })), job: vi.fn(async () => ({})) };
  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({ controllers: [LabelingTianjiController], providers: [JwtAuthGuard, { provide: LabelingTianjiService, useValue: service }, { provide: AuthService, useValue: { authenticate: async () => ({ id: 'member', organizationId: 'org', roles: ['TRAINEE'], permissions: [], mustChangePassword: false }) } }] }).compile();
    app = module.createNestApplication(); app.setGlobalPrefix('api'); await app.init();
  });
  afterEach(async () => app.close());
  it('requires login and allows TRAINEE status and personal authorization', async () => {
    await request(app.getHttpServer()).get('/api/leaderboards/labeling/tianji/status').expect(401);
    await request(app.getHttpServer()).get('/api/leaderboards/labeling/tianji/status').auth('access', { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).post('/api/leaderboards/labeling/tianji/login/start').auth('access', { type: 'bearer' }).send({}).expect(201);
  });
  it('allows collection with explicit dates while leaving existing manual maintenance restricted', async () => {
    await request(app.getHttpServer()).post('/api/leaderboards/labeling/tianji/sync').auth('access', { type: 'bearer' }).send({ from: '2026-11-01', to: '2026-11-02' }).expect(201);
    expect(service.start).toHaveBeenCalledWith(expect.objectContaining({ id: 'member' }), { from: '2026-11-01', to: '2026-11-02' });
  });
  it.each([{ from: 'invalid', to: '2026-11-02' }, { from: '2026-11-01', to: '2026-11-02', actorId: 'someone-else' }, { code: 'valid', state: 'short' }])('rejects invalid parameters and caller impersonation %j', async body => {
    const suffix = 'code' in body ? 'login/callback' : 'sync';
    await request(app.getHttpServer()).post(`/api/leaderboards/labeling/tianji/${suffix}`).auth('access', { type: 'bearer' }).send(body).expect(400);
    expect(service.start).not.toHaveBeenCalled(); expect(service.loginCallback).not.toHaveBeenCalled();
  });
  it('retains state validation and callback identity from the authenticated member', async () => {
    await request(app.getHttpServer()).post('/api/leaderboards/labeling/tianji/login/callback').auth('access', { type: 'bearer' }).send({ code: 'one-time-code', state: 'a'.repeat(43) }).expect(201);
    expect(service.loginCallback).toHaveBeenCalledWith(expect.objectContaining({ id: 'member', organizationId: 'org' }), { code: 'one-time-code', state: 'a'.repeat(43) });
  });
});
