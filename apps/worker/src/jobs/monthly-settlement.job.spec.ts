import { describe, expect, it, vi } from 'vitest';
import { runMonthlySettlementJob } from './monthly-settlement.job.js';

describe('monthly settlement job idempotency', () => {
  it('does not create or update a batch when the month has no pending ledgers', async () => {
    const transaction = vi.fn();
    const prisma = {
      organization: { findMany: vi.fn().mockResolvedValue([{ id: 'org-1' }]) },
      bonusLedger: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: transaction,
    };
    const result = await runMonthlySettlementJob(prisma as never, new Date('2026-10-08T00:00:00Z'));
    expect(result.locked).toBe(0);
    expect(transaction).not.toHaveBeenCalled();
  });
});
