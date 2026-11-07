# 本站的运作方式

前面各章的「运行」按钮背后做了什么。这里全部由 Cloudflare 的功能构成，可以直接搬到自己的服务里。

## 每次运行都创建一个 Worker

本站使用 **Dynamic Workers**。父 Worker 持有 `env.LOADER`（Worker Loader 绑定），在每个请求里组装一个子 Worker。

```ts
const worker = env.LOADER.get(`run-${hash(code)}`, () => ({
  compatibilityDate: '2026-02-24',
  mainModule: 'index.js',
  modules: { 'index.js': wrap(code) },
  env: { KV: kvStub, DB: env.DB },
  globalOutbound: null,
  limits: { cpuMs: 100, subRequests: 0 },
}));

const response = await worker.getEntrypoint().fetch(new Request('https://sandbox.internal/'));
```

- `load()` 每次都是新的；`get(id, callback)` 按 id 复用 isolate
- `globalOutbound: null` 关闭外网；`fetch` 和 `connect` 都会失败
- `limits` 限制 CPU 和子请求，脚本再失控也不会超出单个 Worker 的成本
- `compatibilityDate` / `compatibilityFlags` 与普通 Worker 含义相同

选 isolate 而不是容器，因为启动是毫秒级，适合每个请求丢掉重来。

## 有些绑定能传，有些不能

子 Worker 的 `env` 只能包含可结构化克隆的值和 Service Binding。

| 绑定            | 传递方式                                              |
| --------------- | ----------------------------------------------------- |
| D1              | 直接传（可克隆）                                      |
| Durable Objects | `namespace.get(id)` 的 stub（Service Binding）        |
| KV / R2 / AI    | namespace 本身传不了 → 通过 Durable Object 的方法中继 |

例如 KV：放一个暴露 `get` / `put` / `delete` / `list` 的 Durable Object，把它的 stub 作为 `env.KV` 传进去。调用方代码看起来和真实 namespace 几乎一样。

## Turnstile 只在首次出现

入口处验证 Turnstile，成功后返回签名 Cookie，之后的请求直接放行。令牌是一次性的，所以每次验证都需要新的。

## 费用来自哪里

- Dynamic Workers 按每天创建的唯 Worker 数计费，因此相同代码复用同一个 `get()` id。每月含 1,000 个，超出后每个每天 $0.002
- id 由代码生成，并把换行符和末尾换行归一化，所以直接运行教材代码的人共用同一个 Worker
- CPU 上限 100ms；等待不收费，所以外部 API 调用很便宜
- Workers AI 固定使用便宜的模型，并限制执行次数

## 可以照搬的结构

1. 父 Worker 持有 Worker Loader
2. 把用户代码放进 `modules`，调用 `load()` / `get()`
3. 只通过 Service Binding 传必要的绑定，并收窄权限
4. 关闭外网，或只允许走中继绑定
5. 设置 CPU 与子请求上限

这五条就能搭出安全运行他人代码的地方。
