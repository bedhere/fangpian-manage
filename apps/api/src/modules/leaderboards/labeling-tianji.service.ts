import { BadGatewayException, BadRequestException, ConflictException, ForbiddenException, HttpException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@value-flow/db';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AiCenterRepository } from '../ai-center/ai-center.repository.js';
import type { AiScope } from '../ai-center/ai-center.types.js';
import type { RequestUser } from '../auth/auth.types.js';
import { signExternalRequest } from '../external-collab/proxy-security.js';
import { activeUser, shanghaiToday, workDate } from '../trainees/trainee-policy.js';
import { collectTianjiLabeling, type TianjiPage } from './labeling-tianji-projection.js';

export function canCollectLabeling(scope: Pick<AiScope, 'isManager' | 'isTrainee' | 'isAiStaff'>) {
  return !!(scope.isManager || scope.isTrainee || scope.isAiStaff);
}
type Job = Prisma.TraineeLabelingSyncGetPayload<object>;
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
export function labelingMemberIds(scope: Pick<AiScope, 'members' | 'users'>) {
  return [...scope.members].filter(([id, member]) => member.data.active && scope.users.get(id)?.active).map(([id]) => id);
}
const memberNames = (scope: AiScope) => new Set(labelingMemberIds(scope).map(id => scope.users.get(id)!.name.trim()));
function view(row: Job, allowedNames = new Set<string>()) {
  const stored = row.result && typeof row.result === 'object' && !Array.isArray(row.result) ? row.result : null;
  const result = stored ? { ...stored, skippedNames: Array.isArray(stored.skippedNames)
    ? stored.skippedNames.filter((name): name is string => typeof name === 'string' && allowedNames.has(name)) : [] } : null;
  return { id: row.id, from: dayKey(row.from), to: dayKey(row.to), status: row.status, message: row.message,
    processed: row.processed, result, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), finishedAt: row.finishedAt?.toISOString() ?? null };
}

@Injectable()
export class LabelingTianjiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LabelingTianjiService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private closed = false;
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiCenterRepository) private readonly aiCenter: AiCenterRepository) {}

  onModuleInit() { this.timer = setInterval(() => void this.drain(), 5000); this.timer.unref(); }
  onModuleDestroy() { this.closed = true; if (this.timer) clearInterval(this.timer); }

  private async scope(actor: RequestUser, db: Prisma.TransactionClient = this.prisma) {
    const scope = await this.aiCenter.loadScope(db, actor);
    if (!canCollectLabeling(scope)) throw new ForbiddenException('仅AI中台主管、AI员工和有效管培生可授权及抓取标注数据');
    return scope;
  }

  private async upstream(actor: RequestUser, method: 'GET' | 'POST', route: string, body?: unknown) {
    const scope = await this.scope(actor);
    const base = process.env.EXTERNAL_COLLAB_URL, secret = process.env.EXTERNAL_COLLAB_PROXY_SECRET;
    if (!base || !secret) throw new ServiceUnavailableException('天玑授权服务尚未配置');
    const data = method === 'POST' ? JSON.stringify(body ?? {}) : undefined;
    const signed = signExternalRequest(secret, { userId: actor.id, organizationId: actor.organizationId, displayName: scope.self.name }, method, route, createHash('sha256').update(data ?? '').digest('hex'));
    let response: Response;
    try {
      response = await fetch(`${base.replace(/\/$/, '')}${route}`, { method, headers: { 'x-fangpian-claim': signed.claim, 'x-fangpian-signature': signed.signature, ...(data ? { 'content-type': 'application/json' } : {}) }, body: data, redirect: 'error', signal: AbortSignal.timeout(55_000) });
    } catch { throw new BadGatewayException('天玑读取暂时不可用，请稍后重试；上次成功数据已保留'); }
    const value = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      const message = response.status === 401 ? '请先授权本人的天玑账号，或重新授权已失效的账号'
        : response.status === 403 ? '本人的天玑账号无权读取标注统计，请核对天玑权限'
        : response.status === 429 ? '天玑读取频率受限，请稍后重试'
        : response.status === 400 ? '天玑授权或查询参数无效，请重新发起操作'
        : '天玑授权或读取暂时不可用，请重新授权本人账号后重试';
      throw new HttpException(message, [400, 401, 403, 429, 503].includes(response.status) ? response.status : 502);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadGatewayException('天玑返回了无效数据');
    return value;
  }

  async status(actor: RequestUser) {
    const scope = await this.scope(actor);
    const value = await this.upstream(actor, 'GET', '/api/tianji/login/session');
    const identity = value.identity as { employeeId?: unknown; employeeName?: unknown } | null;
    const latest = await this.prisma.traineeLabelingSync.findFirst({ where: { organizationId: actor.organizationId, actorId: actor.id }, orderBy: { createdAt: 'desc' } });
    return { authenticated: value.authenticated === true, configured: value.configured === true,
      name: typeof identity?.employeeName === 'string' ? identity.employeeName : null,
      employeeId: typeof identity?.employeeId === 'number' ? identity.employeeId : null, latestJob: latest ? view(latest, memberNames(scope)) : null };
  }
  async loginStart(actor: RequestUser) {
    const value = await this.upstream(actor, 'POST', '/api/tianji/login/start');
    if (typeof value.consentUrl !== 'string' || typeof value.state !== 'string' || typeof value.callbackOrigin !== 'string'
      || value.messageSource !== 'fangpian-tianji-sso' || !/^[A-Za-z0-9_-]{43}$/.test(value.state)) throw new BadGatewayException('天玑授权响应无效');
    const consent = new URL(value.consentUrl);
    if (consent.protocol !== 'https:' || consent.username || consent.password) throw new BadGatewayException('天玑授权地址无效');
    return { consentUrl: consent.href, state: value.state, callbackOrigin: value.callbackOrigin, messageSource: value.messageSource };
  }
  async loginCallback(actor: RequestUser, body: { code: string; state: string }) {
    await this.upstream(actor, 'POST', '/api/tianji/login/callback', body);
    return { ok: true };
  }
  async job(actor: RequestUser, id: string) {
    const scope = await this.scope(actor);
    const row = await this.prisma.traineeLabelingSync.findFirst({ where: { id, organizationId: actor.organizationId, actorId: actor.id } });
    if (!row) throw new NotFoundException('抓取任务不存在或不属于当前账号');
    return view(row, memberNames(scope));
  }
  async start(actor: RequestUser, input: { from: string; to: string }) {
    const from = workDate(input.from), to = workDate(input.to);
    if (from > to || input.to > shanghaiToday() || (to.getTime() - from.getTime()) / 86_400_000 >= 31) throw new BadRequestException('请选择不超过31天、且不包含未来日期的抓取范围');
    const authorization = await this.status(actor);
    if (!authorization.authenticated) throw new ForbiddenException('请先授权本人的天玑账号');
    const job = await this.prisma.$transaction(async db => {
      await this.scope(actor, db);
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.organizationId},20261110))`;
      const active = await db.traineeLabelingSync.findFirst({ where: { organizationId: actor.organizationId, status: { in: ['QUEUED', 'RUNNING'] } } });
      if (active) {
        if (active.actorId === actor.id && dayKey(active.from) === input.from && dayKey(active.to) === input.to) return active;
        throw new ConflictException('本组织已有标注抓取任务，请等待完成后重试');
      }
      return db.traineeLabelingSync.create({ data: { organizationId: actor.organizationId, actorId: actor.id, from, to, message: '已排队，将使用你本人的天玑授权抓取' } });
    });
    void this.drain();
    return view(job);
  }

  private async drain() {
    if (this.running || this.closed) return;
    this.running = true;
    let claimed: Job | null = null;
    try {
      const row = await this.prisma.traineeLabelingSync.findFirst({ where: { OR: [{ status: 'QUEUED' }, { status: 'RUNNING', leaseUntil: { lt: new Date() } }] }, orderBy: { createdAt: 'asc' } });
      if (!row) return;
      const workerKey = randomUUID();
      const updated = await this.prisma.traineeLabelingSync.updateMany({ where: { id: row.id, updatedAt: row.updatedAt, status: row.status }, data: { status: 'RUNNING', workerKey, leaseUntil: new Date(Date.示例公司有限公司() + 90_000), message: '正在校验本人的天玑授权' } });
      if (updated.count !== 1) return;
      claimed = { ...row, workerKey };
      await this.execute(claimed);
    } catch (error) {
      if (claimed) {
        const response = error instanceof HttpException ? error.getResponse() : null;
        const message = typeof response === 'string' ? response : response && typeof response === 'object' && 'message' in response && typeof response.message === 'string' ? response.message : '抓取未完成，请重新尝试；上次成功数据已保留';
        await this.prisma.traineeLabelingSync.updateMany({ where: { id: claimed.id, workerKey: claimed.workerKey, status: 'RUNNING' }, data: { status: 'FAILED', message: message.slice(0, 500), leaseUntil: null, workerKey: null, finishedAt: new Date() } }).catch(() => this.logger.error('无法保存标注抓取失败状态'));
      } else this.logger.error('标注抓取队列暂时不可用');
    } finally { this.running = false; }
  }

  private async execute(job: Job) {
    const user = await this.prisma.user.findFirst({ where: { id: job.actorId, organizationId: job.organizationId, ...activeUser }, select: { id: true, email: true, roles: { select: { role: { select: { code: true } } } } } });
    if (!user) throw new ForbiddenException('发起抓取的账号已不可用');
    const actor: RequestUser = { id: user.id, organizationId: job.organizationId, email: user.email, roles: user.roles.map(row => row.role.code), permissions: [] };
    const scope = await this.scope(actor), targetIds = labelingMemberIds(scope);
    if (!targetIds.length) throw new ForbiddenException('AI中台暂无有效管培生，本次未发起源数据读取');
    const people = await this.prisma.traineeProfile.findMany({ where: { organizationId: job.organizationId, userId: { in: targetIds }, user: { organizationId: job.organizationId, ...activeUser } }, select: { userId: true, user: { select: { displayName: true } } } });
    const known = await this.prisma.traineeLabelingTianjiIdentity.findMany({ where: { organizationId: job.organizationId, traineeId: { in: people.map(person => person.userId) } } });
    const projection = await collectTianjiLabeling({ from: dayKey(job.from), to: dayKey(job.to), people: people.map(person => ({ traineeId: person.userId, displayName: person.user.displayName })), known,
      pull: async (kind, query) => {
        if (this.closed) throw new ServiceUnavailableException('服务正在重启，抓取稍后会恢复');
        const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
        const value = await this.upstream(actor, 'GET', `/api/labeling/tianji/${kind}?${params}`);
        if (value.code !== 200 || !value.data || typeof value.data !== 'object') throw new BadGatewayException('天玑标注接口返回无效数据');
        return value.data as TianjiPage;
      },
      progress: async (message, processed) => {
        const result = await this.prisma.traineeLabelingSync.updateMany({ where: { id: job.id, workerKey: job.workerKey, status: 'RUNNING' }, data: { message, processed, leaseUntil: new Date(Date.示例公司有限公司() + 90_000) } });
        if (result.count !== 1) throw new ConflictException('抓取任务已由其他服务接管，请查看最新状态');
      } });
    await this.prisma.$transaction(async db => {
      const currentScope = await this.scope(actor, db), currentMembers = new Set(labelingMemberIds(currentScope));
      const lease = await db.traineeLabelingSync.findFirst({ where: { id: job.id, workerKey: job.workerKey, status: 'RUNNING' } });
      if (!lease) throw new ConflictException('抓取任务已失效');
      const activePeople = await db.traineeProfile.count({ where: { organizationId: job.organizationId, userId: { in: projection.bindings.map(binding => binding.traineeId).filter(id => currentMembers.has(id)) }, user: { organizationId: job.organizationId, ...activeUser } } });
      if (activePeople !== projection.bindings.length) throw new ConflictException('管培生名单发生变化，请重新抓取');
      let total = 0, days = 0;
      for (const binding of projection.bindings) {
        const existing = await db.traineeLabelingTianjiIdentity.findUnique({ where: { traineeId: binding.traineeId } });
        if (existing && (existing.organizationId !== job.organizationId || existing.employeeId !== binding.employeeId)) throw new ConflictException('天玑人员ID与既有绑定不一致，请联系管理员核对');
        if (!existing) await db.traineeLabelingTianjiIdentity.create({ data: { ...binding, organizationId: job.organizationId, boundBy: actor.id } });
        for (let time = job.from.getTime(); time <= job.to.getTime(); time += 86_400_000) {
          const workDate = new Date(time), count = projection.counts.get(binding.traineeId)?.get(dayKey(workDate)) ?? 0;
          const key = { organizationId: job.organizationId, traineeId: binding.traineeId, workDate };
          await db.traineeLabelingTianjiDay.upsert({ where: { organizationId_traineeId_workDate: key }, create: { ...key, count, syncId: job.id }, update: { count, syncId: job.id } });
          total += count; days++;
        }
      }
      const result = { matchedPeople: projection.bindings.length, personDays: days, totalCount: total, skippedNames: projection.skipped, assignmentsRead: projection.assignments };
      await db.auditLog.create({ data: { organizationId: job.organizationId, actorId: actor.id, entityType: 'TraineeLabelingSync', entityId: job.id, action: 'TIANJI_LABELING_SYNCED', after: result } });
      await db.traineeLabelingSync.updateMany({ where: { id: job.id, workerKey: job.workerKey, status: 'RUNNING' }, data: { status: 'SUCCEEDED', message: `抓取完成：${projection.bindings.length}位管培生、${total}条标注；手工录入日期继续优先使用手工总数`, processed: projection.processed, result, finishedAt: new Date(), leaseUntil: null, workerKey: null } });
    }, { isolationLevel: 'Serializable', timeout: 60_000 });
  }
}
