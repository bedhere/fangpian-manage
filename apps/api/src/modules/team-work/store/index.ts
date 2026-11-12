import { AsyncLocalStorage } from 'node:async_hooks';
import type { Db } from '../domain/types.js';

const context = new AsyncLocalStorage<Db>();
export function runWithDb<T>(db: Db, operation: () => T): T { return context.run(db, operation); }

/** Request-local snapshot. Only the interceptor may load/save it inside a locked transaction. */
export const store = {
  get db(): Db {
    const db = context.getStore();
    if (!db) throw new Error('团队协作缺少组织事务上下文');
    return db;
  },
  async init(): Promise<void> { void this.db; },
  async update<T>(operation: (db: Db) => T): Promise<T> { return operation(this.db); },
};
