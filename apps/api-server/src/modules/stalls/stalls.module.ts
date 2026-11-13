import { Module } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { PurchasesController } from './purchases.controller.js';
import { PurchasesService } from './purchases.service.js';

@Module({ controllers: [PurchasesController], providers: [PurchasesService, SessionAuthGuard] })
export class StallsModule {}
