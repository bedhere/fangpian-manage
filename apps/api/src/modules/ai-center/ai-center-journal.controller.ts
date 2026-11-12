import { Body, Controller, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { dtoPipe } from '../../infrastructure/dto-pipe.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { AiCenterJournalService } from './ai-center-journal.service.js';
import { JournalReviewDto, JournalVersionDto, NoteReviewDto, PromoteIvyDto, SaveIvyDto, SaveNoteDto, UpdateNoteDto } from './ai-center-journal.dto.js';
import { IvyWecomService } from './ivy-wecom.service.js';
@Controller('ai-center')
@UseGuards(JwtAuthGuard)
export class AiCenterJournalController {
 constructor(@Inject(AiCenterJournalService) private readonly service:AiCenterJournalService,@Inject(IvyWecomService) private readonly wecom:IvyWecomService) {}
 @Post('ivy/:id/message') message(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string,@Body(dtoPipe(JournalVersionDto)) b:JournalVersionDto){return this.wecom.sendSaved(r.user,id,b.version);}
 @Post('ivy') ivy(@Req() r:{user:RequestUser}, @Body(dtoPipe(SaveIvyDto)) b:SaveIvyDto) { return this.service.saveIvy(r.user,b); }
 @Post('ivy/:id/review') ivyReview(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(JournalReviewDto)) b:JournalReviewDto) { return this.service.reviewIvy(r.user,id,b); }
 @Post('ivy/:id/tasks') promote(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(PromoteIvyDto)) b:PromoteIvyDto) { return this.service.promoteIvy(r.user,id,b); }
 @Post('notes') note(@Req() r:{user:RequestUser}, @Body(dtoPipe(SaveNoteDto)) b:SaveNoteDto) { return this.service.createNote(r.user,b); }
 @Patch('notes/:id') update(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(UpdateNoteDto)) b:UpdateNoteDto) { return this.service.updateNote(r.user,id,b); }
 @Post('notes/:id/revise') revise(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(JournalVersionDto)) b:JournalVersionDto) { return this.service.reviseNote(r.user,id,b); }
 @Post('notes/:id/review') review(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(NoteReviewDto)) b:NoteReviewDto) { return this.service.reviewNote(r.user,id,b); }
}
