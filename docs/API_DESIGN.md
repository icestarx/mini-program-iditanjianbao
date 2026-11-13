# API 设计

## 1. 基本约定

- 所有接口使用 HTTPS、JSON 和微信登录会话。
- 客户端只提交操作意图与业务 ID，不提交商品真伪、估值、余额、限购计数或交易结果。
- 所有写操作带 `request_id`；服务端保证重复请求不重复扣款或发货。
- `product` 统一表示游戏内所有可交易物品；接口和字段不使用 `item` 作为该概念名称。
- 摊位与货品均为固定配置；接口读取配置，不生成每日随机货架。

## 2. 登录与玩家

### `POST /v1/auth/login`

请求：`{ "code": "wx_login_code" }`

响应：`{ "session_id": "...", "user_id": "...", "is_new_user": true }`

### `GET /v1/user/profile`

响应：`{ "user_id": "...", "persona_id": "P01", "level": 1, "xp": 0 }`

### `GET /v1/user/wallet`

响应：`{ "cash_balance": 500, "voucher_balance": 0 }`

## 3. NPC 与固定摊位

### `GET /v1/npcs?type=STALL_OWNER`

返回指定类型 NPC 及关联的固定摊位。`type` 可扩展其他 NPC 类型。

响应：

```json
{
  "npcs": [
    {
      "npc_id": "NPC01",
      "npc_type": "STALL_OWNER",
      "name": "王大爷",
      "stalls": [
        { "stall_id": "S01A", "name": "街角旧货摊", "unlock_level": 1 },
        { "stall_id": "S01B", "name": "王大爷旧箱摊", "unlock_level": 4 }
      ]
    }
  ]
}
```

### `GET /v1/stalls/{stall_id}`

返回摊位资料和固定货品列表。锁定摊位可返回配置和解锁等级，但不允许购买。

响应：

```json
{
  "stall_id": "S01A",
  "npc_id": "NPC01",
  "name": "街角旧货摊",
  "products": [
    {
      "stall_product_id": "...",
      "product_id": "PRD007",
      "show_name": "旧纪念铜币",
      "seller_ask_c": 170,
      "remaining_total_for_user": 2,
      "status": "AVAILABLE"
    }
  ]
}
```

货品对玩家的剩余购买次数由服务端根据 `product_item.max_purchases_per_user` 与玩家购买记录计算。响应绝不包含隐藏真伪、隐藏估值和专家证据。

### `GET /v1/stalls/{stall_id}/products/{stall_product_id}`

返回该固定货位的公开展示信息及免费观察证据。

## 4. 判断与交易

### `PUT /v1/stall-products/{stall_product_id}/judgement`

请求：

```json
{
  "request_id": "uuid",
  "answer": "老物件",
  "selected_observations": ["PRD007-OB1"],
  "confidence": "中"
}
```

### `POST /v1/stall-products/{stall_product_id}/bargain`

请求：`{ "request_id": "uuid", "bid_c": 60, "style": "friendly" }`

响应：`{ "accepted": true, "final_price_c": 60 }`

服务端读取摊位议价参数并决定结果。

### `POST /v1/stall-products/{stall_product_id}/purchase`

请求：`{ "request_id": "uuid", "price_c": 60 }`

成功响应：

```json
{
  "purchase_id": "...",
  "user_product_id": "...",
  "price_c": 60,
  "cash_balance": 440,
  "remaining_total_for_user": 1
}
```

购买事务必须依次校验摊位解锁、货品累计限购、仓库容量、挂牌价/议价结果和钱包余额，然后原子写入扣款、账本、`product_purchase`、`user_product` 及累计限购计数。首个服务端切片尚未实现议价记录，因此目前仅接受与服务端挂牌价完全相同的 `price_c`；任何自报折扣都以 `PRICE_NOT_CONFIRMED` 拒绝。服务端议价接口接入后，购买必须引用有效议价结果，不能信任客户端传回的价格本身。

真古董 `max_purchases_per_user=1`。玩家购买并出售后，购买次数不返还。达到累计上限时返回 `PRODUCT_PURCHASE_LIMIT_REACHED`。

## 5. 玩家货品与鉴定

### `GET /v1/user/products`

返回当前持有和历史出售货品。

### `POST /v1/user/products/{user_product_id}/appraisals`

请求：`{ "request_id": "uuid", "tier": "expert", "paid_type": "cash" }`

### `GET /v1/product-appraisals/{appraisal_id}`

鉴定完成后返回对应报告、证据和复盘。购买回执不得提前返回这些隐藏字段。

### `POST /v1/user/products/{user_product_id}/sell`

请求：`{ "request_id": "uuid", "channel": "quick" }`

## 6. NPC 关系

### `GET /v1/npcs/{npc_id}/relationship`

### `POST /v1/npcs/{npc_id}/dialogue-choices`

请求：`{ "request_id": "uuid", "dialogue_id": "NPC01-CH1-A" }`

同一 NPC 的两个摊位共享关系和每日对话次数。

## 7. 知识库、商城与支付

- `GET /v1/knowledge/today`
- `GET /v1/knowledge/archive`
- `PUT /v1/knowledge/bookmarks/{article_id}`
- `GET /v1/shop/catalog`
- `POST /v1/shop/products/purchase`

### `POST /v1/pay/orders`

创建充值订单并返回当前账号已开通支付渠道所需的调起参数。小游戏支付渠道通过适配层接入；不能默认将普通微信支付 JSAPI/API v3 用作小游戏支付。

请求：`{ "request_id": "uuid", "sku_id": "G60" }`

响应：`{ "payment_order_id": "...", "payment_channel": "WECHAT_MINIGAME_VIRTUAL", "payment_params": {} }`

### `GET /v1/pay/orders/{payment_order_id}`

返回内部订单状态、应发 G 数及已发放结果。客户端支付接口的 success 回调只提示客户端继续查单，不能作为到账证明。

### `POST /v1/pay/orders/{payment_order_id}/refunds`

提交退款申请。服务端校验原订单支付成功、退款额度、渠道规则和该订单历史退款总额，创建 `payment_refund` 后调用对应渠道退款接口。

请求：`{ "request_id": "uuid", "amount_fen": 600, "reason": "用户申请" }`

响应：`{ "payment_refund_id": "...", "status": "PROCESSING" }`

响应中的受理/处理中状态不是退款成功；退款最终状态通过回调或主动查单确认后更新。

### `GET /v1/pay/refunds/{payment_refund_id}`

查询退款状态及最终结果。

### 渠道通知入口

- `POST /v1/pay/notifications/payment`
- `POST /v1/pay/notifications/refund`

入口必须按当前支付渠道的协议验签/验真，记录 `payment_notification`，用渠道通知 ID 和订单状态实现幂等处理。只有支付成功通知或服务端查单确认支付成功后才能发放 G；只有退款最终成功后才能登记成功退款和处理相应虚拟权益。

退款失败、异常、关闭、超时未知状态必须保留并可查单/重试；结果未知时复用原商户退款单号，避免重复退款。支付成功和退款成功都写入 `wallet_ledger`，不物理修改历史流水。

## 8. 错误码

- `UNAUTHORIZED`
- `STALL_LOCKED`
- `STALL_PRODUCT_NOT_FOUND`
- `PRODUCT_PURCHASE_LIMIT_REACHED`
- `INSUFFICIENT_CASH`
- `INSUFFICIENT_G`
- `INVENTORY_FULL`
- `BARGAIN_EXHAUSTED`
- `REQUEST_REPLAY`
- `PRICE_NOT_CONFIRMED`
- `APPRAISAL_NOT_READY`
- `PAYMENT_UNSUPPORTED`
- `ORDER_VERIFY_FAILED`
- `REFUND_NOT_ALLOWED`
- `REFUND_AMOUNT_EXCEEDED`
- `REFUND_STATUS_UNKNOWN`
