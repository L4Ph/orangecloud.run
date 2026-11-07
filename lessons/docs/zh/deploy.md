# 部署上线

本地跑通后，发布到你的 Cloudflare 账号。本章使用官方 CLI Wrangler。

## 步骤

```sh
# 1. 登录（会打开浏览器）
npx wrangler login

# 2. 本地确认
npx wrangler dev

# 3. 部署
npx wrangler deploy
```

新项目可以用 `npm create cloudflare@latest` 从模板开始。

## 密钥与资源

```sh
# API 密钥不要写进代码，放到 Worker 的密钥里
npx wrangler secret put API_KEY

# D1 数据库
npx wrangler d1 create my-db
npx wrangler d1 migrations apply my-db --remote

# KV / R2 / Queue 同样用 create 创建，再在 wrangler.jsonc 里绑定
```

绑定写在 `wrangler.jsonc`。本地由 Miniflare 读取同一份配置，所以代码里用 `env.DB` 等，和生产一致。

## 部署前检查

- [ ] 密钥用 `wrangler secret put`，不要写进代码或 `vars`
- [ ] 绑定名在生产也一致（`wrangler.jsonc`）
- [ ] 没有死循环（CPU 限制会杀掉它，但期间的请求会失败）
- [ ] 没有返回异常大的响应
- [ ] 能看懂账单（仪表盘的 Usage）

## 公开之后

- 绑定自定义域名（Workers Custom Domain）
- 看日志：`npx wrangler tail`
- 访问量上来后加缓存（Cache API / 静态资源）

## 本站的构成

本站运行在 Cloudflare Workers 上。左侧编辑器里的代码，会在每个请求中由 **Dynamic Workers**（运行时创建一个 Worker）执行，并且网络被封锁，所以写坏了也不会有事。

- 执行入口：Worker Loader 绑定
- 每次执行的限制：CPU 100ms、禁止对外通信
- KV / R2 / AI 通过 Durable Object 中转；D1 与 Durable Objects 是真实绑定
