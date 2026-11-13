import {
  _decorator,
  Color,
  Component,
  Graphics,
  Label,
  Node,
  ResolutionPolicy,
  UITransform,
  Vec3,
  view,
} from 'cc';
import { CocosMockApi, OwnedProduct, Stall, StallProduct } from '../data/CocosMockApi';

const { ccclass } = _decorator;

type Page = 'market' | 'stall' | 'product' | 'judgement' | 'bargain' | 'receipt' | 'inventory' | 'people' | 'knowledge';

@ccclass('GameEntry')
export class GameEntry extends Component {
  private readonly api = new CocosMockApi();
  private root: Node | null = null;
  private width = 750;
  private height = 1334;
  private page: Page = 'market';
  private currentStallId = 'S01A';
  private currentSlot: StallProduct | null = null;
  private currentReceipt: Record<string, unknown> | null = null;
  private currentBid = 0;
  private selectedJudgement = '';
  private loading = true;

  async onLoad(): Promise<void> {
    await this.api.initialize();
    // Apply the portrait design size after the Canvas and its Widget have loaded.
    // Applying it before the async mock data load lets the default preview Canvas
    // restore its template resolution while the scene finishes initializing.
    view.setDesignResolutionSize(750, 1334, ResolutionPolicy.SHOW_ALL);
    const visibleSize = view.getVisibleSize();
    this.width = visibleSize.width;
    this.height = visibleSize.height;
    this.loading = false;
    this.render();
  }

  private render(): void {
    const visibleSize = view.getVisibleSize();
    this.width = visibleSize.width;
    this.height = visibleSize.height;
    if (!this.root) {
      this.root = new Node('GameRoot');
      this.node.addChild(this.root);
    }
    for (const child of [...this.root.children]) {
      child.active = false;
      child.destroy();
    }
    this.root.addComponent(UITransform).setContentSize(this.width, this.height);
    this.drawPanel(this.root, 0, 0, this.width, this.height, '#F7FAF7', 0);

    if (this.loading) {
      this.addLabel(this.root, '正在整理今日集市…', 0, 0, this.width - 60, 80, 25, '#246D6A', true, Label.HorizontalAlign.CENTER);
      return;
    }

    this.renderHeader();
    switch (this.page) {
      case 'market': this.renderMarket(); break;
      case 'stall': this.renderStall(); break;
      case 'product': this.renderProduct(); break;
      case 'judgement': this.renderJudgement(); break;
      case 'bargain': this.renderBargain(); break;
      case 'receipt': this.renderReceipt(); break;
      case 'inventory': this.renderInventory(); break;
      case 'people': this.renderPlaceholder('人物关系', '与摊主的故事会在这里慢慢展开。'); break;
      case 'knowledge': this.renderPlaceholder('每日长见识', '真实馆藏知识与游戏货品分开呈现。'); break;
    }
    this.renderBottomNav();
  }

  private renderHeader(): void {
    const y = this.height / 2 - 48;
    this.drawPanel(this.root!, 0, y, this.width, 96, '#EDF7F2', 0);
    this.addLabel(this.root!, this.page === 'market' ? '我在地摊淘宝' : this.pageTitle(), -this.width / 2 + 180, y, 220, 42, 25, '#1E5D5B', true);
    if (this.page !== 'market' && this.page !== 'inventory' && this.page !== 'people' && this.page !== 'knowledge') {
      this.addButton(this.root!, '‹', -this.width / 2 + 38, y, 58, 54, '#DDF0E8', '#246D6A', () => this.goBack(), 34);
    }
    const wallet = this.api.getWallet();
    this.addButton(this.root!, `${wallet.cashBalance} C`, this.width / 2 - 105, y + 10, 112, 42, '#FFF8E9', '#A67C3C', () => this.setPage('inventory'), 17);
    this.addButton(this.root!, `${wallet.voucherBalance} G`, this.width / 2 - 105, y - 34, 112, 34, '#E3F3EE', '#328D8A', () => this.setPage('knowledge'), 15);
  }

  private renderMarket(): void {
    const stalls = this.api.getStalls();
    const contentTop = this.height / 2 - 135;
    this.addLabel(this.root!, '早上好，小淘客', 0, contentTop, this.width - 50, 42, 26, '#1E5D5B', true, Label.HorizontalAlign.CENTER);
    this.addLabel(this.root!, '沿着老街逛一圈，看看今天会遇见什么。', 0, contentTop - 38, this.width - 50, 28, 15, '#7E938D', false, Label.HorizontalAlign.CENTER);
    const mapTop = contentTop - 90;
    const mapHeight = Math.min(650, this.height * 0.49);
    const panelWidth = this.width - 44;
    this.drawPanel(this.root!, 0, mapTop - mapHeight / 2, panelWidth, mapHeight, '#FFFDF7', 24, '#E9E4D9');
    this.addLabel(this.root!, '老街集市', 0, mapTop - 36, panelWidth - 28, 30, 20, '#325950', true, Label.HorizontalAlign.CENTER);
    this.addLabel(this.root!, '点击摊位进入，固定货架不随刷新改变', 0, mapTop - 66, panelWidth - 28, 22, 13, '#7E938D', false, Label.HorizontalAlign.CENTER);

    const columnCount = 2;
    const rowCount = Math.ceil(stalls.length / columnCount);
    const cardWidth = (panelWidth - 24 - 10 * (columnCount - 1)) / columnCount;
    const columnStep = cardWidth + 10;
    const firstColumn = -(columnStep * (columnCount - 1)) / 2;
    const gridTop = mapTop - 112;
    const rowGap = rowCount > 1 ? Math.min(94, (mapHeight - 208) / (rowCount - 1)) : 0;
    stalls.forEach((stall, index) => {
      const col = index % columnCount;
      const row = Math.floor(index / columnCount);
      const x = firstColumn + col * columnStep;
      const y = gridTop - row * rowGap;
      const fill = stall.locked ? '#F0F1EC' : row % 2 === 0 ? '#E6F4EE' : '#FFF8EC';
      const titleColor = stall.locked ? '#9BA8A1' : '#246D6A';
      this.drawPanel(this.root!, x, y, cardWidth, 78, fill, 18, '#E6ECE3');
      this.addLabel(this.root!, stall.npcName, x, y + 16, cardWidth - 20, 25, 17, titleColor, true, Label.HorizontalAlign.CENTER);
      this.addLabel(this.root!, stall.stallName, x, y - 12, cardWidth - 20, 22, 12, '#718A80', false, Label.HorizontalAlign.CENTER);
      this.addLabel(this.root!, stall.locked ? `Lv.${stall.unlockLevel} 解锁` : `${stall.stallId} · 10 件固定货品`, x, y - 32, cardWidth - 18, 20, 10, stall.locked ? '#A6AFA8' : '#9A9B88', false, Label.HorizontalAlign.CENTER);
      this.bindTap(this.root!, x, y, cardWidth, 78, () => this.enterStall(stall.stallId));
    });
  }

  private renderStall(): void {
    const stall = this.api.getStall(this.currentStallId);
    this.addLabel(this.root!, stall.stallName, 0, this.height / 2 - 142, this.width - 50, 36, 24, '#1E5D5B', true, Label.HorizontalAlign.CENTER);
    this.addLabel(this.root!, `${stall.npcName} 的摊子 · 固定 10 件货品`, 0, this.height / 2 - 180, this.width - 50, 26, 13, '#7E938D', false, Label.HorizontalAlign.CENTER);
    const startY = this.height / 2 - 260;
    const cardWidth = (this.width - 62) / 2;
    const cardHeight = 150;
    const rowGap = 12;
    stall.products.forEach((product, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = col === 0 ? -cardWidth / 2 - 8 : cardWidth / 2 + 8;
      const y = startY - row * (cardHeight + rowGap);
      this.drawPanel(this.root!, x, y, cardWidth, cardHeight, product.soldOut ? '#F1F2EE' : '#FFFDF7', 18, '#E9E4D9');
      this.drawProductGlyph(this.root!, x, y + 30, product.productId);
      this.addLabel(this.root!, product.showName ?? product.productId, x, y - 21, cardWidth - 14, 29, 13, '#325950', true, Label.HorizontalAlign.CENTER);
      this.addLabel(this.root!, product.soldOut ? '已达个人购买上限' : `${product.sellerAskC} C`, x, y - 48, cardWidth - 16, 23, 14, product.soldOut ? '#8C9992' : '#C48659', true, Label.HorizontalAlign.CENTER);
      this.addButton(this.root!, product.soldOut ? '已购' : '看一看', x, y - 68, cardWidth - 24, 30, product.soldOut ? '#E6E9E5' : '#DFF1EB', product.soldOut ? '#8C9992' : '#246D6A', () => {
        if (product.soldOut) return;
        this.currentSlot = product;
        this.page = 'product';
        this.render();
      }, 12, product.soldOut);
    });
  }

  private renderProduct(): void {
    const product = this.currentSlot;
    if (!product) return this.setPage('market');
    this.addLabel(this.root!, product.showName ?? product.productId, 0, this.height / 2 - 145, this.width - 50, 38, 23, '#1E5D5B', true, Label.HorizontalAlign.CENTER);
    this.addLabel(this.root!, '鉴定前 · 真假未知', 0, this.height / 2 - 181, this.width - 50, 23, 12, '#9A7B49', false, Label.HorizontalAlign.CENTER);
    this.drawPanel(this.root!, 0, this.height / 2 - 310, this.width - 56, 210, '#FFF8EC', 22, '#F0E3CB');
    this.drawProductGlyph(this.root!, 0, this.height / 2 - 310, product.productId, 66);
    this.addLabel(this.root!, `摊主报价  ${product.sellerAskC} C`, 0, this.height / 2 - 396, this.width - 64, 28, 16, '#C48659', true, Label.HorizontalAlign.CENTER);

    this.addLabel(this.root!, '先看四处细节', 0, this.height / 2 - 440, this.width - 56, 28, 17, '#325950', true);
    const observations = product.observations ?? [];
    const rowStart = this.height / 2 - 493;
    observations.forEach((observation, index) => {
      const y = rowStart - index * 72;
      this.drawPanel(this.root!, 0, y, this.width - 58, 62, '#FFFDF7', 15, '#E9E4D9');
      this.addLabel(this.root!, observation.position, -this.width / 2 + 95, y, 115, 24, 12, '#328D8A', true);
      this.addLabel(this.root!, observation.text, 18, y, this.width - 220, 44, 13, '#526F67', false);
    });
    this.addButton(this.root!, '记下判断，再去谈价', 0, -this.height / 2 + 142, this.width - 60, 54, '#246D6A', '#FFFFFF', () => {
      this.selectedJudgement = '';
      this.page = 'judgement';
      this.render();
    }, 17);
  }

  private renderJudgement(): void {
    const product = this.currentSlot;
    if (!product) return this.setPage('market');
    this.addLabel(this.root!, '先做一个判断', 0, this.height / 2 - 152, this.width - 50, 38, 24, '#1E5D5B', true, Label.HorizontalAlign.CENTER);
    this.addLabel(this.root!, '买之前记下猜测，成交后仍不会揭晓答案。', 0, this.height / 2 - 192, this.width - 60, 28, 13, '#7E938D', false, Label.HorizontalAlign.CENTER);
    const categories = ['古董真品', '老物件', '古董赝品', '普通工艺品'];
    categories.forEach((category, index) => {
      const y = this.height / 2 - 280 - index * 86;
      const selected = this.selectedJudgement === category;
      this.addButton(this.root!, category, 0, y, this.width - 64, 64, selected ? '#246D6A' : '#FFFDF7', selected ? '#FFFFFF' : '#526F67', () => {
        this.selectedJudgement = category;
        this.render();
      }, 16, false, '#E9E4D9');
    });
    this.addButton(this.root!, '继续砍价', 0, -this.height / 2 + 142, this.width - 60, 54, this.selectedJudgement ? '#246D6A' : '#CDD8D1', '#FFFFFF', () => {
      if (!this.selectedJudgement) return;
      this.currentBid = this.currentSlot?.sellerAskC ?? 0;
      this.page = 'bargain';
      this.render();
    }, 17, !this.selectedJudgement);
  }

  private renderBargain(): void {
    const product = this.currentSlot;
    if (!product) return this.setPage('market');
    const stall = this.api.getStall(this.currentStallId);
    const minimum = Math.ceil((product.sellerAskC * stall.minimumDealRatio) / 5) * 5;
    this.addLabel(this.root!, '来，跟摊主谈谈价', 0, this.height / 2 - 155, this.width - 50, 38, 23, '#1E5D5B', true, Label.HorizontalAlign.CENTER);
    this.addLabel(this.root!, `${stall.npcName}：诚心买，我也愿意让一步。`, 0, this.height / 2 - 200, this.width - 60, 28, 13, '#7E938D', false, Label.HorizontalAlign.CENTER);
    this.drawPanel(this.root!, 0, 40, this.width - 64, 240, '#FFFDF7', 22, '#E9E4D9');
    this.addLabel(this.root!, product.showName ?? product.productId, 0, 128, this.width - 80, 32, 17, '#325950', true, Label.HorizontalAlign.CENTER);
    this.addLabel(this.root!, `挂牌价  ${product.sellerAskC} C`, 0, 82, this.width - 80, 25, 14, '#7E938D', false, Label.HorizontalAlign.CENTER);
    this.addButton(this.root!, '− 5', -105, 8, 84, 48, '#E7F4EE', '#246D6A', () => {
      this.currentBid = Math.max(minimum, this.currentBid - 5);
      this.render();
    }, 15, this.currentBid <= minimum);
    this.addLabel(this.root!, `${this.currentBid} C`, 0, 8, 120, 48, 28, '#C48659', true, Label.HorizontalAlign.CENTER);
    this.addButton(this.root!, '+ 5', 105, 8, 84, 48, '#E7F4EE', '#246D6A', () => {
      this.currentBid = Math.min(product.sellerAskC, this.currentBid + 5);
      this.render();
    }, 15, this.currentBid >= product.sellerAskC);
    this.addLabel(this.root!, `本次最低可谈 ${minimum} C`, 0, -48, this.width - 80, 24, 12, '#9A7B49', false, Label.HorizontalAlign.CENTER);
    this.addLabel(this.root!, `你的判断：${this.selectedJudgement}`, 0, -6, this.width - 100, 23, 12, '#7E938D', false, Label.HorizontalAlign.CENTER);
    this.addButton(this.root!, `以 ${this.currentBid} C 成交`, 0, -this.height / 2 + 142, this.width - 60, 54, '#ED8C76', '#FFFFFF', () => {
      try {
        this.currentReceipt = this.api.purchase({
          stallProductId: product.stallProductId,
          priceC: this.currentBid,
          requestId: `mock-${Date.now()}`,
        });
        this.page = 'receipt';
        this.render();
      } catch (error) {
        this.showToast((error as Error).message);
      }
    }, 17);
  }

  private renderReceipt(): void {
    const receipt = this.currentReceipt as { ownership?: OwnedProduct; cashBalance?: number } | null;
    const ownership = receipt?.ownership;
    this.addLabel(this.root!, '成交成功，入库啦！', 0, this.height / 2 - 170, this.width - 50, 42, 25, '#246D6A', true, Label.HorizontalAlign.CENTER);
    this.drawPanel(this.root!, 0, 115, this.width - 72, 300, '#FFFDF7', 24, '#E9E4D9');
    this.drawProductGlyph(this.root!, 0, 195, ownership?.productId ?? 'PRD', 72);
    this.addLabel(this.root!, ownership?.showName ?? '货品已入库', 0, 125, this.width - 100, 32, 18, '#325950', true, Label.HorizontalAlign.CENTER);
    this.addLabel(this.root!, `实际成交价  ${ownership?.purchasePriceC ?? 0} C`, 0, 82, this.width - 100, 26, 15, '#C48659', true, Label.HorizontalAlign.CENTER);
    this.addLabel(this.root!, '买到手只是第一步，真正的故事还在鉴定之后。', 0, 6, this.width - 120, 52, 13, '#7E938D', false, Label.HorizontalAlign.CENTER);
    this.addButton(this.root!, '去我的藏馆', 0, -this.height / 2 + 156, this.width - 60, 54, '#246D6A', '#FFFFFF', () => this.setPage('inventory'), 17);
    this.addButton(this.root!, '继续逛摊', 0, -this.height / 2 + 91, this.width - 60, 48, '#E7F4EE', '#246D6A', () => this.setPage('market'), 15);
  }

  private renderInventory(): void {
    const items = this.api.getInventory();
    this.addLabel(this.root!, '我的藏馆', 0, this.height / 2 - 150, this.width - 50, 38, 24, '#1E5D5B', true, Label.HorizontalAlign.CENTER);
    this.addLabel(this.root!, `${items.length} 件货品 · 买过的货品不再重复购买`, 0, this.height / 2 - 190, this.width - 50, 25, 12, '#7E938D', false, Label.HorizontalAlign.CENTER);
    if (items.length === 0) {
      this.drawPanel(this.root!, 0, 65, this.width - 68, 170, '#FFFDF7', 20, '#E9E4D9');
      this.addLabel(this.root!, '仓库还空着，去老街看看吧。', 0, 66, this.width - 90, 30, 14, '#7E938D', false, Label.HorizontalAlign.CENTER);
    }
    items.slice(0, 7).forEach((item, index) => {
      const y = this.height / 2 - 290 - index * 100;
      this.drawPanel(this.root!, 0, y, this.width - 64, 84, '#FFFDF7', 16, '#E9E4D9');
      this.drawProductGlyph(this.root!, -this.width / 2 + 82, y, item.productId, 28);
      this.addLabel(this.root!, item.showName, -this.width / 2 + 210, y + 13, 230, 25, 15, '#325950', true);
      this.addLabel(this.root!, `买入 ${item.purchasePriceC} C · 尚未鉴定`, -this.width / 2 + 215, y - 14, 245, 22, 11, '#7E938D');
    });
  }

  private renderPlaceholder(title: string, message: string): void {
    this.addLabel(this.root!, title, 0, this.height / 2 - 150, this.width - 50, 38, 24, '#1E5D5B', true, Label.HorizontalAlign.CENTER);
    this.drawPanel(this.root!, 0, 75, this.width - 72, 176, '#FFFDF7', 22, '#E9E4D9');
    this.addLabel(this.root!, message, 0, 76, this.width - 120, 56, 15, '#7E938D', false, Label.HorizontalAlign.CENTER);
  }

  private renderBottomNav(): void {
    const y = -this.height / 2 + 46;
    this.drawPanel(this.root!, 0, y, this.width, 92, '#F4FCF8', 0, '#D6E8DF');
    const tabs: Array<{ name: string; label: string; page: Page }> = [
      { name: '集市', label: '⌂', page: 'market' },
      { name: '我的藏馆', label: '▣', page: 'inventory' },
      { name: '人物', label: '♧', page: 'people' },
      { name: '长见识', label: '◉', page: 'knowledge' },
    ];
    const itemWidth = this.width / tabs.length;
    tabs.forEach((tab, index) => {
      const x = -this.width / 2 + itemWidth * (index + 0.5);
      const active = this.page === tab.page || (tab.page === 'market' && ['stall', 'product', 'judgement', 'bargain', 'receipt'].indexOf(this.page) !== -1);
      this.addLabel(this.root!, tab.label, x, y + 13, 34, 30, 22, active ? '#246D6A' : '#839D94', true, Label.HorizontalAlign.CENTER);
      this.addLabel(this.root!, tab.name, x, y - 17, 86, 20, 11, active ? '#246D6A' : '#839D94', active, Label.HorizontalAlign.CENTER);
      this.bindTap(this.root!, x, y, itemWidth, 82, () => this.setPage(tab.page));
    });
  }

  private drawProductGlyph(parent: Node, x: number, y: number, productId: string, size = 42): void {
    const kind = Number(productId.slice(-2)) % 4;
    const color = ['#E9F4ED', '#F5EAD5', '#E2F2F0', '#F6E5DC'][kind];
    this.drawPanel(parent, x, y, size * 2.25, size * 1.9, color, size * 0.45, '#E9E4D9');
    this.addLabel(parent, ['瓷', '铜', '玉', '木'][kind], x, y + 1, size * 1.5, size * 1.4, size * 0.65, '#8A806B', true, Label.HorizontalAlign.CENTER);
  }

  private drawPanel(parent: Node, x: number, y: number, width: number, height: number, color: string, radius: number, stroke?: string): Node {
    const node = new Node('Panel');
    node.setPosition(new Vec3(x, y, 0));
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = this.parseColor(color);
    graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    graphics.fill();
    if (stroke) {
      graphics.strokeColor = this.parseColor(stroke);
      graphics.lineWidth = 1;
      graphics.roundRect(-width / 2, -height / 2, width, height, radius);
      graphics.stroke();
    }
    parent.addChild(node);
    return node;
  }

  private addLabel(
    parent: Node,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    color: string,
    bold = false,
    align = Label.HorizontalAlign.LEFT,
  ): Node {
    const node = new Node('Text');
    node.setPosition(new Vec3(x, y, 1));
    node.addComponent(UITransform).setContentSize(width, height);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize * 1.4;
    label.color = this.parseColor(color);
    label.horizontalAlign = align;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.isBold = bold;
    label.enableWrapText = true;
    parent.addChild(node);
    return node;
  }

  private addButton(
    parent: Node,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    background: string,
    foreground: string,
    action: () => void,
    fontSize = 15,
    disabled = false,
    border = '',
  ): Node {
    const button = this.drawPanel(parent, x, y, width, height, disabled ? '#E6E9E5' : background, Math.min(height / 3, 16), border || undefined);
    this.addLabel(button, text, 0, 0, width - 12, height - 4, fontSize, disabled ? '#8C9992' : foreground, true, Label.HorizontalAlign.CENTER);
    if (!disabled) this.bindTap(button, 0, 0, width, height, action);
    return button;
  }

  private bindTap(parent: Node, x: number, y: number, width: number, height: number, action: () => void): void {
    const hit = new Node('HitTarget');
    hit.setPosition(new Vec3(x, y, 10));
    hit.addComponent(UITransform).setContentSize(width, height);
    hit.on(Node.EventType.TOUCH_END, action, this);
    parent.addChild(hit);
  }

  private parseColor(hex: string): Color {
    const value = hex.replace('#', '');
    return new Color(
      Number.parseInt(value.slice(0, 2), 16),
      Number.parseInt(value.slice(2, 4), 16),
      Number.parseInt(value.slice(4, 6), 16),
      255,
    );
  }

  private enterStall(stallId: string): void {
    const stall = this.api.getStall(stallId);
    if (stall.locked) return this.showToast(`需要达到 Lv.${stall.unlockLevel} 才能进入。`);
    this.currentStallId = stallId;
    this.page = 'stall';
    this.render();
  }

  private setPage(page: Page): void {
    this.page = page;
    this.render();
  }

  private goBack(): void {
    const previous: Partial<Record<Page, Page>> = {
      stall: 'market', product: 'stall', judgement: 'product', bargain: 'judgement', receipt: 'bargain',
    };
    this.page = previous[this.page] ?? 'market';
    this.render();
  }

  private pageTitle(): string {
    const titles: Record<Page, string> = {
      market: '集市', stall: '摊位详情', product: '物件观察', judgement: '购买前判断',
      bargain: '砍价交易', receipt: '成交回执', inventory: '我的藏馆', people: '人物', knowledge: '每日长见识',
    };
    return titles[this.page];
  }

  private showToast(message: string): void {
    this.addLabel(this.root!, message, 0, -this.height / 2 + 160, this.width - 70, 50, 14, '#B85F50', true, Label.HorizontalAlign.CENTER);
  }
}
