const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../backend/server');

test('missing mission endpoint returns guidance to create a new mission', async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/missions/stale-mission-id`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.match(body.error, /start a new mission/i);
});
