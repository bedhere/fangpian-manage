import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { PersonalProjectController } from './personal-project.controller.js';
import { PersonalProjectService } from './personal-project.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PersonalProjectController],
  providers: [PrismaService, PersonalProjectService],
})
export class PersonalProjectModule {}
