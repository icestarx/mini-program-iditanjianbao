import { MockGameApi, mockCatalogSummary } from '../mock/mock-api.mjs';

const api = new MockGameApi({ level: 12 });
const state = { page: 'market', stallId: null, stallProductId: null, judgement: '', bid: 0, receipt: null };
const data = { ready: false, stalls: [], stallsById: new Map(), wallet: null, inventory: [] };
const screen = document.querySelector('#screen');
const toastNode = document.querySelector('#toast');
const pageNames = {
  market: ['PG-10', '我在地摊淘宝'], stall: ['PG-11', '摊位详情'], product: ['PG-12', '物件观察'],
  judgement: ['PG-15', '购买前判断'], bargain: ['PG-13', '砍价交易'], receipt: ['PG-14', '成交回执'],
  inventory: ['PG-21', '我的藏馆'], people: ['PG-63', '人物关系'], knowledge: ['PG-80', '每日长见识'],
};
let toastTimer;

function selectedStall() { return state.stallId ? data.stallsById.get(state.stallId) ?? null : null; }
function selectedProduct() {
  return selectedStall()?.products.find((product) => product.stallProductId === state.stallProductId) ?? null;
}
async function refreshData() {
  const [stalls, wallet, inventory] = await Promise.all([
    api.getStalls(),
    api.getWallet(),
    api.getInventory(),
  ]);
  const stallDetails = await Promise.all(stalls.map((stall) => api.getStall(stall.stallId)));
  data.stalls = stalls;
  data.stallsById = new Map(stallDetails.map((stall) => [stall.stallId, stall]));
  data.wallet = wallet;
  data.inventory = inventory;
  data.ready = true;
}
function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function button(text, action, className = 'btn') {
  return `<button class="${className}" data-action="${action}">${safeText(text)}</button>`;
}
function showToast(message) {
  toastNode.textContent = message;
  toastNode.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('visible'), 1800);
}

function marketPage() {
  const stalls = data.stalls;
  return `<div class="screen">
    <section class="hero"><div class="hero-greet"><strong>早上好，小淘客 ✨</strong><small>今日老街开市 · 总会遇见故事</small></div><div class="hero-action">${button('进入老街集市', 'market-map')}</div></section>
    <div class="quick-links"><button class="quick-link" data-page="inventory">我的藏馆</button><button class="quick-link" data-page="people">人物图鉴</button><button class="quick-link" data-page="knowledge">每日长见识</button></div>
    <div class="section-bar"><b>老街地图 · 点击摊位</b><small>${mockCatalogSummary.stallCount} 个固定摊位</small></div>
    <section class="map-board"><div class="map-heading">顺着老街慢慢逛，货品和位置都是固定的</div><div class="map-grid">${stalls.map((stall) => `<button class="stall-pin ${stall.locked ? 'locked' : ''}" data-stall="${stall.stallId}" ${stall.locked ? 'disabled' : ''}><strong>${safeText(stall.npcName)} · ${safeText(stall.stallName)}</strong><span>${stall.locked ? `Lv.${stall.unlockLevel} 解锁` : `${stall.stallId} · 固定 10 件`}</span></button>`).join('')}</div></section>
    <div class="section-bar"><b>今天想先看什么？</b><small>不买也可以逛一逛</small></div>
    <div class="notice">先观察、记下判断，再谈价。成交回执不会提前揭晓真假。</div>
  </div>`;
}

function stallPage() {
  const stall = selectedStall();
  if (!stall) return marketPage();
  return `<div class="screen"><div class="section-bar"><b>${safeText(stall.stallName)}</b><small>${stall.products.length}/10 固定货位</small></div>
    <section class="npc-card"><div class="npc-avatar">${safeText(stall.npcName.slice(0, 1))}</div><div><strong>${safeText(stall.npcName)}</strong><small>${safeText(stall.scene)}</small></div></section>
    <div class="section-bar"><b>摊上的货</b><small>每人每件限购一次（开发默认值）</small></div>
    <div class="product-grid">${stall.products.map((product) => `<button class="product-card" data-product="${product.stallProductId}" ${product.soldOut ? 'disabled' : ''}><div class="product-art">${safeText(product.showName.slice(0, 1))}</div><strong>${safeText(product.showName)}</strong><div class="price">${product.soldOut ? '达到购买上限' : `${product.sellerAskC} C`}</div><small class="limit">${product.soldOut ? '本账号暂不可购买' : `剩余可购 ${product.remainingPurchases} 次`}</small></button>`).join('')}</div>
  </div>`;
}

function productPage() {
  const product = selectedProduct();
  if (!product) return marketPage();
  return `<div class="screen"><div class="section-bar"><b>${safeText(product.showName)}</b><span class="pill gold">鉴定前 · 真假未知</span></div>
    <section class="warm-card" style="text-align:center;padding:22px"><div class="product-art" style="height:155px;font-size:44px">${safeText(product.showName.slice(0, 1))}</div><div class="price-large" style="margin-top:12px">${product.sellerAskC} C</div><small class="muted">摊主挂牌价</small></section>
    <div class="section-bar"><b>先看四处细节</b><small>免费观察</small></div>
    ${product.observations.map((item) => `<div class="observation"><b>${safeText(item.position)}</b><span>${safeText(item.text)}</span></div>`).join('')}
    <div class="btnrow" style="margin-top:14px">${button('记下判断', 'to-judgement', 'btn light')}${button('直接砍价', 'to-bargain', 'btn')}</div>
  </div>`;
}

function judgementPage() {
  const product = selectedProduct();
  const categories = ['古董真品', '老物件', '古董赝品', '普通工艺品'];
  return `<div class="screen"><h2 class="screen-title">先做一个判断</h2><p class="screen-sub">买之前记下猜测，成交后仍不会揭晓答案。</p>
    <section class="soft-card"><strong>${safeText(product?.showName ?? '')}</strong><div class="muted" style="margin-top:6px">摊主报价 ${product?.sellerAskC ?? 0} C</div></section>
    <div class="section-bar"><b>你觉得它更像哪一类？</b></div>
    ${categories.map((item) => `<button class="choice ${state.judgement === item ? 'selected' : ''}" data-guess="${safeText(item)}">${safeText(item)}</button>`).join('')}
    <div style="margin-top:14px">${button('记下判断，继续谈价', 'to-bargain', 'btn full')}</div>
  </div>`;
}

function bargainPage() {
  const product = selectedProduct();
  const stall = selectedStall();
  if (!product || !stall) return marketPage();
  const minimum = Math.ceil((product.sellerAskC * stall.minimumDealRatio) / 5) * 5;
  state.bid = Math.min(product.sellerAskC, Math.max(minimum, state.bid || product.sellerAskC));
  return `<div class="screen"><h2 class="screen-title">来，跟摊主谈谈价</h2><p class="screen-sub">${safeText(stall.npcName)}：诚心买，我也愿意让一步。</p>
    <section class="soft-card" style="text-align:center;padding:20px"><strong>${safeText(product.showName)}</strong><p class="muted">挂牌价 ${product.sellerAskC} C</p><div class="btnrow" style="align-items:center;justify-content:center"><button class="btn light small" data-action="bid-down" ${state.bid <= minimum ? 'disabled' : ''}>− 5</button><strong class="price-large">${state.bid} C</strong><button class="btn light small" data-action="bid-up" ${state.bid >= product.sellerAskC ? 'disabled' : ''}>+ 5</button></div><p class="muted">最低可谈 ${minimum} C · ${state.judgement ? `你的判断：${safeText(state.judgement)}` : '还没有记录判断'}</p></section>
    <div style="margin-top:14px">${button(`以 ${state.bid} C 成交`, 'purchase', 'btn coral full')}</div>
  </div>`;
}

function receiptPage() {
  const owned = state.receipt?.ownership;
  if (!owned) {
    return `<div class="screen"><h2 class="screen-title">成交回执</h2><section class="soft-card empty">完成一次购买后，这里会显示成交货品、实际价格和钱包余额。</section><div style="margin-top:14px">${button('回到集市', 'go-market', 'btn light full')}</div></div>`;
  }
  return `<div class="screen" style="text-align:center"><div class="section-bar"><span class="pill">成交回执</span></div><h2 class="screen-title">成交成功，入库啦！</h2><p class="screen-sub">买下来只是第一步，真正的故事还在鉴定之后。</p>
    <section class="soft-card" style="padding:26px 14px"><div class="product-art" style="height:160px;font-size:44px">${safeText(owned.showName.slice(0, 1))}</div><h3>${safeText(owned.showName)}</h3><span class="pill">当前状态：未经鉴定</span><p class="price-large">实际成交价 ${owned.purchasePriceC} C</p><p class="muted">支付后剩余 ${state.receipt.cashBalance} C</p></section>
    <div style="margin-top:14px">${button('去我的藏馆', 'go-inventory', 'btn full')}</div><div style="margin-top:8px">${button('继续逛摊', 'go-market', 'btn light full')}</div>
  </div>`;
}

function inventoryPage() {
  const inventory = data.inventory;
  return `<div class="screen"><h2 class="screen-title">我的藏馆</h2><p class="screen-sub">${inventory.length} 件货品 · 买过的货品不再重复购买</p>
    ${inventory.length ? inventory.map((item) => `<section class="soft-card" style="display:flex;align-items:center;gap:11px;margin:9px 0"><div class="product-art" style="width:70px;height:65px;flex:none">${safeText(item.showName.slice(0, 1))}</div><div><strong>${safeText(item.showName)}</strong><p class="muted">买入 ${item.purchasePriceC} C · 尚未鉴定</p></div></section>`).join('') : `<section class="soft-card empty">仓库还空着，去老街看看吧。</section>`}
    <div style="margin-top:14px">${button('回到集市', 'go-market', 'btn full')}</div>
  </div>`;
}

function placeholderPage(title, description) {
  return `<div class="screen"><h2 class="screen-title">${safeText(title)}</h2><section class="soft-card empty">${safeText(description)}</section><div style="margin-top:14px">${button('回到集市', 'go-market', 'btn light full')}</div></div>`;
}

function render() {
  if (!data.ready) {
    screen.innerHTML = '<div class="screen"><section class="soft-card empty">正在准备今日集市…</section></div>';
    return;
  }
  const renderers = {
    market: marketPage,
    stall: stallPage,
    product: productPage,
    judgement: judgementPage,
    bargain: bargainPage,
    receipt: receiptPage,
    inventory: inventoryPage,
    people: () => placeholderPage('人物图鉴', '与六位摊主的故事会在这里慢慢展开。'),
    knowledge: () => placeholderPage('每日长见识', '真实馆藏知识与游戏货品分开呈现。'),
  };
  const [routeId, title] = pageNames[state.page];
  document.querySelector('#page-title').textContent = title;
  document.querySelector('#route-info').textContent = routeId;
  document.querySelector('#stall-info').textContent = state.stallId ?? '未选择';
  document.querySelector('#product-info').textContent = selectedProduct()?.showName ?? '未选择';
  document.querySelector('#cash-balance').textContent = `◉ ${data.wallet.cashBalance}`;
  document.querySelector('#cash-stat').textContent = data.wallet.cashBalance;
  document.querySelector('#owned-count').textContent = data.inventory.length;
  screen.innerHTML = renderers[state.page]();
  document.querySelectorAll('[data-page]').forEach((el) => el.classList.toggle('active', el.dataset.page === state.page || (el.dataset.page === 'market' && ['stall', 'product', 'judgement', 'bargain', 'receipt'].includes(state.page))));
  document.querySelectorAll('.route-row').forEach((el) => el.classList.toggle('active', el.dataset.page === state.page));
  screen.scrollTop = 0;
}

function navigate(page) {
  state.page = page;
  render();
}

function openPreviewRoute(page) {
  if (['market', 'inventory', 'people', 'knowledge'].includes(page)) return navigate(page);

  const stall = data.stalls.find((entry) => !entry.locked);
  const stallDetails = stall ? data.stallsById.get(stall.stallId) : null;
  if (!stall || !stallDetails) {
    showToast('当前没有可进入的摊位。');
    return;
  }

  state.stallId = stall.stallId;
  if (page !== 'stall') state.stallProductId = stallDetails.products[0]?.stallProductId ?? null;
  if (page === 'bargain' && !state.bid) state.bid = stallDetails.products[0]?.sellerAskC ?? 0;
  state.page = page;
  render();
}

document.body.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.page) {
    if (button.classList.contains('route-row')) return openPreviewRoute(button.dataset.page);
    return navigate(button.dataset.page);
  }
  if (button.dataset.stall) {
    state.stallId = button.dataset.stall;
    state.page = 'stall';
    return render();
  }
  if (button.dataset.product) {
    state.stallProductId = button.dataset.product;
    state.page = 'product';
    return render();
  }
  if (button.dataset.guess) {
    state.judgement = button.dataset.guess;
    return render();
  }

  switch (button.dataset.action) {
    case 'market-map':
      document.querySelector('.map-board')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    case 'to-judgement': state.page = 'judgement'; return render();
    case 'to-bargain':
      state.page = 'bargain';
      state.bid = selectedProduct()?.sellerAskC ?? 0;
      return render();
    case 'bid-down': state.bid -= 5; return render();
    case 'bid-up': state.bid += 5; return render();
    case 'purchase': {
      try {
        state.receipt = await api.purchase({
          stallProductId: state.stallProductId,
          priceC: state.bid,
          requestId: `preview-${Date.now()}`,
        });
        await refreshData();
        state.page = 'receipt';
        render();
      } catch (error) {
        showToast(error.message);
      }
      return;
    }
    case 'go-inventory': return navigate('inventory');
    case 'go-market': return navigate('market');
    case 'reset': return location.reload();
    case 'back': {
      const back = { stall: 'market', product: 'stall', judgement: 'product', bargain: 'judgement', receipt: 'bargain' };
      return navigate(back[state.page] ?? 'market');
    }
    default: return;
  }
});

document.querySelector('#back-button').addEventListener('click', () => {
  const back = { stall: 'market', product: 'stall', judgement: 'product', bargain: 'judgement', receipt: 'bargain' };
  navigate(back[state.page] ?? 'market');
});
document.querySelector('#reset-demo').addEventListener('click', () => location.reload());
document.querySelector('#settings-button').addEventListener('click', () => showToast('开发预览暂不接入设置页。'));

render();
refreshData().then(render).catch((error) => {
  screen.innerHTML = `<div class="screen"><section class="soft-card empty">集市加载失败：${safeText(error.message)}</section></div>`;
});
