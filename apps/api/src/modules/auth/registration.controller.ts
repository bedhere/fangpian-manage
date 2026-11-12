import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from './public.decorator.js';
import { RegisterDto } from './registration.dto.js';
import { RegistrationService } from './registration.service.js';
import { dtoPipe } from '../../infrastructure/dto-pipe.js';
@Controller('auth')
export class RegistrationController {
  constructor(
    @Inject(RegistrationService)
    private readonly registration: RegistrationService,
  ) {}
  @Get('registration-options')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  options() {
    return this.registration.options();
  }
  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body(dtoPipe(RegisterDto)) input: RegisterDto) {
    return this.registration.register(input);
  }
}
