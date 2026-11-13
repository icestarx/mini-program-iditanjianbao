import { Body, Controller, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { PurchaseDto } from './purchase.dto.js';
import { PurchasesService } from './purchases.service.js';

type AuthenticatedRequest = Request & { user: { userId: string } };

@Controller('stall-products')
@UseGuards(SessionAuthGuard)
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Post(':stallProductId/purchase')
  purchase(
    @Param('stallProductId', new ParseUUIDPipe()) stallProductId: string,
    @Body() body: PurchaseDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.purchases.purchase(request.user.userId, stallProductId, body);
  }
}
