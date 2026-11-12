import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { parseEnvironment } from '@value-flow/config';
import { PrismaService } from './infrastructure/prisma.service.js';
import { AIEvaluationQueueService } from './infrastructure/ai-evaluation-queue.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersController } from './modules/users/users.controller.js';
import { HealthController } from './modules/health/health.controller.js';
import { ProjectsController } from './modules/projects/projects.controller.js';
import { ProjectsService } from './modules/projects/projects.service.js';
import { MarketController } from './modules/market/market.controller.js';
import { CapacityController } from './modules/market/capacity.controller.js';
import { TeamController } from './modules/market/team.controller.js';
import { MatchingService } from './modules/market/matching.service.js';
import { CapacityService } from './modules/market/capacity.service.js';
import { ProjectApplicationService } from './modules/market/project-application.service.js';
import { ProjectTeamService } from './modules/market/project-team.service.js';
import { ExecutionController } from './modules/execution/execution.controller.js';
import { ExecutionService } from './modules/execution/execution.service.js';
import { DeliveryController } from './modules/delivery/delivery.controller.js';
import { DeliveryService } from './modules/delivery/delivery.service.js';
import { DeliveryStorageService } from './modules/delivery/delivery-storage.service.js';
import { DeliveryReviewContextService } from './modules/delivery/delivery-review-context.service.js';
import { SettlementController } from './modules/settlement/settlement.controller.js';
import { SettlementService } from './modules/settlement/settlement.service.js';
import { AnalyticsController } from './modules/analytics/analytics.controller.js';
import { AnalyticsService } from './modules/analytics/analytics.service.js';
import { GovernanceController } from './modules/governance/governance.controller.js';
import { GovernanceService } from './modules/governance/governance.service.js';
import { WorkspaceModule } from './modules/workspace/workspace.module.js';
import { IntakeModule } from './modules/intake/intake.module.js';
import { KnowledgeModule } from './modules/knowledge/knowledge.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { FeedbackModule } from './modules/feedback/feedback.module.js';
import { InsightsController } from './modules/insights/insights.controller.js';
import { InsightsService } from './modules/insights/insights.service.js';
import { OpportunityModule } from './modules/opportunities/opportunity.module.js';
import { CircleModule } from './modules/circles/circle.module.js';
import { BuffModule } from './modules/buffs/buff.module.js';
import { PersonalProjectModule } from './modules/personal-projects/personal-project.module.js';
import { TeamWorkModule } from './modules/team-work/team-work.module.js';
import { TraineeModule } from './modules/trainees/trainee.module.js';
import { AiCenterModule } from './modules/ai-center/ai-center.module.js';
import { ExternalCollabController } from './modules/external-collab/external-collab.controller.js';
import { LeaderboardModule } from './modules/leaderboards/leaderboard.module.js';

@Module({
  imports: [
    AiCenterModule,
    LeaderboardModule,
    ConfigModule.forRoot({ isGlobal: true, validate: parseEnvironment }),
    JwtModule.register({ global: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    WorkspaceModule,
    AuthModule,
    IntakeModule,
    KnowledgeModule,
    ReviewsModule,
    FeedbackModule,
    OpportunityModule,
    CircleModule,
    BuffModule,
    PersonalProjectModule,
    TeamWorkModule,
    TraineeModule,
  ],
  controllers: [
    ExternalCollabController,
    UsersController,
    HealthController,
    ProjectsController,
    MarketController,
    CapacityController,
    TeamController,
    ExecutionController,
    DeliveryController,
    SettlementController,
    AnalyticsController,
    GovernanceController,
    InsightsController,
  ],
  providers: [
    PrismaService,
    AIEvaluationQueueService,
    ProjectsService,
    MatchingService,
    CapacityService,
    ProjectApplicationService,
    ProjectTeamService,
    ExecutionService,
    DeliveryService,
    DeliveryStorageService,
    DeliveryReviewContextService,
    SettlementService,
    AnalyticsService,
    GovernanceService,
    InsightsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
