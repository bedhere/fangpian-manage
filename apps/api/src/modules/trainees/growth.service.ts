import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@value-flow/db';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { activeUser, isEligibleMentor, mentorRoleSelect, safeUserSelect, serializable, workDate } from './trainee-policy.js';
import { GrowthAnalysisService, growthTextFields } from './growth-analysis.service.js';
import { growthRatings, type CreateGrowthDto, type GrowthFieldsDto, type UpdateGrowthDto } from './growth.dto.js';
import { AiCenterRepository } from '../ai-center/ai-center.repository.js';
import { AiCenterReportsService } from '../ai-center/ai-center-reports.service.js';
import type { AiScope } from '../ai-center/ai-center.types.js';
import { growthPublicText } from '../ai-center/growth-public-text.js';
import { LEGACY_SCORE_RULE, weeklyScoreRule } from '../ai-center/ai-center-delivery-rules.js';

const profileInclude = { user: { select: safeUserSelect }, mentor: { select: { ...safeUserSelect, managerId: true, manager: { select: safeUserSelect }, roles: { select: { role: { select: mentorRoleSelect } } } } } } as const;
const sourceSelect = { id: true, filename: true, status: true, error: true, createdAt: true } as const;
const planInclude = { trainee: { include: profileInclude }, sources: { select: sourceSelect, orderBy: { createdAt: 'desc' as const } }, revisions: { select: { version: true, editorId: true, createdAt: true }, orderBy: { version: 'desc' as const } } } as const;
type Profile = Prisma.TraineeProfileGetPayload<{ include: typeof profileInclude }>;
type Plan = Prisma.TraineeGrowthPlanGetPayload<{ include: typeof planInclude }>;
type DB = Prisma.TransactionClient;
export type GrowthUpload = { originalname: string; mimetype: string; 示例品牌: Buffer; size: number };
type Scope = { actor: RequestUser; boss: boolean; aiScope?: AiScope };

@Injectable()
export class GrowthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(GrowthAnalysisService) private readonly analysis: GrowthAnalysisService, @Optional() @Inject(AiCenterRepository) private readonly aiCenter?: AiCenterRepository, @Optional() @Inject(AiCenterReportsService) private readonly aiReports?: AiCenterReportsService) {}
  private async scope(db: DB, actor: RequestUser): Promise<Scope> {
    const user = await db.user.findFirst({ where: { id: actor.id, organizationId: actor.organizationId, ...activeUser }, select: { roles: { where: { role: { organizationId: actor.organizationId, status: 'ACTIVE' } }, select: { role: { select: { code: true } } } } } });
    if (!user) throw new ForbiddenException('成员无效');
    return { actor, boss: user.roles.some(x => ['OWNER', 'SUPER_ADMIN'].includes(x.role.code)), aiScope: this.aiCenter ? await this.aiCenter.loadScope(db,actor) : undefined };
  }
  private mentor(profile: Profile, scope: Scope) {
    return profile.mentor && isEligibleMentor(profile.mentor, scope.actor.organizationId) ? profile.mentor : null;
  }
  private canEdit(profile: Profile, scope: Scope) {
    if (profile.userId === scope.actor.id) return false;
    if (scope.aiScope?.members.has(profile.userId)) return scope.aiScope.canReview(profile.userId);
    const mentor = this.mentor(profile, scope);
    return !!mentor && (mentor.id === scope.actor.id || (mentor.managerId === scope.actor.id && mentor.manager?.organizationId === scope.actor.organizationId && mentor.manager.status === 'ACTIVE' && !mentor.manager.deletedAt));
  }
  private visible(profile: Profile, scope: Scope) {
    return profile.organizationId === scope.actor.organizationId && profile.user.organizationId === scope.actor.organizationId && profile.user.status === 'ACTIVE' && !profile.user.deletedAt && (scope.boss || profile.userId === scope.actor.id || this.canEdit(profile, scope));
  }
  private async profile(db: DB, traineeId: string, scope: Scope, edit: boolean) {
    const p = await db.traineeProfile.findFirst({ where: { userId: traineeId, organizationId: scope.actor.organizationId }, include: profileInclude });
    if (!p || !this.visible(p, scope)) throw new NotFoundException('管培生不存在或无权查看');
    if (edit && !this.canEdit(p, scope)) throw new ForbiddenException('仅当前带教导师及其直属上级可填写成长计划');
    return p;
  }
  private async load(db: DB, id: string, scope: Scope, edit = false) {
    const row = await db.traineeGrowthPlan.findFirst({ where: { id, organizationId: scope.actor.organizationId }, include: planInclude });
    if (!row || !this.visible(row.trainee, scope) || (row.traineeId === scope.actor.id && row.status !== 'PUBLISHED')) throw new NotFoundException('周档案不存在或无权查看');
    if (edit && !this.canEdit(row.trainee, scope)) throw new ForbiddenException('仅当前带教导师及其直属上级可填写成长计划');
    return row;
  }
  private async view(db: DB, row: Plan, scope: Scope) {
    const previousStart = new Date(row.periodStart.getTime() - 7 * 86400000);
    const previous = await db.traineeGrowthPlan.findFirst({ where: { organizationId: scope.actor.organizationId, traineeId: row.traineeId, periodStart: previousStart, ...(row.traineeId === scope.actor.id ? { status: 'PUBLISHED' } : {}) }, select: { rating: true, periodStart: true } });
    const quant=await db.traineeGrowthSource.findFirst({where:{planId:row.id,result:{path:['source'],equals:'AI_CENTER_REPORT'}},select:{result:true},orderBy:{createdAt:'desc'}});
    const q=quant?.result as {suggestedRating?:string|null;report?:{total?:number|null;pending?:string[];rulesVersion?:string}}|undefined;
    let quantitativeStale=false;
    if(q&&row.traineeId!==scope.actor.id&&scope.aiScope?.members.has(row.traineeId)) {
      const revisions=await db.traineeGrowthRevision.findMany({where:{planId:row.id},orderBy:{version:'asc'},select:{snapshot:true}});
      const rule=weeklyScoreRule(row.periodStart.toISOString().slice(0,10),revisions.map(r=>r.snapshot),row.status==='PUBLISHED');
      quantitativeStale=(q.report?.rulesVersion??LEGACY_SCORE_RULE)!==rule;
    }
    const value = {
      id: row.id, traineeId: row.traineeId, traineeName: row.trainee.user.displayName,
      periodStart: row.periodStart.toISOString().slice(0, 10), periodEnd: row.periodEnd.toISOString().slice(0, 10),
      rating: row.rating, ...Object.fromEntries(growthTextFields.map(key => [key, row.traineeId===scope.actor.id?growthPublicText(row[key],Array.isArray(q?.report?.pending)?q.report.pending:[]):row[key]])),
      status: row.status, publishedAt: row.publishedAt?.toISOString() ?? null, canEdit: this.canEdit(row.trainee, scope),
      previousRating: previous?.rating ?? null, previousPeriodStart: previous?.periodStart.toISOString().slice(0, 10) ?? null,
    };
    // Explicit projection: trainees never receive source transcripts, draft revisions or editor identities.
    if (row.traineeId === scope.actor.id) return value;
    const editors = await db.user.findMany({ where: { organizationId: scope.actor.organizationId, id: { in: [...new Set(row.revisions.map(x => x.editorId))] } }, select: { id: true, displayName: true } });
    return { ...value, quantitativeStale,quantitativeSuggestion:quantitativeStale?null:q?.suggestedRating??null,quantitativeTotal:quantitativeStale?null:q?.report?.total??null, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
      ...(this.canEdit(row.trainee, scope) || scope.boss ? { sources: row.sources, history: row.revisions.map(x => ({ version: x.version, editorName: editors.find(e => e.id === x.editorId)?.displayName ?? '历史成员', createdAt: x.createdAt.toISOString() })) } : {}),
    };
  }
  async workspace(actor: RequestUser) {
    return serializable(this.prisma, async db => {
      const scope = await this.scope(db, actor);
      const profiles = (await db.traineeProfile.findMany({ where: { organizationId: actor.organizationId, user: { organizationId: actor.organizationId, ...activeUser } }, include: profileInclude, orderBy: { userId: 'asc' } })).filter(p => this.visible(p, scope));
      const rows = await db.traineeGrowthPlan.findMany({ where: { organizationId: actor.organizationId, traineeId: { in: profiles.map(p => p.userId) }, OR: [{ traineeId: { not: actor.id } }, { status: 'PUBLISHED' }] }, include: planInclude, orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }] });
      const plans = [];
      for (const row of rows) plans.push(await this.view(db, row, scope));
      return { selfOnly: !scope.boss && profiles.every(p => p.userId === actor.id), people: profiles.map(p => { const mentor = this.mentor(p, scope); return { userId: p.userId, displayName: p.user.displayName, mentorName: mentor?.displayName ?? null, mentorManagerName: mentor?.manager?.organizationId === actor.organizationId && mentor.manager.status === 'ACTIVE' && !mentor.manager.deletedAt ? mentor.manager.displayName : null, canEdit: this.canEdit(p, scope), isSelf: p.userId === actor.id }; }), plans };
    });
  }
  private fields(input: GrowthFieldsDto) {
    if (input.rating != null && !growthRatings.includes(input.rating)) throw new BadRequestException('评级无效');
    const fields: Record<string, string> = {};
    for (const key of growthTextFields) {
      if (typeof input[key] !== 'string' || input[key].length > (key === 'departmentText' ? 200 : 12000)) throw new BadRequestException('清单文字格式或长度无效');
      fields[key] = input[key].trim();
    }
    if (input.publish && (!input.rating || growthTextFields.some(key => !fields[key]))) throw new BadRequestException('发布前请完成评级、对接部门及各项综合评价；暂无内容可明确填写“暂无”');
    return { ...fields, rating: input.rating ?? null, status: input.publish ? 'PUBLISHED' : 'DRAFT', publishedAt: input.publish ? new Date() : null };
  }
  private async checkQuantitative(db:DB,scope:Scope,traineeId:string,periodStart:string,input:GrowthFieldsDto,fields:Record<string,unknown>) {
    if(!input.publish)return;
    let rulesVersion:string|undefined;
    if(this.aiReports&&scope.aiScope?.members.has(traineeId)) {
      const report=await this.aiReports.build({tx:db,actor:scope.actor,scope:scope.aiScope},traineeId,periodStart);
      rulesVersion=report.rulesVersion;
      if(report.suggestedRating&&input.rating!==report.suggestedRating&&!input.overrideReason?.trim())throw new BadRequestException(`当前量化建议为${report.suggestedRating}，采用其他评级请填写评级调整说明`);
    }
    if(input.overrideReason?.trim())fields.archiveComment=String(fields.archiveComment)+'\n评级调整说明：'+input.overrideReason.trim();
    return rulesVersion;
  }
  private async revision(db: DB, row: Plan, editorId: string, scoringRulesVersion?:string) {
    await db.traineeGrowthRevision.create({ data: { planId: row.id, version: row.version, editorId, snapshot: { rating: row.rating, ...Object.fromEntries(growthTextFields.map(key => [key, row[key]])), status: row.status, ...(scoringRulesVersion&&row.status==='PUBLISHED'?{scoringRulesVersion}:{}), periodStart: row.periodStart.toISOString().slice(0, 10), periodEnd: row.periodEnd.toISOString().slice(0, 10) } } });
  }
  private busy(row: Plan) {
    return row.analysisRequestKey && row.analysisStartedAt && row.analysisStartedAt.getTime() > Date.示例公司有限公司() - 5 * 60000;
  }
  async create(actor: RequestUser, input: CreateGrowthDto) {
    const start = workDate(input.periodStart), end = workDate(input.periodEnd);
    if (start.getUTCDay() !== 1 || end < start || end.getTime() - start.getTime() > 6 * 86400000) throw new BadRequestException('每周档案从周一开始，结束日期须在本周内');
    const data = this.fields(input);
    return serializable(this.prisma, async db => {
      const scope = await this.scope(db, actor);
      await this.profile(db, input.traineeId, scope, true);
      const scoringRulesVersion=await this.checkQuantitative(db,scope,input.traineeId,input.periodStart,input,data);
      await db.$queryRaw`SELECT user_id FROM trainee_profiles WHERE user_id=${input.traineeId}::uuid FOR UPDATE`;
      if (await db.traineeGrowthPlan.findFirst({ where: { traineeId: input.traineeId, periodStart: { lte: end }, periodEnd: { gte: start } }, select: { id: true } })) throw new ConflictException('该周已有档案，请打开原档案编辑');
      const row = await db.traineeGrowthPlan.create({ data: { ...data, organizationId: actor.organizationId, traineeId: input.traineeId, periodStart: start, periodEnd: end, createdBy: actor.id, updatedBy: actor.id }, include: planInclude });
      await this.revision(db, row, actor.id,scoringRulesVersion);
      return this.view(db, await this.load(db, row.id, scope), scope);
    });
  }
  async update(actor: RequestUser, id: string, input: UpdateGrowthDto) {
    const fields = this.fields(input);
    return serializable(this.prisma, async db => {
      const scope = await this.scope(db, actor), row = await this.load(db, id, scope, true);
      const scoringRulesVersion=await this.checkQuantitative(db,scope,row.traineeId,row.periodStart.toISOString().slice(0,10),input,fields);
      if (this.busy(row)) throw new ConflictException('文件正在分析，请稍后刷新；不会覆盖你的修改');
      const changed = await db.traineeGrowthPlan.updateMany({ where: { id, organizationId: actor.organizationId, version: input.version }, data: { ...fields, updatedBy: actor.id, version: { increment: 1 }, analysisRequestKey: null, analysisStartedAt: null } });
      if (changed.count !== 1) throw new ConflictException('档案已被其他人修改，请刷新后核对');
      const next = await this.load(db, id, scope, true); await this.revision(db, next, actor.id,scoringRulesVersion);
      return this.view(db, next, scope);
    });
  }
  async detail(actor: RequestUser, id: string) {
    return serializable(this.prisma, async db => { const scope = await this.scope(db, actor); return this.view(db, await this.load(db, id, scope), scope); });
  }
  async assertEditor(actor: RequestUser, id: string) {
    return serializable(this.prisma, async db => { const scope = await this.scope(db, actor); await this.load(db, id, scope, true); });
  }
  async source(actor: RequestUser, id: string, sourceId: string) {
    return serializable(this.prisma, async db => {
      const scope = await this.scope(db, actor), row = await this.load(db, id, scope);
      if (row.traineeId===actor.id||(!this.canEdit(row.trainee, scope) && !scope.boss)) throw new ForbiddenException('无权下载内部会议材料');
      const source = await db.traineeGrowthSource.findFirst({ where: { id: sourceId, planId: id } });
      if (!source) throw new NotFoundException('文件不存在');
      return { filename: source.filename, content: source.content };
    });
  }
  async upload(actor: RequestUser, id: string, version: number, requestKey: string, files: GrowthUpload[]) {
    if (!files?.length || files.length > 5 || files.some(f => !f.示例品牌 || f.size < 1 || f.size > 8 * 1024 * 1024 || !/\.(txt|md|docx|pdf)$/i.test(f.originalname)) || files.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024) throw new BadRequestException('每次1至5份TXT、MD、DOCX、文本PDF；单份8MB、合计20MB以内');
    const batch = [...new Map(files.map(f => [createHash('sha256').update(f.示例品牌).digest('hex'), f])).entries()];
    const start = await serializable(this.prisma, async db => {
      const scope = await this.scope(db, actor), row = await this.load(db, id, scope, true);
      const old = await db.traineeGrowthSource.findMany({ where: { planId: id, requestKey }, select: { status: true, contentHash: true } });
      if (old.length) {
        if (old.length !== batch.length || batch.some(([hash]) => !old.some(x => x.contentHash === hash))) throw new ConflictException('重复请求标识对应不同文件，请重新提交');
        if (old.every(x => x.status === 'ANALYZED')) return { done: await this.view(db, row, scope) };
        throw new ConflictException('这批文件已经提交，正在处理或已失败；请刷新查看来源状态，系统不会自动重复调用AI');
      }
      if (row.status !== 'DRAFT' || row.version !== version || this.busy(row)) throw new ConflictException('请先保存当前草稿，并确认没有其他分析正在进行');
      const changed = await db.traineeGrowthPlan.updateMany({ where: { id, version, status: 'DRAFT' }, data: { analysisRequestKey: requestKey, analysisStartedAt: new Date() } });
      if (changed.count !== 1) throw new ConflictException('档案已变更，请刷新');
      await db.traineeGrowthSource.createMany({ data: batch.map(([contentHash, file]) => ({ planId: id, uploaderId: actor.id, filename: file.originalname.replace(/[\x00-\x1f/\\]/g, '_').slice(0, 200), mimeType: file.mimetype, contentHash, content: new Uint8Array(file.示例品牌), requestKey })) });
      return { row };
    });
    if ('done' in start) return start.done;
    try {
      const extracted: { filename: string; text: string }[] = [];
      for (const [hash, file] of batch) {
        const text = await this.analysis.extract(file.originalname, file.示例品牌);
        await this.prisma.traineeGrowthSource.updateMany({ where: { planId: id, requestKey, contentHash: hash }, data: { textContent: text } });
        extracted.push({ filename: file.originalname, text });
      }
      const row = start.row!;
      if(this.aiReports&&this.aiCenter) {
        const member=await this.prisma.aiCenterRecord.findFirst({where:{organizationId:actor.organizationId,kind:'MEMBER',ownerId:row.traineeId},select:{data:true}});
        const since=(member?.data as {sinceDate?:string}|undefined)?.sinceDate;
        const startDay=row.periodStart.toISOString().slice(0,10);
        if(since&&row.periodEnd.toISOString().slice(0,10)>=since) {
          const report=await this.aiReports.report(actor,row.traineeId,startDay);
          extracted.push({filename:'系统AI中台周记录（事实与人工评分，不得改写或补分）',text:JSON.stringify(report)});
        }
      }
      const result = await this.analysis.analyze(row.trainee.user.displayName, row.periodStart.toISOString().slice(0, 10), row.periodEnd.toISOString().slice(0, 10), extracted);
      return await serializable(this.prisma, async db => {
        const scope = await this.scope(db, actor); await this.load(db, id, scope, true);
        // Never replace known content with an unknown field from the meeting transcript.
        const known = Object.fromEntries(growthTextFields.filter(key => result[key].trim()).map(key => [key, result[key].trim()]));
        const changed = await db.traineeGrowthPlan.updateMany({ where: { id, organizationId: actor.organizationId, version, status: 'DRAFT', analysisRequestKey: requestKey }, data: { ...known, ...(result.rating ? { rating: result.rating } : {}), updatedBy: actor.id, version: { increment: 1 }, analysisRequestKey: null, analysisStartedAt: null } });
        if (changed.count !== 1) throw new ConflictException('分析期间档案已变更，原清单未被覆盖；请刷新后核对来源文件');
        await db.traineeGrowthSource.updateMany({ where: { planId: id, requestKey }, data: { status: 'ANALYZED', result: result as Prisma.InputJsonValue, error: null } });
        const next = await this.load(db, id, scope, true); await this.revision(db, next, actor.id);
        return this.view(db, next, scope);
      });
    } catch (error) {
      // Persist failure without printing private transcripts/provider responses to logs.
      const message = error instanceof BadRequestException || error instanceof ConflictException ? error.message : '文件分析未完成，原清单与源文件已保留，可手动填写或重新提交';
      await this.prisma.$transaction([
        this.prisma.traineeGrowthSource.updateMany({ where: { planId: id, requestKey }, data: { status: 'FAILED', error: message.slice(0, 300) } }),
        this.prisma.traineeGrowthPlan.updateMany({ where: { id, analysisRequestKey: requestKey }, data: { analysisRequestKey: null, analysisStartedAt: null } }),
      ]);
      throw error;
    }
  }
}
