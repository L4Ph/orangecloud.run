export default {
  async fetch(request) {
    const report = {
      process: typeof process,
      require: typeof require,
      Deno: typeof Deno,
      Bun: typeof Bun,
      document: typeof document,
      navigator: typeof navigator,
      caches: typeof caches,
      WebSocket: typeof WebSocket,
      TextEncoder: typeof TextEncoder,
      randomUUID: crypto.randomUUID(),
    };

    // ランタイムに存在するグローバル変数を確認 / Inspect globals in this runtime
    console.log("runtime globals:");
    for (const [key, value] of Object.entries(report)) {
      console.log(` ${key} = ${value}`);
    }

    return Response.json(report);
  },
};
