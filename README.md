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

两种方式任选其一：纯网页点击（推荐新手），或命令行。

### 方式一：Cloudflare 控制台点击部署（不用命令行）

> 全程只有一处需要改文件：把 D1 的 Database ID 填进 `wrangler.toml`（第 5 步）。
> 不想改文件的话，把 `wrangler.toml` 里的 `[[d1_databases]]` 与 `[[r2_buckets]]` 两段删掉，
> 完全依赖控制台里加的绑定即可。

**1) 建 R2 桶（存图片）**

1. 登录 https://dash.cloudflare.com
2. 左侧 **R2 对象存储 / R2 Object Storage**
3. 首次使用需点 **Enable R2** 开通（需绑支付方式，免费额度 10GB/月）
4. **Create bucket** → 名称填 `imagehub` → 位置 **Automatic** → 创建

**2) 建 D1 数据库（存用户与图片记录）**

1. 左侧 **Workers & Pages → D1 SQL Database**
2. **Create database** → 名称填 `imagehub`
3. 创建后记下详情页的 **Database ID**（形如 `a1b2c3d4-...`），第 5 步要用

**3) 立刻建表**

1. 在该 D1 数据库页切换到 **Console** 标签
2. **先点一下 SQL 输入框**（确认光标在里面），再另开一页打开
   `https://raw.githubusercontent.com/YsSZ-INK/ImageHub-Workers/main/docs/d1-console-init.sql`
   （这是去掉注释的纯语句版，避免控制台把注释当成「没有 SQL」）
3. 全选复制，粘贴到 Console，点 **Execute**
4. 切到 **Tables** 标签，确认出现 `users` 与 `images` 两张表

若控制台提示 `No SQL statements detected.`，说明内容没进输入框：改成一条一条执行
（先 `CREATE TABLE users`，再索引，再 `CREATE TABLE images`，最后两个索引）。

**4) 把仓库连到 Workers（自动构建）**

1. 左侧 **Workers & Pages → Overview → Create**
2. 选 **Workers** 标签 → **Connect to Git / Import a repository**
   （首次使用需先授权 GitHub，选中 `YsSZ-INK/ImageHub-Workers`）
3. 构建配置：
   - Build command：`npm install`
   - Deploy command：`npx wrangler deploy`
   - 分支：`main`
4. **Deploy**，等 1–3 分钟

**5) 填数据库 ID（唯一需要改文件的地方）**

在 GitHub 网页上直接改：

1. 打开 https://github.com/YsSZ-INK/ImageHub-Workers/blob/main/wrangler.toml
2. 点右上角 **铅笔图标** 编辑
3. 把 `database_id = "00000000-0000-0000-0000-000000000000"` 换成第 2 步记下的真实 ID
4. **Commit changes** → 会自动触发重新构建部署

**6) 加环境变量与密钥**

Worker → **Settings → Variables and Secrets**，逐项 **Add**：

| 名称 | 值 | 类型 |
| --- | --- | --- |
| `SITE_NAME` | 你的站点名 | Text |
| `MAX_UPLOAD_MB` | `20` | Text |
| `ALLOW_REGISTER` | `false` | Text |
| `PUBLIC_R2_BASE` | 留空（或填 R2 自定义域） | Text |
| `AUTH_SECRET` | 32 位以上随机串 | **Secret** |

`AUTH_SECRET` 必须设置，否则登录接口会直接报错。

**7) 加两个绑定**

Worker → **Settings → Bindings**：

- **Add → D1 database**：Variable name 填 `DB`，Database 选 `imagehub`
- **Add → R2 bucket**：Variable name 填 `BUCKET`，Bucket 选 `imagehub`

变量名必须与上面完全一致。

**8) 生效并注册站长**

1. 回到 **Deployments**，对最新一次部署点 **⋯ → Retry deployment**
2. 打开 Worker 地址（形如 `https://imagehub-lite.xxx.workers.dev`）
3. 展开「没有账号？注册一个」，**第一个账号自动成为管理员**
4. 之后 `ALLOW_REGISTER=false` 会拒掉其他注册，所以请尽快完成

**验证**：访问 `/api/health` 应返回 `{"ok":true,...}`；登录后上传一张图，公共画廊应出现卡片。

### 方式二：命令行部署

```bash
npx wrangler login
npm run db:create                   # 记下返回的 database_id，填进 wrangler.toml
npm run r2:create                   # 创建 R2 桶（名字与 wrangler.toml 一致）
npx wrangler secret put AUTH_SECRET # 粘贴随机密钥（openssl rand -base64 32）
npm run db:migrate                  # 对线上 D1 执行迁移
npm run deploy
```

部署前可用 `npm run dry-run` 只打包校验、不真正发布。

### 部署常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `Authentication error` | 未登录或 token 失效，重跑 `npx wrangler login` |
| `D1_ERROR: no such table: users` | 没执行建表 SQL，或 `database_id` 没改 |
| 控制台报 `No SQL statements detected.` | 内容没进输入框：先点进 SQL 框再粘贴；或改用 `docs/d1-console-init.sql` 逐条执行 |
| 页面能开但注册/登录 500 | `AUTH_SECRET` 未设置 |
| 上传报 `DB is not defined` / `BUCKET is not defined` | 绑定变量名不是 `DB` / `BUCKET` |
| `R2 bucket not found` | `wrangler.toml` 的 `bucket_name` 与实际桶名不一致 |
| 构建在 `npm install` 卡住 | 把 Build command 留空，只填 `npx wrangler deploy` |
| `wrangler` 连不上网 | 本机代理干扰，先清掉 `HTTPS_PROXY` 环境变量再执行 |

### 可选：图片直连 R2 自定义域

1. R2 → 你的桶 → **Settings → Public access** → 绑定一个在 Cloudflare 上的域名
2. 把该域名填到 `PUBLIC_R2_BASE`（如 `https://img.example.com`）
3. 重新部署

之后匿名访问公开图会 302 到 `https://img.example.com/u/<userId>/<imageId>`，图片字节不再经过 Worker；
私有图仍走 Worker 鉴权，不受影响。

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
