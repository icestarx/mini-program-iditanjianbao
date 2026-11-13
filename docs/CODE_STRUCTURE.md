# 代码结构设计

## 1. 仓库形态

采用单仓库多应用结构，统一管理微信小游戏、管理端、服务端、共享 API 契约和数据库迁移。前后端独立构建、独立发布，通过 HTTPS API 通信。

```text
mini-program-iditanjianbao/
├── apps/
│   ├── game-client/          # Cocos Creator 微信小游戏
│   ├── admin-web/             # 内部运营管理端 Web 页面
│   └── api-server/            # Node.js + TypeScript 服务端
├── packages/
│   └── api-contracts/         # OpenAPI 定义、DTO、错误码
├── database/
│   ├── migrations/            # PostgreSQL 结构迁移
│   └── seeds/                 # 固定 NPC、摊位、货品等初始数据
├── docs/                      # 需求、架构、数据库、API、测试文档
├── package.json               # workspace 与统一开发命令
└── README.md
```

服务端当前垂直切片位于 `apps/api-server/src/modules/stalls/`：购买路由由会话守卫保护，业务服务在 PostgreSQL 事务中处理限购、余额、账本和玩家货品。认证守卫只验证受信任签发端提供的短期 HMAC JWT；微信 code 换取身份及会话签发尚未实现。议价记录也尚未实现，所以现阶段购买只接受挂牌价。

## 2. 应用职责

### `apps/game-client`

- 负责玩家界面、场景、动画、本地缓存和 API 调用。
- 展示服务端返回的 NPC、固定摊位、公开货品信息和玩家状态。
- 客户端只提交操作意图，不计算真伪、估值、成交结果、钱包余额或限购计数。

### `apps/admin-web`

- 供授权运营/内容人员维护 NPC、摊位、固定货品、货品限购、价格和内容版本。
- 管理内容审核与发布状态，查看充值、退款、通知处理状态及必要的玩家支持信息。
- 通过管理端专用 API 访问服务端；不直接连接数据库。
- 管理端展示隐藏真伪、估值和专家证据前，必须通过角色权限控制，并记录查看/修改/发布审计日志。

### `apps/api-server`

- 提供玩家 API、管理端 API、微信登录、游戏业务规则和渠道支付适配。
- 服务端是用户账户、钱包、固定货架、购买次数、玩家货品、鉴定结果及支付退款状态的唯一权威来源。
- 服务端校验管理员权限，执行内容发布、退款状态推进、幂等和审计。

### `packages/api-contracts`

- 保存 OpenAPI 接口定义、前后端传输 DTO、枚举和标准错误码。
- 只共享传输协议，不放数据库实体、货品真值、估值、鉴定证据或业务规则实现。
- 分离玩家 API 类型与管理员 API 类型，管理员字段不得进入小游戏客户端构建产物。

### `database`

- 迁移文件定义数据库结构，按版本顺序执行。
- `seeds/` 保存固定 NPC、摊位和摊位货品的导入数据。
- 发布中的货品配置需可版本化；已购买货品绑定购买时配置版本。

## 3. 服务端目录建议

```text
apps/api-server/src/
├── player-api/          # 玩家端 HTTP 路由与 DTO 映射
├── admin-api/           # 管理端 HTTP 路由、认证和权限检查
├── modules/
│   ├── users/
│   ├── wallets/
│   ├── npcs/
│   ├── stalls/
│   ├── products/
│   ├── purchases/
│   ├── appraisals/
│   ├── payments/
│   └── knowledge/
├── providers/
│   └── wechat-virtual-payment/ # 微信小游戏虚拟支付适配
├── infrastructure/      # PostgreSQL、日志、时间与配置
└── main.ts
```

支付渠道 API 被封装在 `providers/` 中；业务模块只依赖内部支付接口，避免微信渠道规则渗入商品、钱包和前端代码。

## 4. 依赖边界

```text
game-client ─────┐
                 ├── HTTPS API ── api-server ── PostgreSQL
admin-web ───────┘                    │
                                      └── payment provider
packages/api-contracts ── 仅提供接口契约给客户端、管理端和服务端
```

- `game-client` 不依赖数据库迁移、服务端模块或完整货品配置。
- `admin-web` 不依赖服务端数据库实体，也不持有支付密钥。
- 完整货品真值及鉴定内容只在服务端与受权限保护的管理 API 中使用。
- 微信支付密钥、AppSecret、数据库密码和其他服务凭证只放在服务端密钥配置中，不进入仓库或前端构建。

## 5. 配置与发布流程

1. 内容人员在管理端编辑 NPC、摊位与货品配置。
2. API 服务校验字段、固定货架数量、每摊 10 件、货品限购和真古董单次限购。
3. 有权限的审核人员审核并发布新配置版本，系统记录操作者与变更摘要。
4. 服务端从已发布配置读取固定货架；玩家端仅通过玩家 API 获取允许公开的字段。
5. 管理端、API 服务和微信小游戏分别构建部署；数据库迁移由发布流程控制。
