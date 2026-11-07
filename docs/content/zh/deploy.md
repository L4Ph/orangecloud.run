# 边缘部署与运维

将在本地模拟器（Miniflare）中确认可运行的代码，部署至全球数百个边缘数据中心。通过 Cloudflare 的官方 CLI **cf**（测试版），将配置文件和构建成果物同步至全球网络。原有的 Wrangler 仍可使用，但新项目以 `cf` 为前提。

## 开发与部署的基本循环

```sh
# 首次认证（启动浏览器并进行账号绑定）
cf auth login

# 通过本地模拟器确认运行情况（快速反馈）
cf dev

# 向边缘网络进行生产部署（通常数秒内传播至全球）
cf deploy
```

新项目用 `cf init my-worker` 创建。它会带有 `cloudflare.config.ts`、类型定义以及 `dev` / `build` / `deploy` 脚本。已有的 Wrangler 项目可用 `cf migrate` 转换为 `cloudflare.config.ts`。

## 机密信息与外部资源的连接

严禁在代码库中直接提交 API 密钥或签名密钥。环境变量中存在“可公开的静态设置（`vars`）”与“应加密存储的机密信息（`secrets`）”之间的明确界限。

```sh
# 注册加密密钥（即使在仪表盘上也会隐藏其值）
npx wrangler secret put STRIPE_API_KEY --name my-worker

# 可以用描述查找创建 D1 的命令
cf cli search "create a D1 database"

# 应用生产环境迁移（cf 接收数据库 ID，默认应用到远程）
cf d1 migrations apply <DATABASE_ID>
```

`cf` 目前还不能逐个设置密钥。暂时请使用 `npx wrangler secret put`，或通过 `cf deploy --secrets-file <PATH>` 一并传入。

各项资源的连接设置以带类型的形式写在项目根目录的 `cloudflare.config.ts` 中（使用 `bindings.d1()` 等构建器）。本地开发时同样读取该定义，因此可以使用与生产环境相同的 `env.DB` 或 `env.KV` 接口继续开发。

## 部署前应验证的边界线

- **密钥隔离**：API 令牌或私钥是否以明文形式残留在配置文件的 `vars` 项或源代码中。
- **绑定名称完全一致**：源代码中引用的 `env` 属性名与配置文件内的 `binding` 定义名是否存在差异。
- **考虑 CPU 限制时间**：外部数据处理或繁重的循环处理是否可能超过方案的时间限制（免费额度 10ms，付费额度 30 秒）从而导致强制终止。
- **通过尾部日志进行监控**：部署后的实际流量行为，需实时查看来自边缘的标准输出日志来确认。`cf` 尚不支持，请使用 `npx wrangler tail <WORKER_NAME>`。
