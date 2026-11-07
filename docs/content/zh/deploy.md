# 边缘部署与运维

将在本地模拟器（Miniflare）中确认可运行的代码，部署至全球数百个边缘数据中心。通过 Cloudflare 的官方 CLI 工具 **Wrangler**，将配置文件和构建成果物瞬间同步至全球规模的网络。

## 开发与部署的基本循环

```sh
# 首次认证（启动浏览器并进行账号绑定）
npx wrangler login

# 通过本地模拟器确认运行情况（快速反馈）
npx wrangler dev

# 向边缘网络进行生产部署（通常数秒内传播至全球）
npx wrangler deploy
```

启动新项目时，使用官方支架 `npm create cloudflare@latest` 即可在 TypeScript 类型定义和推荐设置就绪的状态下开始。

## 机密信息与外部资源的连接

严禁在代码库中直接提交 API 密钥或签名密钥。环境变量中存在“可公开的静态设置（`vars`）”与“应加密存储的机密信息（`secrets`）”之间的明确界限。

```sh
# 注册加密密钥（即使在仪表盘上也会隐藏其值）
npx wrangler secret put STRIPE_API_KEY

# 创建 D1 关系型数据库并应用生产迁移
npx wrangler d1 create my-production-db
npx wrangler d1 migrations apply my-production-db --remote
```

各项资源的连接设置记载在项目根目录的 `wrangler.jsonc`（或 `wrangler.toml`）中。本地开发时 Miniflare 也会解析此定义文件，因此可以使用与生产环境相同的 `env.DB` 或 `env.KV` 接口继续开发。

## 部署前应验证的边界线

- **密钥隔离**：API 令牌或私钥是否以明文形式残留在配置文件的 `vars` 项或源代码中。
- **绑定名称完全一致**：源代码中引用的 `env` 属性名与配置文件内的 `binding` 定义名是否存在差异。
- **考虑 CPU 限制时间**：外部数据处理或繁重的循环处理是否可能超过方案的时间限制（免费额度 10ms，付费额度 30 秒）从而导致强制终止。
- **通过尾部日志进行监控**：部署后的实际流量行为，可通过执行 `npx wrangler tail` 实时监控来自边缘的标准输出日志。
