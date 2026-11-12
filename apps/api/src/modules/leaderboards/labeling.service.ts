import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@value-flow/db';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { AiCenterRepository } from '../ai-center/ai-center.repository.js';
import { activeUser, serializable, shanghaiToday, workDate } from '../trainees/trainee-policy.js';
import type { LabelingEntryDto, LabelingImportDto, LabelingQueryDto } from './labeling.dto.js';
import { canCollectLabeling } from './labeling-tianji.service.js';

type DB = Prisma.TransactionClient;
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const entryView = (row: { traineeId: string; workDate: Date; count: number; version: number; source: string; note: string; updatedAt: Date }) => ({
  traineeId: row.traineeId, workDate: dateKey(row.workDate), count: row.count, version: row.version, source: row.source, note: row.note, updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class LabelingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiCenterRepository) private readonly aiCenter: AiCenterRepository) {}

  private async scope(db: DB, actor: RequestUser, write = false) {
    // loadScope validates the active organization member without requiring AI-center membership.
    const scope = await this.aiCenter.loadScope(db, actor);
    if (write && !scope.isManager) throw new ForbiddenException('仅管理员和AI中台主管可维护打标签数量');
    return scope;
  }

  private async people(db: DB, actor: RequestUser) {
    return db.traineeProfile.findMany({
      where: { organizationId: actor.organizationId, user: { organizationId: actor.organizationId, ...activeUser } },
      select: { userId: true, user: { select: { displayName: true, department: { select: { name: true } } } } },
      orderBy: { userId: 'asc' },
    });
  }

  async leaderboard(actor: RequestUser, query: LabelingQueryDto) {
    const from = query.from ?? shanghaiToday(), to = query.to ?? from;
    const start = workDate(from), end = workDate(to);
    if (start > end) throw new BadRequestException('开始日期不能晚于结束日期');
    if ((end.getTime() - start.getTime()) / 86_400_000 >= 366) throw new BadRequestException('每次最多查看366天');
    return this.prisma.$transaction(async db => {
      const scope = await this.scope(db, actor);
      const people = await this.people(db, actor);
      const totals = await db.traineeLabelingEntry.groupBy({
        by: ['traineeId'],
        where: { organizationId: actor.organizationId, traineeId: { in: people.map(p => p.userId) }, workDate: { gte: start, lte: end } },
        _sum: { count: true }, _count: { _all: true }, _max: { updatedAt: true },
      });
      const byId = new Map(totals.map(row => [row.traineeId, row]));
      const tianji = await db.traineeLabelingTianjiDay.findMany({
        where: { organizationId: actor.organizationId, traineeId: { in: people.map(p => p.userId) }, workDate: { gte: start, lte: end } },
        select: { traineeId: true, workDate: true, count: true, updatedAt: true },
      });
      if (tianji.length) {
        const manual = await db.traineeLabelingEntry.findMany({
          where: { organizationId: actor.organizationId, traineeId: { in: people.map(p => p.userId) }, workDate: { gte: start, lte: end } },
          select: { traineeId: true, workDate: true },
        });
        const overridden = new Set(manual.map(row => `${row.traineeId}/${dateKey(row.workDate)}`));
        for (const day of tianji) {
          if (overridden.has(`${day.traineeId}/${dateKey(day.workDate)}`)) continue;
          const current = byId.get(day.traineeId);
          if (current) {
            current._sum.count = (current._sum.count ?? 0) + day.count;
            current._count._all++;
            if (!current._max.updatedAt || current._max.updatedAt < day.updatedAt) current._max.updatedAt = day.updatedAt;
          } else byId.set(day.traineeId, { traineeId: day.traineeId, _sum: { count: day.count }, _count: { _all: 1 }, _max: { updatedAt: day.updatedAt } });
        }
      }
      const rows = people.map(p => {
        const total = byId.get(p.userId);
        return { traineeId: p.userId, displayName: p.user.displayName, departmentName: p.user.department?.name ?? null,
          count: total?._sum.count ?? 0, reportedDays: total?._count._all ?? 0, updatedAt: total?._max.updatedAt?.toISOString() ?? null, isSelf: p.userId === actor.id, rank: null as number | null };
      }).sort((a, b) => b.count - a.count || Number(b.reportedDays > 0) - Number(a.reportedDays > 0) || a.displayName.localeCompare(b.displayName, 'zh-CN') || a.traineeId.localeCompare(b.traineeId));
      let previousCount: number | null = null, rank = 0, position = 0;
      for (const row of rows) {
        if (!row.reportedDays) continue;
        position++;
        if (row.count !== previousCount) rank = position;
        row.rank = rank; previousCount = row.count;
      }
      return { from, to, timeZone: 'Asia/Shanghai', canManage: scope.isManager, canSync: canCollectLabeling(scope), rows,
        summary: { totalCount: rows.reduce((sum, row) => sum + row.count, 0), participants: rows.filter(row => row.reportedDays > 0).length, traineeCount: people.length } };
    }, { isolationLevel: 'RepeatableRead' });
  }

  async daily(actor: RequestUser, date: string) {
    const day = workDate(date);
    return this.prisma.$transaction(async db => {
      await this.scope(db, actor, true);
      const people = await this.people(db, actor);
      const entries = await db.traineeLabelingEntry.findMany({ where: { organizationId: actor.organizationId, workDate: day, traineeId: { in: people.map(p => p.userId) } } });
      const byId = new Map(entries.map(row => [row.traineeId, row]));
      return { date, rows: people.map(p => ({ traineeId: p.userId, displayName: p.user.displayName, entry: byId.has(p.userId) ? entryView(byId.get(p.userId)!) : null })) };
    }, { isolationLevel: 'RepeatableRead' });
  }

  private async write(db: DB, actor: RequestUser, input: LabelingEntryDto, source: 'MANUAL' | 'API') {
    const day = workDate(input.workDate);
    if (input.workDate > shanghaiToday()) throw new BadRequestException('不能录入未来日期的完成数量');
    if (!Number.isInteger(input.count) || input.count < 0 || input.count > 1_000_000_000) throw new BadRequestException('数量须为0到1000000000的整数');
    const person = await db.traineeProfile.findFirst({ where: { organizationId: actor.organizationId, userId: input.traineeId, user: { organizationId: actor.organizationId, ...activeUser } }, select: { userId: true } });
    if (!person) throw new NotFoundException('请选择本组织有效管培生');
    const key = { organizationId: actor.organizationId, traineeId: input.traineeId, workDate: day };
    const before = await db.traineeLabelingEntry.findUnique({ where: { organizationId_traineeId_workDate: key } });
    if ((before?.version ?? 0) !== input.version) throw new ConflictException('数量已被更新，请重新加载当日数据后核对');
    const data = { count: input.count, note: input.note?.trim() ?? '', source, updatedBy: actor.id };
    let row;
    if (before) {
      const result = await db.traineeLabelingEntry.updateMany({ where: { ...key, version: input.version }, data: { ...data, version: { increment: 1 } } });
      if (result.count !== 1) throw new ConflictException('数量已被更新，请重新加载当日数据后核对');
      row = await db.traineeLabelingEntry.findUniqueOrThrow({ where: { organizationId_traineeId_workDate: key } });
    } else row = await db.traineeLabelingEntry.create({ data: { ...key, ...data } });
    await db.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'TraineeLabelingEntry', entityId: row.id, action: source === 'API' ? 'LABELING_IMPORTED' : 'LABELING_SAVED',
      before: before ? entryView(before) : undefined, after: entryView(row) } });
    return entryView(row);
  }

  private async mutate<T>(operation: (db: DB) => Promise<T>) {
    try { return await serializable(this.prisma, operation); }
    catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('数据已被其他请求写入，请重新读取后核对');
      throw error;
    }
  }

  async save(actor: RequestUser, input: LabelingEntryDto) {
    return this.mutate(async db => { await this.scope(db, actor, true); return this.write(db, actor, input, 'MANUAL'); });
  }

  async import(actor: RequestUser, input: LabelingImportDto) {
    const entries = input.entries.map(row => ({ traineeId: row.traineeId.toLowerCase(), workDate: row.workDate, count: row.count, version: row.version, note: row.note?.trim() ?? '' }))
      .sort((a, b) => a.traineeId.localeCompare(b.traineeId) || a.workDate.localeCompare(b.workDate));
    if (new Set(entries.map(row => `${row.traineeId}/${row.workDate}`)).size !== entries.length) throw new BadRequestException('同一批次不能重复包含同一人同一天');
    const payloadHash = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
    return this.mutate(async db => {
      await this.scope(db, actor, true);
      const key = { organizationId: actor.organizationId, requestId: input.requestId };
      const previous = await db.traineeLabelingImport.findUnique({ where: { organizationId_requestId: key } });
      if (previous) {
        if (previous.payloadHash !== payloadHash) throw new ConflictException('该requestId已用于不同数据，请使用新的requestId');
        return previous.result;
      }
      const result = [];
      for (const row of entries) result.push(await this.write(db, actor, row, 'API'));
      const response = { requestId: input.requestId, imported: result.length, entries: result };
      await db.traineeLabelingImport.create({ data: { ...key, payloadHash, result: response } });
      return response;
    });
  }
}
