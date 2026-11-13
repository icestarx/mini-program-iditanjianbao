import { createHmac, timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

type SessionClaims = { sub: string; iss: string; exp: number };
type AuthenticatedRequest = Request & { user: { userId: string } };

@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers.authorization?.match(/^Bearer ([^ ]+)$/)?.[1];
    const secret = process.env.SESSION_SIGNING_SECRET;
    if (!token || !secret || secret.length < 32) throw new UnauthorizedException({ code: 'UNAUTHORIZED' });

    const [header, payload, signature, extra] = token.split('.');
    if (!header || !payload || !signature || extra) throw new UnauthorizedException({ code: 'UNAUTHORIZED' });
    const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
    let actual: Buffer;
    try { actual = Buffer.from(signature, 'base64url'); } catch { throw new UnauthorizedException({ code: 'UNAUTHORIZED' }); }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new UnauthorizedException({ code: 'UNAUTHORIZED' });

    try {
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionClaims;
      if (claims.iss !== 'iditanjianbao-session' || !Number.isInteger(claims.exp) || claims.exp <= Date.now() / 1000 || !/^[0-9a-f-]{36}$/i.test(claims.sub)) {
        throw new Error('invalid claims');
      }
      request.user = { userId: claims.sub };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED' });
    }
  }
}
