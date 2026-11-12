import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import {
  AcceptanceDto,
  DeliveryReviewDto,
  DeliveryUploadDto,
  ExecutiveConfirmationDto,
  SubmitDeliveryDto,
} from './delivery.dto.js';
import { DeliveryService } from './delivery.service.js';
import { DeliveryStorageService } from './delivery-storage.service.js';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(
    @Inject(DeliveryService) private readonly delivery: DeliveryService,
    @Inject(DeliveryStorageService)
    private readonly storage: DeliveryStorageService,
  ) {}

  @Get('delivery-review-queue') reviewQueue(
    @Req() request: { user: RequestUser },
  ) {
    return this.delivery.reviewQueue(request.user);
  }

  @Post(':id/deliveries') submit(
    @Req() request: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: SubmitDeliveryDto,
  ) {
    return this.delivery.submit(request.user, id, body);
  }

  @Get(':id/deliveries') list(
    @Req() request: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.delivery.list(request.user, id);
  }

  @Get(':id/delivery-workspace') workspace(
    @Req() request: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.delivery.workspace(request.user, id);
  }

  @Post(':id/delivery-upload-url') async uploadUrl(
    @Req() request: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: DeliveryUploadDto,
  ) {
    await this.delivery.assertCanSubmit(request.user, id);
    return this.storage.createUploadUrl(request.user.organizationId, id, body.filename);
  }

  @Post(':id/delivery-ai-review') aiReview(
    @Req() request: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: DeliveryReviewDto,
  ) {
    return this.delivery.aiReview(request.user, id, body);
  }

  @Post(':id/delivery-ai-review/run') runAiReview(
    @Req() request: { user: RequestUser }, @Param('id') id: string,
  ) { return this.delivery.aiReview(request.user, id); }

  @Post(':id/acceptances') accept(
    @Req() request: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: AcceptanceDto,
  ) {
    return this.delivery.accept(request.user, id, body);
  }

  @Post(':id/executive-confirmation') confirm(
    @Req() request: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: ExecutiveConfirmationDto,
  ) {
    return this.delivery.confirm(request.user, id, body.note);
  }
}
