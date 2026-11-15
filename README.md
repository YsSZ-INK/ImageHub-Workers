# ImageHub Lite · Cloudflare Workers 简化版

从 [YsSZ-INK/ImageHub](https://github.com/YsSZ-INK/ImageHub)（GPL-3.0）衍生而来，**独立代码库**，
面向 Cloudflare Workers + D1 + R2 的单机/无服务器部署。原项目不做任何改动。

## 已实现

- 邮箱密码注册 / 登录 / 退出（WebCrypto PBKDF2，无 Node 依赖）
- 会话 Cookie：HttpOnly + SameSite=Lax，**不带 Max-Age（关闭浏览器即失效）**
- 上传图片到 R2（单张大小上限可配置），公开 / 私有两种可见性
- 公共画廊 + 我的图片，服务端渲染页面（干净、柔和蓝、响应式、少量淡入动效）
- 原图访问鉴权：公开图任何人可看，私有图仅本人 / 管理员
- 公开图可 302 到 R2 自定义域（`PUBLIC_R2_BASE`），图片字节不过 Worker
- 极简 JSON API：`/api/health`、`/api/session`、`/api/images`

## 暂未实现（有意留白）

- 缩略图（建议用 Cloudflare Image Resizing，或上传时 WASM 压缩）
- 限流（建议用 Cloudflare Rate Limiting 绑定或 Durable Object 计数器，不能用 KV 计数）
- 相册、图文动态、评论、邮件找回密码、管理后台 UI
- Postgres → D1 的一次性迁移脚本（见下文迁移思路）

## 目录结构

```
src/
  index.ts     路由与请求处理
  auth.ts      密码哈希、JWT 会话、Cookie 常量
  db.ts        D1 查询（纯 SQL）
  ui.ts        服务端渲染页面与样式
  types.ts     环境绑定与共享类型
migrations/
  0001_init.sql   D1 初始表结构
wrangler.toml     Workers / D1 / R2 绑定
```

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars      # 填一个随机 AUTH_SECRET
npm run db:migrate:local            # 建本地 D1 表
npm run dev                         # http://localhost:8787
```

第一个注册的账号自动成为管理员。默认 `ALLOW_REGISTER=false`：只有站点的第一个账号能注册，
之后想开放注册就把 `wrangler.toml` 里的 `ALLOW_REGISTER` 改为 `"true"`。
（公网部署后建议先立刻注册站长账号，避免就绪到注册之间被陌生人抢注。）

## 线上部署

```bash
npx wrangler login
npm run db:create                   # 记下返回的 database_id，填进 wrangler.toml
npm run r2:create                   # 创建 R2 桶（名字与 wrangler.toml 一致）
npx wrangler secret put AUTH_SECRET # 粘贴随机密钥（openssl rand -base64 32）
npm run db:migrate                  # 对线上 D1 执行迁移
npm run deploy
```

部署前可用 `npm run dry-run` 只打包校验、不真正发布。

## 从完整版迁移数据（思路）

1. 导出 Postgres 的 `User` / `Image` 记录，转成 SQLite 兼容的 `INSERT` 灌入 D1；
   - 完整版密码是 bcrypt，本版是 PBKDF2：可让用户重置密码，或在 `auth.ts` 里加 bcryptjs 校验分支并渐进升级
2. 图片用 `rclone` 把旧存储（本地盘 / R2）同步到新 R2，保持 `r2_key` 与记录一致；
3. 若旧站配置过 R2 公开域名，把同样的前缀填到 `PUBLIC_R2_BASE`。

## 与完整版的取舍

| 能力 | 完整版 | 本简化版 |
| --- | --- | --- |
| 运行时 | Node + Next.js | Workers（Hono） |
| 数据库 | PostgreSQL + Prisma | D1 + 原生 SQL |
| 存储 | 本地磁盘 / R2 | R2 |
| 缩略图 | sharp 多档生成 | 暂不生成（用 Image Resizing 替代） |
| 缓存/限流 | Redis / 进程内存 | 暂用 Cache API（限流待接原生能力） |
| 邮件、审核、相册、迁移 | 有 | 无 |

## 许可

GPL-3.0-only，与上游一致。分发时请保留本文件与上游版权声明。
