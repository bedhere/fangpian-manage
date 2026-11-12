import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PermissionsGuard } from './permissions.guard.js';
import { RegistrationController } from './registration.controller.js';
import { RegistrationService } from './registration.service.js';

@Module({
  controllers: [AuthController, RegistrationController],
  providers: [PrismaService, AuthService, JwtAuthGuard, PermissionsGuard, RegistrationService],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
