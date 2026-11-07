import { Hono } from 'hono';
import { logger } from 'hono/logger';

const app = new Hono();

app.use(logger());

app.get('/hello/:name', (c) => {
  const name = c.req.param('name');
  return c.json({ message: `Hello, ${name}!` });
});

app.post('/echo', async (c) => {
  const body = await c.req.json();
  return c.json(body, 201);
});

export default app;
