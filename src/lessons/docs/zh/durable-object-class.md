# 自己编写 Durable Object

编辑器中的代码是名为 `App` 的 Durable Object 类。运行后，你的类会作为本站 Durable Object 的子级启动，并调用其 `fetch()`。

## 试一试

1. 原样运行几次。`memory` 和 `sqlite` 会同步增加。
2. 修改注释中的一个字符再运行。代码变化会重建实例，因此 **`memory` 回到 1，而 `sqlite` 继续累加**。

`memory` 是会因退避或代码更新而丢失的内存状态，`sqlite` 是写入 `ctx.storage.sql` 的持久状态。在生产环境中，约 10 秒无访问时 `memory` 同样会消失。

## 工作原理

本站并不是把你的类直接注册为 DO。站点侧的 DO 作为“父级”，通过 `ctx.facets.get()` 把你的类作为 **facet**（子级）加载。facet 拥有与父级分离的 SQLite，所以你的代码无法接触父级的数据。修改代码时，通过 `ctx.facets.abort()` 停止 facet 并重新创建。存储会保留，因此只有 `sqlite` 会接着计数。

网络被阻断，CPU 限制为 100ms。
