# 数据库表设计

本文按固定货架配置设计：NPC、摊位和摊位货品由运营配置；玩家访问时读取固定配置，不生成每日随机市场。

## 1. 玩家与账户

### `user`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `user_id` | `uuid` | 内部用户 ID |
| `wx_open_id` | `varchar(128)` | 微信用户标识，唯一 |
| `persona_id` | `varchar(16)` | 玩家人设 |
| `level` | `int` | 当前等级 |
| `xp` | `int` | 当前经验 |
| `created_at` | `timestamptz` | 创建时间 |

唯一键：`user_id`、`wx_open_id`

### `user_wallet`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `user_id` | `uuid` | 用户 ID，主键/外键 |
| `cash_balance` | `int` | 游戏现金 C |
| `voucher_balance` | `int` | 珍宝券 G |
| `updated_at` | `timestamptz` | 更新时间 |

### `wallet_ledger`

保存每次 C/G 余额变化，不以余额字段代替流水。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `ledger_id` | `uuid` | 流水 ID |
| `user_id` | `uuid` | 用户 ID |
| `currency` | `varchar(2)` | `C` 或 `G` |
| `balance_before` | `int` | 变更前余额 |
| `amount_delta` | `int` | 变更量 |
| `balance_after` | `int` | 变更后余额 |
| `reason` | `varchar(64)` | 业务原因 |
| `business_id` | `varchar(64)` | 关联业务 ID |
| `request_id` | `uuid` | 幂等请求 ID |
| `created_at` | `timestamptz` | 创建时间 |

唯一键：`request_id`

## 2. 固定 NPC、摊位与货品配置

### `npc`

保存 NPC 固定资料。`npc_type` 用于区分摊主及后续新增的其他 NPC 类型。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `npc_id` | `varchar(8)` | NPC ID |
| `npc_type` | `varchar(24)` | 类型，例如 `STALL_OWNER` |
| `name` | `varchar(64)` | 名称 |
| `profile` | `jsonb` | 外观、人设等固定资料 |
| `is_active` | `bool` | 是否启用 |

唯一键：`npc_id`

### `stall`

保存固定摊位。摊主类型的 NPC 固定关联两个摊位；每摊固定 10 个位置。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `stall_id` | `varchar(8)` | 摊位 ID |
| `npc_id` | `varchar(8)` | 摊主 NPC ID |
| `name` | `varchar(64)` | 摊位名称 |
| `unlock_level` | `int` | 解锁等级 |
| `slot_count` | `smallint` | 固定为 10 |
| `quote_factor` | `numeric(4,2)` | 报价倍率 |
| `min_deal_ratio` | `numeric(4,2)` | 最低成交比例 |
| `is_active` | `bool` | 是否启用 |

唯一键：`stall_id`。摊位数量与每位摊主两个摊位由配置校验保证。

### `product_item`

保存游戏货品定义及统一限购策略。所有物品概念使用 `product` 命名。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `product_id` | `varchar(8)` | 货品 ID |
| `config_version` | `varchar(16)` | 配置版本 |
| `name` | `varchar(64)` | 展示名称 |
| `product_type` | `varchar(24)` | 真古董、老物件、仿古品、工艺品等 |
| `authenticity` | `varchar(16)` | 固定游戏设定结论 |
| `value_base_c` | `int` | 隐藏游戏估值 |
| `perceived_anchor_c` | `int` | 外观报价锚点 |
| `unlock_level` | `int` | 解锁等级 |
| `max_purchases_per_user` | `int` | 每位玩家累计最多购买次数 |
| `is_active` | `bool` | 是否可上架 |

唯一键：`product_id`。所有货品必须设置有限的 `max_purchases_per_user`；真古董配置为 `1`。

### `stall_product`

固定货架配置，定义每个摊位展示哪 10 件货品及顺序、挂牌价。不是玩家购买状态。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `stall_product_id` | `uuid` | 摊位货品配置 ID |
| `stall_id` | `varchar(8)` | 摊位 ID |
| `slot_no` | `smallint` | 展示位置 1—10 |
| `product_id` | `varchar(8)` | 货品 ID |
| `seller_ask_c` | `int` | 固定配置挂牌价 |

唯一键：`stall_product_id`、`(stall_id, slot_no)`。每摊必须配置 10 行；同摊是否允许同一货品重复由配置校验约束。

## 3. 玩家货品状态与交易

### `user_product_purchase_count`

累计限购计数，用于可靠执行货品的玩家累计购买上限，尤其是真古董只能购买一次。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `user_id` | `uuid` | 用户 ID |
| `product_id` | `varchar(8)` | 货品 ID |
| `purchased_count` | `int` | 累计成功购买次数 |
| `updated_at` | `timestamptz` | 更新时间 |

唯一键：`(user_id, product_id)`。购买时锁定此行，验证 `purchased_count < product_item.max_purchases_per_user` 后才增加计数。

### `user_product`

玩家获得的具体货品实例及鉴定、出售状态。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `user_product_id` | `uuid` | 玩家货品实例 ID |
| `user_id` | `uuid` | 用户 ID |
| `stall_product_id` | `uuid` | 来源固定货位 |
| `product_id` | `varchar(8)` | 货品 ID |
| `product_config_version` | `varchar(16)` | 购买时配置版本 |
| `purchase_price_c` | `int` | 成交价 |
| `appraisal_status` | `varchar(16)` | 未鉴定 / 普通 / 专家 |
| `ownership_status` | `varchar(16)` | 持有 / 已出售 |
| `purchased_at` | `timestamptz` | 购买时间 |

唯一键：`user_product_id`。购买幂等由 `product_purchase.request_id` 保证。

### `product_purchase`

购买交易记录，作为货品限购计数和账本的业务依据。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `purchase_id` | `uuid` | 购买交易 ID |
| `request_id` | `uuid` | 幂等请求 ID |
| `user_id` | `uuid` | 用户 ID |
| `stall_product_id` | `uuid` | 固定货位 |
| `product_id` | `varchar(8)` | 货品 ID |
| `user_product_id` | `uuid` | 获得的实例 ID |
| `price_c` | `int` | 最终成交价 |
| `purchased_at` | `timestamptz` | 成交时间 |

唯一键：`purchase_id`、`request_id`。

## 4. 鉴定、NPC 关系与其他业务

### `user_product_judgement`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `user_product_id` | `uuid` | 玩家货品实例 |
| `answer` | `varchar(24)` | 玩家初判 |
| `selected_observations` | `jsonb` | 选择的观察依据 |
| `confidence` | `varchar(8)` | 判断把握 |
| `locked_at` | `timestamptz` | 判断锁定时间 |

唯一键：`user_product_id`

### `product_appraisal`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `appraisal_id` | `uuid` | 鉴定记录 ID |
| `user_product_id` | `uuid` | 玩家货品实例 |
| `tier` | `varchar(16)` | 普通 / 专家 |
| `paid_type` | `varchar(16)` | 现金 / 券 / 免费 |
| `evidence_version` | `varchar(16)` | 证据版本 |
| `ready_at` | `timestamptz` | 报告可领取时间 |
| `state` | `varchar(16)` | 状态 |

唯一键：`appraisal_id`

### `npc_relationship`

保存每位玩家与 NPC 的关系；一个 NPC 的两个摊位共享同一关系。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `user_id` | `uuid` | 用户 ID |
| `npc_id` | `varchar(8)` | NPC ID |
| `affection` | `int` | 好感 |
| `trust` | `int` | 信任 |
| `chapter` | `int` | 剧情进度 |
| `updated_at` | `timestamptz` | 更新时间 |

唯一键：`(user_id, npc_id)`

## 5. 充值、退款与渠道通知

小游戏支付渠道需按实际开通能力配置。`payment_order` 记录内部充值订单，`payment_refund` 记录针对充值订单的退款申请，`payment_notification` 记录渠道异步通知及其处理结果。渠道返回“退款受理”不等于退款成功。

### `payment_order`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `payment_order_id` | `uuid` | 内部充值订单 ID |
| `request_id` | `uuid` | 创建订单幂等 ID |
| `user_id` | `uuid` | 用户 ID |
| `sku_id` | `varchar(16)` | 充值档位/SKU |
| `payment_channel` | `varchar(32)` | 如 `WECHAT_MINIGAME_VIRTUAL`，后续可扩展 |
| `merchant_order_no` | `varchar(64)` | 商户侧订单号，提交给支付渠道 |
| `provider_transaction_id` | `varchar(64)` | 渠道支付单号，支付后记录 |
| `amount_fen` | `int` | 订单金额，单位分 |
| `currency` | `varchar(3)` | 币种，例如 `CNY` |
| `grant_voucher_amount` | `int` | 支付验证成功后应发放的 G 数 |
| `status` | `varchar(24)` | `CREATED` / `PENDING` / `PAID` / `DELIVERED` / `CLOSED` / `REFUNDING` / `REFUNDED` / `FAILED` |
| `provider_status` | `varchar(32)` | 渠道原始状态，供对账与排障 |
| `paid_at` | `timestamptz` | 支付成功时间 |
| `delivered_at` | `timestamptz` | G 发放时间 |
| `created_at` | `timestamptz` | 创建时间 |
| `updated_at` | `timestamptz` | 更新时间 |

唯一键：`payment_order_id`、`request_id`、`(payment_channel, merchant_order_no)`；`provider_transaction_id` 在非空时按渠道唯一。

### `payment_refund`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `payment_refund_id` | `uuid` | 内部退款 ID |
| `request_id` | `uuid` | 退款申请幂等 ID |
| `payment_order_id` | `uuid` | 原充值订单 |
| `merchant_refund_no` | `varchar(64)` | 商户退款单号；结果未知时重试沿用此号 |
| `provider_refund_id` | `varchar(64)` | 渠道退款单号 |
| `amount_fen` | `int` | 退款金额，单位分 |
| `refund_voucher_amount` | `int` | 退款对应的 G 数 |
| `reason` | `varchar(256)` | 退款原因 |
| `status` | `varchar(24)` | `REQUESTED` / `ACCEPTED` / `PROCESSING` / `SUCCEEDED` / `FAILED` / `CLOSED` / `ABNORMAL` |
| `provider_status` | `varchar(32)` | 渠道原始退款状态 |
| `requested_at` | `timestamptz` | 发起时间 |
| `completed_at` | `timestamptz` | 最终成功/失败时间 |
| `created_at` | `timestamptz` | 创建时间 |
| `updated_at` | `timestamptz` | 更新时间 |

唯一键：`payment_refund_id`、`request_id`、`(payment_order_id, merchant_refund_no)`；`provider_refund_id` 在非空时按渠道唯一。退款累计金额不得超过原订单已支付金额。

### `payment_notification`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `payment_notification_id` | `uuid` | 内部通知记录 ID |
| `payment_channel` | `varchar(32)` | 通知来源渠道 |
| `provider_event_id` | `varchar(128)` | 渠道通知 ID，若渠道提供 |
| `event_type` | `varchar(32)` | `PAYMENT` / `REFUND` |
| `payment_order_id` | `uuid` | 关联充值单，可空 |
| `payment_refund_id` | `uuid` | 关联退款单，可空 |
| `signature_verified` | `bool` | 是否通过渠道验签/验真 |
| `payload_hash` | `varchar(64)` | 原始请求体摘要，用于审计 |
| `payload` | `jsonb` | 最小化保存的通知字段，不存密钥 |
| `processing_status` | `varchar(24)` | `RECEIVED` / `PROCESSED` / `REJECTED` / `RETRY` |
| `received_at` | `timestamptz` | 收到时间 |
| `processed_at` | `timestamptz` | 处理时间 |

唯一键：`payment_notification_id`；`provider_event_id` 非空时按 `(payment_channel, provider_event_id)` 唯一，避免重复通知重复发货/退款处理。

其他模块表：`knowledge_artifact`、`knowledge_article`、`user_knowledge_bookmark`、`shop_sku`。知识馆藏与 `product_item` 货品表保持隔离。

## 5. 关键约束

- `stall.npc_id` 关联 `npc.npc_id`；摊主类型通过 `npc_type='STALL_OWNER'` 区分。
- `stall_product.stall_id` 关联 `stall`，`stall_product.product_id` 关联 `product_item`。
- 每个摊位固定 10 个 `stall_product` 配置；访问摊位直接读取这 10 个固定货品。
- 不设 `market_day` 或玩家市场快照表；营业日只用于每日限购状态和任务重置。
- 购买事务锁定用户钱包和累计限购计数，在一次事务中校验并写入扣款、购买记录、玩家货品实例与计数。
- `product_item.max_purchases_per_user` 必须为有限正整数；真古董必须为 `1`。出售货品不返还购买次数。
- 支付订单只在服务端验证渠道支付成功后发放 G；退款只在渠道退款最终成功后执行对应权益处理和账本记录。
- `payment_notification` 必须先验签/验真、去重，再更新订单状态；客户端支付回调不能作为到账凭证。
