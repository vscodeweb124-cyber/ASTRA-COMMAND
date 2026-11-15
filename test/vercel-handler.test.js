const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');

function freshHandler() {
  delete require.cache[require.resolve('../api')];
  return require('../api');
}

async function startHandler(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, resolve));
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}`
  };
}

test('Vercel handler restores API routes, serves assets, and falls back when MySQL is unavailable', async (t) => {
  const environmentNames = [
    'MYSQL_DATABASE',
    'MYSQL_HOST',
    'MYSQL_PORT',
    'MYSQL_USER',
    'MYSQL_PASSWORD',
    'NASA_API_KEY'
  ];
  const previousEnvironment = new Map(environmentNames.map((name) => [name, process.env[name]]));
  for (const name of environmentNames) process.env[name] = '';
  t.after(() => {
    for (const [name, value] of previousEnvironment) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  const demo = await startHandler(freshHandler());
  t.after(() => new Promise((resolve, reject) => {
    demo.server.close((error) => error ? reject(error) : resolve());
  }));

  const health = await fetch(`${demo.url}/api?vercelRoute=health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', storage: 'demo' });

  const scenarios = await fetch(`${demo.url}/api?vercelRoute=missions%2Fscenarios&destination=mars`);
  assert.equal(scenarios.status, 200);
  assert.ok((await scenarios.json()).scenarios.length > 0);

  const mission = await fetch(`${demo.url}/api?vercelRoute=missions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ playerName: 'Test Pilot', destination: 'moon' })
  });
  assert.equal(mission.status, 201);

  const apod = await fetch(`${demo.url}/api?vercelRoute=nasa%2Fapod`);
  assert.equal(apod.status, 200);
  assert.equal((await apod.json()).status, 'sample');

  const donki = await fetch(`${demo.url}/api?vercelRoute=nasa%2Fdonki`);
  assert.equal(donki.status, 200);
  assert.equal((await donki.json()).status, 'sample');

  for (const asset of ['/', '/styles.css', '/app.js']) {
    const response = await fetch(`${demo.url}${asset}`);
    assert.equal(response.status, 200, `${asset} should be served`);
    assert.ok((await response.text()).length > 0);
  }

  process.env.MYSQL_DATABASE = 'astra_command_test';
  process.env.MYSQL_HOST = '127.0.0.1';
  process.env.MYSQL_PORT = '1';
  process.env.MYSQL_USER = 'test';
  process.env.MYSQL_PASSWORD = 'not-a-real-password';
  const unavailable = await startHandler(freshHandler());
  t.after(() => new Promise((resolve, reject) => {
    unavailable.server.close((error) => error ? reject(error) : resolve());
  }));

  const previousConsoleError = console.error;
  const databaseLogs = [];
  console.error = (...args) => databaseLogs.push(args.join(' '));
  try {
    const response = await fetch(`${unavailable.url}/api?vercelRoute=health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', storage: 'demo' });
  } finally {
    console.error = previousConsoleError;
  }
  assert.match(databaseLogs.join(' '), /continuing in demo mode/);
  assert.doesNotMatch(databaseLogs.join(' '), /not-a-real-password/);
});
