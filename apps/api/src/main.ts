import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';
import { configureTrustProxy } from './infrastructure/trust-proxy.js';
import { configureLabelingBodyParser } from './modules/leaderboards/labeling-body-parser.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureLabelingBodyParser(app);
  app.useBodyParser('json', {
    limit: '1mb',
    type: (request) => /^\/api\/ai-center(?:\/|$)/.test(request.url ?? '')
      && request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json',
  });
  app.useBodyParser('json', {
    limit: '400kb',
    type: (request) => /^\/api\/trainees\/growth(?:\/|$)/.test(request.url ?? '')
      && request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json',
  });
  app.useBodyParser('json', {
    limit: '15mb',
    type: (request) => request.url?.startsWith('/api/external-collab/') === true
      && request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json',
  });
  app.useBodyParser('json', { limit: '100kb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '100kb' });
  configureTrustProxy(app, process.env.TRUST_PROXY_HOPS);
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(',') ?? [
      'http://localhost:3000',
      'http://localhost:3002',
    ],
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
