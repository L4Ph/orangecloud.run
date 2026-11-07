# Hono

Frameworks like Express, which supported the early days of Node.js, were heavily dependent on Node.js's `net.Socket` and `http.IncomingMessage`. What Workers hands over is the web-standard `Request` / `Response`. Express can run there too, using the Node.js compatibility APIs (`nodejs_compat`, enabled by default for compatibility dates of 2026-08-04 or later) and `httpServerHandler` from `cloudflare:node` (there is an official tutorial), but it depends on the Node.js compatibility layer.

Hono is a **web framework designed exclusively around `Request` and `Response` objects**—features built into browsers and edge runtimes. The same code runs on Cloudflare Workers, Deno, Bun, and others. Hono was not designed for Node.js at first, but with the Node.js adapter (`@hono/node-server`), it can run on Node.js as well. Hono itself has zero dependencies, and the `hono/tiny` preset is under 12kB.

## Minimal Configuration

```ts
import { Hono } from "hono";

const app = new Hono();

// Route definition
app.get("/", (c) => c.text("hello from hono"));

// Can be exposed as-is as a Cloudflare Workers entry point
export default app;
```

## Path Routing and Parameter Extraction

```ts
app.get("/users/:id", (c) => c.json({ userId: c.req.param("id") }));
app.get("/static/*", (c) => c.text(c.req.path));
app.post("/items", (c) => c.text("created", 201));

// Module binding for sub-routers
app.route("/api/v1", apiRoutes);
```

- Supports path parameter extraction via `:param` and wildcard catching with `*`.
- Handlers and middleware that match the same path run in the order they were registered. Processing stops at the handler that returns a `Response`, so write special paths such as `/users/me` before `/users/:id`, and a fallback `*` last.

## Input/Output Operations via Context

The `c` argument (Context) is used to read the request and build the response. Input gets a type only when it passes through a validator such as `hono/validator`, and `c.req.json()` returns `any` in Hono v4.

```ts
// Extract request information
const authHeader = c.req.header("authorization");
const queryPage = c.req.query("page");
const bodyJson = await c.req.json();

// Send response
return c.json({ status: "ok", data: bodyJson }, 201);
```

Since it merely thinly wraps native `Request` / `Response` internally, it is also possible to extract raw web-standard objects directly from `c.req.raw`.

## Middleware Pipeline Integration

```ts
// Global execution timing middleware. On a deployed Worker, performance.now() only advances after I/O
app.use("*", async (c, next) => {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  c.header("server-timing", `total;dur=${duration.toFixed(2)}`);
});

// Early-exit example (only checks that the header exists; use hono/bearer-auth or similar for authentication)
app.use("/admin/*", async (c, next) => {
  if (!c.req.header("authorization")) {
    return c.text("unauthorized", 401);
  }
  await next();
});
```

By inserting `await next()`, preprocessing on request reception and postprocessing on response return can be naturally expressed within a single function. Early return when conditions are not met acts as a safety valve, terminating the process without triggering downstream handlers.

## Type-Safe RPC (Remote Procedure Call)

In Hono, the type of the client-side RPC client can be derived automatically from the server-side route definition.

```ts
// Server side (exposing route type definition)
const api = new Hono().get("/posts/:id", (c) => c.json({ id: c.req.param("id"), title: "Demo" }));
export type AppType = typeof api;

// Client side (call with type completion, writing no URL string other than the base URL)
import { hc } from "hono/client";
const client = hc<AppType>("https://example.com");
const response = await client.posts[":id"].$get({ param: { id: "42" } });
const data = await response.json(); // Inferred as { id: string, title: string }
```
