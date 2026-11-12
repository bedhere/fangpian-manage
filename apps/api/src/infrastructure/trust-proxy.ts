import type { NestExpressApplication } from '@nestjs/platform-express';

export function configureTrustProxy(
  app: Pick<NestExpressApplication, 'set'>,
  hops: string | undefined,
): void {
  // Only the private API behind one Caddy hop is supported. Never trust arbitrary
  // forwarded headers or silently coerce malformed configuration to a number.
  if (hops !== undefined && hops !== '0' && hops !== '1')
    throw new Error(
      'TRUST_PROXY_HOPS must be 0 (direct) or 1 (private API behind Caddy)',
    );
  app.set('trust proxy', hops === '1' ? 1 : false);
}
