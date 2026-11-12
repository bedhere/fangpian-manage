import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { CircleController } from './circle.controller.js';
import { CircleService } from './circle.service.js';
@Module({
  imports: [AuthModule],
  controllers: [CircleController],
  providers: [PrismaService, CircleService],
})
export class CircleModule {}
