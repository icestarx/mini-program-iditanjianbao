# Mock API 接入说明

## 当前开发实现

主体验入口 `apps/game-client/preview/index.html` 复用 V1.6.1 demo 的页面模板、样式和内嵌图片；游戏数据、购买、钱包和存档都在浏览器本地运行，不发起网络请求，也不触发真实支付。固定槽位来自 demo 的 12×10 配置，挂牌价使用固定商品锚点和摊位倍率，不按日期随机变化。开发体验默认每个账号每件货品限购 1 次，真古董同样限购 1 次。

`mock-api.mjs` 是独立的本地 mock adapter，不发起网络请求。它用于验证固定货架读取、玩家购买限购、钱包扣款和幂等行为；Cocos 场景侧有对应的 `CocosMockApi.ts` 实现。

公共 catalog 只包含 `productId`、展示名称、可观察特征、摊位和挂牌价格，不包含 `product_type`、真伪、估值或专家报告。

## 后续真实 API 对应

| Mock 方法 | 真实 API | 备注 |
| --- | --- | --- |
| `getStalls()` | `GET /v1/npcs?type=STALL_OWNER` | 获取摊主及固定摊位 |
| `getStall(stallId)` | `GET /v1/stalls/{stall_id}` | 获取固定 10 件货品和玩家限购剩余数 |
| `getWallet()` | `GET /v1/user/wallet` | 读取服务端 C/G 余额 |
| `getInventory()` | `GET /v1/user/products` | 获取玩家持有货品 |
| `purchase()` | `POST /v1/stall-products/{stall_product_id}/purchase` | 发送 `request_id`，服务端校验价格、余额、仓容和累计限购 |

Cocos UI 只依赖 `CocosMockApi` 暴露的方法。接入真实服务时实现同一接口的 HTTP adapter，再通过应用配置选择 mock/real，不在页面组件中散落 URL、请求体或响应字段转换。当前高保真 HTML 入口仍使用 demo 本地状态，接入服务端时应把这些数据操作迁移到同一 adapter。

## Mock 数据限制

- 目前所有产品的 `maxPurchasesPerUser` 均为 `1`，用于验证有限购买和单次购买流程；此为开发 mock 默认值，普通产品的最终次数需由产品配置确定。
- 固定货架和观察文案来自 V1.6.1 demo 的公开展示部分；价格取固定的锚点/摊位倍率计算值。
- Mock 购买不替代服务端安全校验，也不作为生产支付、账本或鉴定结果来源。
