import products from './products.public.json' with { type: 'json' };
import stalls from './stalls.json' with { type: 'json' };

const productById = new Map(products.map((product) => [product.productId, product]));
const stallProductById = new Map(
  stalls.flatMap((stall) =>
    stall.products.map((stallProduct) => [stallProduct.stallProductId, { stall, stallProduct }]),
  ),
);

function copy(value) {
  return structuredClone(value);
}

function createError(code, message) {
  return Object.assign(new Error(message), { code });
}

export class MockGameApi {
  constructor({ startingCash = 500, level = 12, userId = 'demo-player' } = {}) {
    this.userId = userId;
    this.level = level;
    this.cashBalance = startingCash;
    this.purchaseCounts = new Map();
    this.inventory = [];
    this.requests = new Map();
  }

  async getStalls() {
    return copy(stalls.map(({ products: stallProducts, ...stall }) => ({
      ...stall,
      locked: this.level < stall.unlockLevel,
      productCount: stallProducts.length,
    })));
  }

  async getStall(stallId) {
    const stall = stalls.find((entry) => entry.stallId === stallId);
    if (!stall) throw createError('STALL_NOT_FOUND', '没有找到这个摊位。');

    return copy({
      ...stall,
      locked: this.level < stall.unlockLevel,
      products: stall.products.map((stallProduct) => {
        const product = productById.get(stallProduct.productId);
        const purchasedCount = this.purchaseCounts.get(product.productId) ?? 0;
        const remainingPurchases = Math.max(0, product.maxPurchasesPerUser - purchasedCount);

        return {
          ...stallProduct,
          showName: product.displayName,
          observations: product.observations,
          remainingPurchases,
          soldOut: remainingPurchases === 0,
        };
      }),
    });
  }

  async getWallet() {
    return { cashBalance: this.cashBalance, voucherBalance: 0 };
  }

  async getInventory() {
    return copy(this.inventory);
  }

  async purchase({ stallProductId, priceC, requestId }) {
    if (!requestId) throw createError('REQUEST_ID_REQUIRED', '购买操作需要请求编号。');
    if (this.requests.has(requestId)) return copy(this.requests.get(requestId));

    const entry = stallProductById.get(stallProductId);
    if (!entry) throw createError('STALL_PRODUCT_NOT_FOUND', '没有找到这件摊位货品。');
    if (this.level < entry.stall.unlockLevel) {
      throw createError('STALL_LOCKED', `需要达到 Lv.${entry.stall.unlockLevel} 才能进入这个摊位。`);
    }

    const product = productById.get(entry.stallProduct.productId);
    const purchasedCount = this.purchaseCounts.get(product.productId) ?? 0;
    if (purchasedCount >= product.maxPurchasesPerUser) {
      throw createError('PRODUCT_PURCHASE_LIMIT_REACHED', '这件货品已达到你的购买上限。');
    }
    if (!Number.isInteger(priceC) || priceC < 0 || priceC > entry.stallProduct.sellerAskC) {
      throw createError('INVALID_PURCHASE_PRICE', '成交价格无效。');
    }
    const minimumPrice = Math.ceil((entry.stallProduct.sellerAskC * entry.stall.minimumDealRatio) / 5) * 5;
    if (priceC < minimumPrice) {
      throw createError('BID_BELOW_MINIMUM', `本次报价需至少 ${minimumPrice} C。`);
    }
    if (this.cashBalance < priceC) {
      throw createError('INSUFFICIENT_CASH', '现金不足，无法购买。');
    }

    const ownership = {
      userProductId: `mock-owned-${this.inventory.length + 1}`,
      productId: product.productId,
      showName: product.displayName,
      stallId: entry.stall.stallId,
      stallProductId,
      purchasePriceC: priceC,
      appraisalStatus: 'UNAPPRAISED',
      ownershipStatus: 'OWNED',
    };
    this.cashBalance -= priceC;
    this.purchaseCounts.set(product.productId, purchasedCount + 1);
    this.inventory.unshift(ownership);

    const receipt = {
      purchaseId: `mock-purchase-${this.requests.size + 1}`,
      ownership: copy(ownership),
      cashBalance: this.cashBalance,
      remainingPurchases: product.maxPurchasesPerUser - purchasedCount - 1,
    };
    this.requests.set(requestId, receipt);
    return copy(receipt);
  }
}

export const mockCatalogSummary = Object.freeze({
  productCount: products.length,
  stallCount: stalls.length,
  fixedSlotCount: stalls.reduce((sum, stall) => sum + stall.products.length, 0),
});
