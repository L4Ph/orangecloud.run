# 部署上线

本地跑通后，最后一步是发布到你自己的账号。

## 步骤

```sh
# 1. 登录 Cloudflare（会打开浏览器）
npx void cloudflare login

# 2. 登记生产环境密钥（.env 不会被上传）
npx void secret put MY_API_KEY

# 3. 部署（首次会选账号与资源）
npx void deploy --platform cloudflare
```

首次部署会自动创建 D1 等资源，并记录到 `void.lock.json`。**请提交这个文件**，里面是迁移历史。

## 部署前检查

- [ ] 密钥来自 `env.ts` 的 schema 加 `void secret put`，不写死在代码里
- [ ] `env.DB` 等绑定名在生产环境一致
- [ ] 没有死循环（CPU 限制会杀掉它，但期间的请求会失败）
- [ ] 没有返回异常大的响应
- [ ] 能看懂账单（看仪表盘的 Usage）

## 公开之后

- 绑定自定义域名（Workers Custom Domain）
- 看日志（`cf` CLI 或仪表盘，相当于 `wrangler tail`）
- 访问量上来后加缓存（Cache API / 静态资源）

## 本站的构成

本站运行在 **Void（Vite+）+ Cloudflare Workers** 上。左侧编辑器里的代码，会在每个请求中由 **Dynamic Workers**（运行时创建一个 Worker）执行，并且网络被封锁，所以写坏了也不会有事。

- 执行入口：`env.LOADER`（Worker Loader 绑定）
- 每次执行的限制：CPU 100ms、禁止对外通信
- KV / R2 / AI 通过 Durable Object 中转（无法直接交给 isolate）
- D1 与 Durable Objects 传入真实绑定
