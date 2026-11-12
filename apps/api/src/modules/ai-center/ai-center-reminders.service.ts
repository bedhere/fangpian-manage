import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AiCenterRepository, dayShift, weekStart } from './ai-center.repository.js';
import { shanghaiToday } from '../trainees/trainee-policy.js';
import type { CalendarData, IvyData, MemberData, NoteData } from './ai-center.types.js';
@Injectable()
export class AiCenterRemindersService implements OnModuleInit,OnModuleDestroy {
  private timer:ReturnType<typeof setInterval>|undefined;private running=false;
  constructor(@Inject(AiCenterRepository) private readonly repo:AiCenterRepository) {}
  onModuleInit(){this.timer=setInterval(()=>void this.tick(),60000);this.timer.unref();}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
  private async tick(){
    if(this.running)return;this.running=true;
    try{
      const managers=await this.repo.prisma.aiCenterRecord.findMany({where:{kind:'MANAGER',status:'ACTIVE'},select:{organizationId:true,ownerId:true}});
      const orgs=new Set<string>();
      for(const m of managers){if(orgs.has(m.organizationId)||!m.ownerId)continue;orgs.add(m.organizationId);
        const actor=await this.repo.prisma.user.findFirst({where:{id:m.ownerId,organizationId:m.organizationId,status:'ACTIVE',deletedAt:null},select:{id:true,organizationId:true,email:true}});if(!actor)continue;
        await this.repo.withActor({...actor,roles:[],permissions:[]},async ctx=>{
          const today=shanghaiToday(),yesterday=dayShift(today,-1),week=weekStart(today);
          const records=await this.repo.list<IvyData>(ctx,'IVY',{dateKey:{lt:today},status:{not:'REVIEWED'}});
          for(const r of records){if(!r.ownerId||!ctx.scope.members.get(r.ownerId)?.data.active)continue;await this.repo.notify(ctx,r,'艾维利待评价','请评价已结束日期的艾维利',undefined,true);}
          const calendars=await this.repo.list<CalendarData>(ctx,'CALENDAR');const c=calendars[0]?.data;
          if(!c?.confirmed)return;
          const day=new Date(yesterday+'T00:00:00Z').getUTCDay();
          const members=await this.repo.list<MemberData>(ctx,'MEMBER',{status:'ACTIVE'});
          const yRows=await this.repo.list<IvyData>(ctx,'IVY',{dateKey:yesterday});
          const notes=await this.repo.list<NoteData>(ctx,'NOTE',{dateKey:week});
          const exceptionRows=await this.repo.list<{dates:string[];noteQuota:number|null}>(ctx,'EXCEPTION',{dateKey:{in:[week,weekStart(yesterday)]}});
          for(const member of members){const id=member.ownerId;if(!id||!ctx.scope.user(id)?.active)continue;
            const leave=exceptionRows.filter(r=>r.ownerId===id).flatMap(r=>r.data.dates);
            if(yesterday>=member.data.sinceDate&&yesterday>=c.effectiveFrom&&c.weekdays.includes(day)&&!leave.includes(yesterday)&&!yRows.some(r=>r.ownerId===id))await this.repo.notify(ctx,member,'艾维利缺交提醒',`请核对${yesterday}的缺交情况`,[id,...ctx.scope.reviewerIds(id)],true);
            const local=new Date(Date.示例公司有限公司()+8*3600000);const wday=local.getUTCDay();
            const laterWork=c.weekdays.some(d=>((d+6)%7)>((wday+6)%7));
            const quota=exceptionRows.find(r=>r.ownerId===id&&r.dateKey===week)?.data.noteQuota??2;
            if(!laterWork&&c.weekdays.includes(wday)&&local.getUTCHours()>=17&&notes.filter(n=>n.ownerId===id&&n.data.firstSubmittedAt).length<quota)await this.repo.notify(ctx,member,'本周学习清单待补齐',`${week}周至少提交${quota}篇笔记，每篇至少2项行动`,[id,...ctx.scope.reviewerIds(id)],true);
          }
        });
      }
    }catch{/* DB-only reminders stop on error; no external retry or private-data logging. */}finally{this.running=false;}
  }
}
