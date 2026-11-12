import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { publicUser } from '../domain/types.js';
import { store } from '../store/index.js';
import type { RequestUser } from '../../auth/auth.types.js';

/** JWT has already authenticated the caller; resolve the canonical organization snapshot. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const actor = context.switchToHttp().getRequest<{ user: RequestUser }>().user;
  const user = store.db.users.find(u => u.id === actor.id);
  if (!user) throw new Error('成员不在当前组织');
  return publicUser(user);
});
