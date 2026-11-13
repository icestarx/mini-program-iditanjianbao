import { JsonAsset, resources } from 'cc';

export interface PublicObservation {
  observationId: string;
  position: string;
  text: string;
}

export interface PublicProduct {
  productId: string;
  displayName: string;
  observations: PublicObservation[];
  maxPurchasesPerUser: number;
}

export interface StallProduct {
  stallProductId: string;
  slot: number;
  productId: string;
  sellerAskC: number;
  showName?: string;
  observations?: PublicObservation[];
  remainingPurchases?: number;
  soldOut?: boolean;
}

export interface Stall {
  stallId: string;
  npcId: string;
  npcType: string;
  npcName: string;
  stallName: string;
  unlockLevel: number;
  quoteFactor: number;
  minimumDealRatio: number;
  baseDiscount: number;
  scene: string;
  products: StallProduct[];
  locked?: boolean;
}

export interface OwnedProduct {
  userProductId: string;
  productId: string;
  showName: string;
  stallId: string;
  stallProductId: string;
  purchasePriceC: number;
  appraisalStatus: string;
  ownershipStatus: string;
}

export class CocosMockApi {
  private products: PublicProduct[] = [];
  private stalls: Stall[] = [];
  private cashBalance = 500;
  private voucherBalance = 0;
  private level = 1;
  private inventory: OwnedProduct[] = [];
  private readonly purchaseCounts = new Map<string, number>();
  private readonly receipts = new Map<string, Record<string, unknown>>();

  async initialize(): Promise<void> {
    const [products, stalls] = await Promise.all([
      this.loadJson<PublicProduct[]>('mock/products.public'),
      this.loadJson<Stall[]>('mock/stalls'),
    ]);
    this.products = products;
    this.stalls = stalls;
  }

  getStalls(): Stall[] {
    return this.stalls.map(({ products: stallProducts, ...stall }) => ({
      ...stall,
      products: [],
      locked: this.level < stall.unlockLevel,
    }));
  }

  getStall(stallId: string): Stall {
    const stall = this.stalls.find((entry) => entry.stallId === stallId);
    if (!stall) throw this.error('STALL_NOT_FOUND', '没有找到这个摊位。');

    return {
      ...stall,
      locked: this.level < stall.unlockLevel,
      products: stall.products.map((stallProduct) => {
        const product = this.products.find((entry) => entry.productId === stallProduct.productId);
        if (!product) throw this.error('PRODUCT_NOT_FOUND', '货品配置暂不可用。');
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
    };
  }

  getWallet(): { cashBalance: number; voucherBalance: number } {
    return { cashBalance: this.cashBalance, voucherBalance: this.voucherBalance };
  }

  getInventory(): OwnedProduct[] {
    return this.inventory.map((entry) => ({ ...entry }));
  }

  purchase(input: { stallProductId: string; priceC: number; requestId: string }): Record<string, unknown> {
    if (!input.requestId) throw this.error('REQUEST_ID_REQUIRED', '购买操作需要请求编号。');
    const previousReceipt = this.receipts.get(input.requestId);
    if (previousReceipt) return { ...previousReceipt };

    let sourceStall: Stall | undefined;
    let sourceSlot: StallProduct | undefined;
    for (const stall of this.stalls) {
      sourceSlot = stall.products.find((entry) => entry.stallProductId === input.stallProductId);
      if (sourceSlot) {
        sourceStall = stall;
        break;
      }
    }
    if (!sourceStall || !sourceSlot) throw this.error('STALL_PRODUCT_NOT_FOUND', '没有找到这件摊位货品。');
    if (this.level < sourceStall.unlockLevel) {
      throw this.error('STALL_LOCKED', `需要达到 Lv.${sourceStall.unlockLevel} 才能进入这个摊位。`);
    }

    const product = this.products.find((entry) => entry.productId === sourceSlot?.productId);
    if (!product) throw this.error('PRODUCT_NOT_FOUND', '货品配置暂不可用。');
    const purchasedCount = this.purchaseCounts.get(product.productId) ?? 0;
    if (purchasedCount >= product.maxPurchasesPerUser) {
      throw this.error('PRODUCT_PURCHASE_LIMIT_REACHED', '这件货品已达到你的购买上限。');
    }

    const minimumPrice = Math.ceil((sourceSlot.sellerAskC * sourceStall.minimumDealRatio) / 5) * 5;
    if (!Number.isInteger(input.priceC) || input.priceC < minimumPrice || input.priceC > sourceSlot.sellerAskC) {
      throw this.error('INVALID_PURCHASE_PRICE', `成交价格需在 ${minimumPrice} C 至 ${sourceSlot.sellerAskC} C 之间。`);
    }
    if (this.cashBalance < input.priceC) throw this.error('INSUFFICIENT_CASH', '现金不足，无法购买。');

    const owned: OwnedProduct = {
      userProductId: `mock-owned-${this.inventory.length + 1}`,
      productId: product.productId,
      showName: product.displayName,
      stallId: sourceStall.stallId,
      stallProductId: sourceSlot.stallProductId,
      purchasePriceC: input.priceC,
      appraisalStatus: 'UNAPPRAISED',
      ownershipStatus: 'OWNED',
    };
    this.cashBalance -= input.priceC;
    this.purchaseCounts.set(product.productId, purchasedCount + 1);
    this.inventory.unshift(owned);

    const receipt = {
      purchaseId: `mock-purchase-${this.receipts.size + 1}`,
      ownership: { ...owned },
      cashBalance: this.cashBalance,
      remainingPurchases: product.maxPurchasesPerUser - purchasedCount - 1,
    };
    this.receipts.set(input.requestId, receipt);
    return { ...receipt, ownership: { ...owned } };
  }

  private loadJson<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      resources.load(path, JsonAsset, (error, asset) => {
        if (error || !asset) {
          reject(error ?? new Error(`Unable to load mock resource: ${path}`));
          return;
        }
        resolve(asset.json as T);
      });
    });
  }

  private error(code: string, message: string): Error & { code: string } {
    return Object.assign(new Error(message), { code });
  }
}
