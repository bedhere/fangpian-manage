import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthService } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RegistrationController } from '../auth/registration.controller.js';
import { RegistrationService } from '../auth/registration.service.js';
import { TraineeController } from './trainee.controller.js';
import { TraineeService } from './trainee.service.js';

describe('trainee HTTP validation, authentication and registration throttling', () => {
  let app: INestApplication;
  let firstLogin = false;
  const registration = {
    options: vi.fn(async () => ({ registrationAvailable: true, mentors: [] })),
    register: vi.fn(async () => ({
      username: 'zhangsan999',
      displayName: '张三',
      mustChangePassword: true,
    })),
  };
  const trainees = {
    workspace: vi.fn(async () => ({ submissions: [] })),
    create: vi.fn(),
    update: vi.fn(),
    submit: vi.fn(),
    review: vi.fn(),
    enroll: vi.fn(),
    assignMentor: vi.fn(),
  };
  beforeEach(async () => {
    firstLogin = false;
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [RegistrationController, TraineeController],
      providers: [
        JwtAuthGuard,
        { provide: RegistrationService, useValue: registration },
        { provide: TraineeService, useValue: trainees },
        {
          provide: AuthService,
          useValue: {
            authenticate: async () => ({
              id: 'self',
              organizationId: 'org',
              roles: ['TRAINEE'],
              permissions: [],
              mustChangePassword: firstLogin,
            }),
          },
        },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  it('provides public safe registration options and registration without login', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/registration-options')
      .expect(200)
      .expect({ registrationAvailable: true, mentors: [] });
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ displayName: '张三' })
      .expect(201)
      .expect({
        username: 'zhangsan999',
        displayName: '张三',
        mustChangePassword: true,
      });
  });
  it.each([
    { displayName: '张三', roles: ['OWNER'] },
    { displayName: '张三', organizationId: 'foreign' },
    { displayName: '张三', permissions: ['analytics:executive'] },
    { mentorId: 'invalid' },
  ])(
    'rejects applicant-controlled privileges and malformed fields %j',
    async (body) => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(body)
        .expect(400);
      expect(registration.register).not.toHaveBeenCalled();
    },
  );
  it('throttles the sixth registration request from one client', async () => {
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ displayName: '张三' })
        .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ displayName: '张三' })
      .expect(429);
    expect(registration.register).toHaveBeenCalledTimes(5);
  });
  it('requires authentication and first password change on business routes', async () => {
    await request(app.getHttpServer()).get('/api/trainees').expect(401);
    firstLogin = true;
    const response = await request(app.getHttpServer())
      .get('/api/trainees')
      .set('authorization', 'Bearer access')
      .expect(403);
    expect(response.body.code).toBe('MUST_CHANGE_PASSWORD');
    expect(trainees.workspace).not.toHaveBeenCalled();
  });
  it('rejects missing versions, invalid decisions and unknown mutable ownership', async () => {
    const url =
      '/api/trainees/submissions/00000000-0000-4000-8000-000000000001';
    await request(app.getHttpServer())
      .post(`${url}/submit`)
      .set('authorization', 'Bearer access')
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post(`${url}/review`)
      .set('authorization', 'Bearer access')
      .send({ version: 1, decision: 'DRAFT' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(url)
      .set('authorization', 'Bearer access')
      .send({ version: 1, traineeId: 'someone' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/trainees/00000000-0000-4000-8000-000000000001/mentor')
      .set('authorization', 'Bearer access')
      .send({})
      .expect(400);
  });
});
