const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const handler = require('../api');

test('Vercel handler initializes demo mode and forwards API requests to Express', async (t) => {
  const previousDatabase = process.env.MYSQL_DATABASE;
  delete process.env.MYSQL_DATABASE;

  const server = createServer(handler);
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => {
      if (previousDatabase === undefined) delete process.env.MYSQL_DATABASE;
      else process.env.MYSQL_DATABASE = previousDatabase;
      if (error) reject(error);
      else resolve();
    });
  }));
  await new Promise((resolve) => server.listen(0, resolve));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: 'ok', storage: 'demo' });
});
