import assert from 'node:assert/strict';
import test from 'node:test';
import { MockGameApi, mockCatalogSummary } from './mock-api.mjs';

test('mock catalog contains the fixed 120 products and 120 stall positions', () => {
  assert.deepEqual(mockCatalogSummary, { productCount: 120, stallCount: 12, fixedSlotCount: 120 });
});

test('a stall always returns its configured ten products without hidden truth fields', async () => {
  const api = new MockGameApi();
  const stall = await api.getStall('S01A');

  assert.equal(stall.products.length, 10);
  for (const product of stall.products) {
    assert.ok(product.showName);
    assert.equal(product.observations.length, 4);
    assert.equal('category' in product, false);
    assert.equal('truth' in product, false);
    assert.equal('valueBaseC' in product, false);
  }
});

test('purchase deducts cash and a repeated request returns the same receipt', async () => {
  const api = new MockGameApi();
  const stall = await api.getStall('S01A');
  const product = stall.products[0];
  const purchaseRequest = {
    stallProductId: product.stallProductId,
    priceC: product.sellerAskC,
    requestId: 'purchase-request-1',
  };

  const firstReceipt = await api.purchase(purchaseRequest);
  const retryReceipt = await api.purchase(purchaseRequest);

  assert.deepEqual(retryReceipt, firstReceipt);
  assert.equal((await api.getWallet()).cashBalance, 500 - product.sellerAskC);
  assert.equal((await api.getInventory()).length, 1);
});

test('a product can only be purchased up to its configured per-user limit', async () => {
  const api = new MockGameApi({ startingCash: 10000 });
  const stall = await api.getStall('S01A');
  const slot = stall.products[0];

  await api.purchase({
    stallProductId: slot.stallProductId,
    priceC: slot.sellerAskC,
    requestId: 'first-purchase',
  });

  await assert.rejects(
    api.purchase({
      stallProductId: slot.stallProductId,
      priceC: slot.sellerAskC,
      requestId: 'second-purchase',
    }),
    { code: 'PRODUCT_PURCHASE_LIMIT_REACHED' },
  );
});

test('a locked stall cannot be purchased', async () => {
  const api = new MockGameApi({ level: 1 });
  const stall = await api.getStall('S01B');
  const slot = stall.products[0];

  await assert.rejects(
    api.purchase({ stallProductId: slot.stallProductId, priceC: 5, requestId: 'locked-purchase' }),
    { code: 'STALL_LOCKED' },
  );
});
