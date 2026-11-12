import type { NestExpressApplication } from '@nestjs/platform-express';

export function configureLabelingBodyParser(app: NestExpressApplication) {
  // 200 rows with 1000 Chinese characters of notes fit within this bounded route limit.
  app.useBodyParser('json', {
    limit: '1mb',
    type: request => /^\/api\/leaderboards\/labeling\/imports\/?(?:\?|$)/.test(request.url ?? '')
      && request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json',
  });
}
