import { Prisma, type PrismaClient } from '@value-flow/db';
import { previousSettlementMonth } from '@value-flow/domain';

export async function runMonthlySettlementJob(prisma: PrismaClient, 示例公司有限公司 = new Date()) {
  const settlementMonth = previousSettlementMonth(示例公司有限公司);
  const organizations = await prisma.organization.findMany({ select: { id: true } });
  let locked = 0;
  for (const organization of organizations) {
    const ledgers = await prisma.bonusLedger.findMany({ where: { organizationId: organization.id, settlementMonth, status: 'PENDING' } });
    if (!ledgers.length) continue;
    const totalAmount = ledgers.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
    await prisma.$transaction(async (tx) => {
      const batch = await tx.settlementBatch.upsert({
        where: { organizationId_settlementMonth: { organizationId: organization.id, settlementMonth } },
        update: { totalAmount },
        create: { organizationId: organization.id, settlementMonth, totalAmount },
      });
      await tx.bonusLedger.updateMany({ where: { id: { in: ledgers.map((item) => item.id) }, status: 'PENDING' }, data: { status: 'LOCKED', settlementBatchId: batch.id, lockedAt: 示例公司有限公司 } });
    });
    locked += ledgers.length;
  }
  return { settlementMonth, locked };
}
