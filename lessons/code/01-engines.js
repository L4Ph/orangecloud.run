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

    console.log('このランタイムの中身:');
    for (const [key, value] of Object.entries(report)) {
      console.log(` ${key} = ${value}`);
    }

    return Response.json(report);
  },
};
