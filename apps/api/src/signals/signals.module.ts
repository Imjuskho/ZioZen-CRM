import { Module } from '@nestjs/common';
import { SignalsController } from './signals.controller.js';
import { SignalsService } from './signals.service.js';

@Module({ controllers: [SignalsController], providers: [SignalsService], exports: [SignalsService] })
export class SignalsModule {}
