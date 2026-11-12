import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { OpportunityController } from './opportunity.controller.js';
import { OpportunityService } from './opportunity.service.js';
@Module({
  imports: [AuthModule],
  controllers: [OpportunityController],
  providers: [PrismaService, OpportunityService],
})
export class OpportunityModule {}
