import { Inject, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { from, lastValueFrom } from 'rxjs';
import type { RequestUser } from '../auth/auth.types.js';
import { TeamWorkRepository } from './team-work.repository.js';

@Injectable()
export class TeamWorkInterceptor implements NestInterceptor {
  constructor(@Inject(TeamWorkRepository) private readonly repository: TeamWorkRepository) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const actor = context.switchToHttp().getRequest<{ user: RequestUser }>().user;
    return from(this.repository.run(actor, () => lastValueFrom(next.handle())));
  }
}
