import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, type ProductPurchase } from '@prisma/client';
import { PrismaService } from '../database/prisma.module.js';
import { PurchaseDto } from './purchase.dto.js';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async purchase(userId: string, stallProductId: string, input: PurchaseDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const previous = await tx.productPurchase.findUnique({ where: { requestId: input.request_id } });
        if (previous) return this.replay(previous, userId, stallProductId, input.price_c);

        const listing = await tx.stallProduct.findUnique({
          where: { stallProductId },
          include: { stall: { include: { npc: true } }, product: true },
        });
        if (!listing || !listing.stall.isActive || !listing.stall.npc.isActive || !listing.product.isActive) {
          throw new NotFoundException({ code: 'STALL_PRODUCT_NOT_FOUND' });
        }

        const player = await tx.user.findUnique({ where: { userId }, include: { wallet: true } });
        if (!player || !player.wallet) throw new NotFoundException({ code: 'UNAUTHORIZED' });
        if (player.level < listing.stall.unlockLevel || player.level < listing.product.unlockLevel) {
          throw new ConflictException({ code: 'STALL_LOCKED' });
        }

        const existingCount = await tx.userProductPurchaseCount.findUnique({ where: { userId_productId: { userId, productId: listing.productId } } });
        if ((existingCount?.purchasedCount ?? 0) >= listing.product.maxPurchasesPerUser) {
          throw new ConflictException({ code: 'PRODUCT_PURCHASE_LIMIT_REACHED' });
        }
        // Until a server-side bargain record exists, only the configured ask is valid.
        if (input.price_c !== listing.sellerAskC) {
          throw new UnprocessableEntityException({ code: 'PRICE_NOT_CONFIRMED' });
        }
        if (player.wallet.cashBalance < input.price_c) throw new ConflictException({ code: 'INSUFFICIENT_CASH' });

        const heldProducts = await tx.userProduct.count({ where: { userId, ownershipStatus: 'OWNED' } });
        const inventoryCapacity = Number(process.env.INVENTORY_CAPACITY ?? 100);
        if (heldProducts >= inventoryCapacity) throw new ConflictException({ code: 'INVENTORY_FULL' });

        // Serialize first-time and concurrent purchases of the same product for this user.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${listing.productId}))`;
        const lockedCount = await tx.userProductPurchaseCount.findUnique({ where: { userId_productId: { userId, productId: listing.productId } } });
        if ((lockedCount?.purchasedCount ?? 0) >= listing.product.maxPurchasesPerUser) {
          throw new ConflictException({ code: 'PRODUCT_PURCHASE_LIMIT_REACHED' });
        }

        const updatedWallet = await tx.userWallet.updateMany({
          where: { userId, cashBalance: { gte: input.price_c } },
          data: { cashBalance: { decrement: input.price_c } },
        });
        if (updatedWallet.count !== 1) throw new ConflictException({ code: 'INSUFFICIENT_CASH' });

        const purchaseId = crypto.randomUUID();
        const userProductId = crypto.randomUUID();
        const walletAfter = player.wallet.cashBalance - input.price_c;
        await tx.userProductPurchaseCount.upsert({
          where: { userId_productId: { userId, productId: listing.productId } },
          create: { userId, productId: listing.productId, purchasedCount: 1 },
          update: { purchasedCount: { increment: 1 } },
        });
        await tx.walletLedger.create({ data: {
          userId, currency: 'C', balanceBefore: player.wallet.cashBalance, amountDelta: -input.price_c,
          balanceAfter: walletAfter, reason: 'PRODUCT_PURCHASE', businessId: purchaseId, requestId: input.request_id,
        } });
        await tx.userProduct.create({ data: {
          userProductId, userId, stallProductId, productId: listing.productId,
          productConfigVersion: listing.product.configVersion, purchasePriceC: input.price_c,
        } });
        await tx.productPurchase.create({ data: {
          purchaseId, requestId: input.request_id, userId, stallProductId, productId: listing.productId,
          userProductId, priceC: input.price_c,
        } });

        return {
          purchase_id: purchaseId,
          user_product_id: userProductId,
          price_c: input.price_c,
          cash_balance: walletAfter,
          remaining_total_for_user: listing.product.maxPurchasesPerUser - (lockedCount?.purchasedCount ?? 0) - 1,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const previous = await this.prisma.productPurchase.findUnique({ where: { requestId: input.request_id } });
        if (previous) return this.replay(previous, userId, stallProductId, input.price_c);
      }
      throw error;
    }
  }

  private replay(previous: ProductPurchase, userId: string, stallProductId: string, price: number) {
    if (previous.userId !== userId || previous.stallProductId !== stallProductId || previous.priceC !== price) {
      throw new ConflictException({ code: 'REQUEST_REPLAY' });
    }
    return this.prisma.walletLedger.findUniqueOrThrow({ where: { requestId: previous.requestId } }).then((ledger) => ({
      purchase_id: previous.purchaseId,
      user_product_id: previous.userProductId,
      price_c: previous.priceC,
      cash_balance: ledger.balanceAfter,
      replayed: true,
    }));
  }
}
