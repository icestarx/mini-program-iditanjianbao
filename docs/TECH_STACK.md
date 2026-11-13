# 技术选型（已确认）

## 目标

- 开发微信小游戏、内部运营管理端和独立服务端。
- 前端独立构建部署；所有玩家交易状态由服务端负责。
- 使用单仓库管理多应用，减少接口和配置同步成本。

## 已选技术

| 层 | 选型 | 用途 |
| --- | --- | --- |
| 微信小游戏 | Cocos Creator 3.8 | 场景、UI、动画与微信小游戏发布 |
| 管理端 | React + TypeScript + Vite | NPC、摊位、货品、内容发布、充值退款管理 |
| API 服务 | Node.js 24 LTS + TypeScript + NestJS | 玩家 API、管理 API 和游戏业务规则 |
| 数据库 | PostgreSQL + Prisma | 关系数据、事务、迁移和类型安全访问 |
| Monorepo | pnpm Workspace | 组织 API 服务、管理端和共享契约 |
| API 契约 | OpenAPI | 定义端点、DTO 和错误码，供各端生成类型 |

Cocos Creator 官方提供微信小游戏构建发布流程；pnpm Workspace 用于在一个仓库中管理多项目。Node.js 使用受支持的 LTS 版本。正式初始化时固定具体补丁版本并记录在版本文件中。

## 仓库结构

```text
apps/
  game-client/       # Cocos Creator 项目，由 Creator 编辑器初始化
  admin-web/         # React + Vite 管理端
  api-server/        # NestJS 服务端
packages/
  api-contracts/     # OpenAPI 与生成的 API 类型
database/
  migrations/        # 数据库迁移
  seeds/             # 固定 NPC、摊位和货品初始配置
```

## 依赖和安全边界

- `admin-web`、`api-server`、`api-contracts` 使用 pnpm Workspace；Cocos Creator 项目由编辑器维护自身依赖和构建配置。
- 玩家端与管理端通过 HTTPS API 通信；管理端不直接连接 PostgreSQL。
- `api-contracts` 只包含接口传输结构，不包含数据库实体、业务规则或隐藏货品配置。
- 真伪、估值、专家证据和完整货品配置仅保存在服务端；管理 API 通过角色权限控制访问。
- 微信登录密钥、支付凭证、数据库密码和其他秘密只注入服务端运行环境，不进入代码仓库或客户端包。

## 数据与发布

- NPC、摊位和固定货架配置通过版本化 seed/配置导入，执行 JSON Schema 和业务校验。
- 每个摊位固定关联 10 件货品；不生成随机市场快照。
- 货品设置 `max_purchases_per_user` 累计限购；真古董上限为一次。
- 已购买货品绑定 `product_config_version`，后续配置发布不改写历史持有实例。
- 前后端分别构建部署；PostgreSQL 结构变更通过 Prisma migration 管理。
