# mini-program-iditanjianbao

## API 服务开发

首个服务端切片位于 `apps/api-server`，提供带会话 JWT 校验的购买接口和 PostgreSQL/Prisma 数据模型。启动前复制 `apps/api-server/.env.example` 为本地环境文件，设置数据库连接和至少 32 字节的 `SESSION_SIGNING_SECRET`；登录签发与微信凭据兑换尚未接入，因此需要由受信任的会话签发端提供符合 `iditanjianbao-session` issuer 的 bearer token。购买在议价模块上线前仅接受挂牌价。

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm build:api
pnpm dev:api
```
