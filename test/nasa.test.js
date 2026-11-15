const test = require('node:test');
const assert = require('node:assert/strict');
const nasa = require('../backend/services/nasa');

async function withNASA(key, fetchImplementation, run) {
  const previousKey = process.env.NASA_API_KEY;
  const previousFetch = global.fetch;
  const previousWarn = console.warn;
  const logs = [];

  nasa.clearCache();
  if (key === null) delete process.env.NASA_API_KEY;
  else process.env.NASA_API_KEY = key;
  global.fetch = fetchImplementation;
  console.warn = (...args) => logs.push(args.join(' '));
  try {
    await run(logs);
  } finally {
    if (previousKey === undefined) delete process.env.NASA_API_KEY;
    else process.env.NASA_API_KEY = previousKey;
    global.fetch = previousFetch;
    console.warn = previousWarn;
    nasa.clearCache();
  }
}

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  };
}

test('valid APOD and DONKI responses are labeled live without returning or logging the API key', async () => {
  const testKey = 'test-key-not-real';
  const urls = [];
  await withNASA(testKey, async (url) => {
    urls.push(new URL(url));
    if (url.includes('/planetary/apod')) {
      return response(200, {
        title: 'Test APOD',
        explanation: 'A test image description.',
        media_type: 'image',
        url: 'https://images.example.test/apod.jpg',
        date: '2026-11-14'
      });
    }
    return response(200, [{ startTime: '2026-11-14T00:00Z', note: 'Test event.' }]);
  }, async (logs) => {
    const [apod, apodAgain] = await Promise.all([nasa.getApod(), nasa.getApod()]);
    const weather = await nasa.getSpaceWeather();
    const returnedData = JSON.stringify({ apod, weather });

    assert.equal(apod.status, 'live');
    assert.equal(apod.title, 'Test APOD');
    assert.deepEqual(apodAgain, apod);
    assert.equal(weather.status, 'live');
    assert.equal(weather.events[0].note, 'Test event.');
    assert.equal(urls.length, 2);
    assert.ok(urls.every((url) => url.hostname === 'api.nasa.gov'));
    assert.ok(urls.every((url) => url.searchParams.get('api_key') === testKey));
    assert.equal(returnedData.includes(testKey), false);
    assert.equal(logs.join(' ').includes(testKey), false);
  });
});

test('invalid keys, NASA limits, and network failures return labeled sample data safely', async () => {
  const testKey = 'test-key-not-real';
  let call = 0;
  await withNASA(testKey, async () => {
    call += 1;
    if (call === 1) return response(403, { error: { message: 'invalid test key' } });
    if (call === 2) return response(429, { error: { message: 'limited' } });
    throw new TypeError(`network error for api_key=${testKey}`);
  }, async (logs) => {
    const invalidKey = await nasa.getApod();
    nasa.clearCache();
    const limited = await nasa.getSpaceWeather();
    nasa.clearCache();
    const offline = await nasa.getApod();
    const output = JSON.stringify({ invalidKey, limited, offline, logs });

    assert.equal(invalidKey.status, 'sample');
    assert.match(invalidKey.error, /did not accept the API key/);
    assert.match(invalidKey.source, /SAMPLE DATA/);
    assert.doesNotMatch(invalidKey.explanation, /API key is not configured/);
    assert.equal(limited.status, 'sample');
    assert.match(limited.error, /request limit/);
    assert.match(limited.source, /SAMPLE DATA/);
    assert.equal(offline.status, 'sample');
    assert.match(offline.error, /could not be loaded/);
    assert.equal(output.includes(testKey), false);
  });
});

test('NASA proxy coalesces concurrent requests and briefly caches sample fallbacks', async () => {
  let fetchCalls = 0;
  await withNASA('test-key-not-real', async () => {
    fetchCalls += 1;
    return response(503, { error: { message: 'unavailable' } });
  }, async () => {
    const [first, concurrent] = await Promise.all([nasa.getApod(), nasa.getApod()]);
    const cached = await nasa.getApod();
    assert.equal(first.status, 'sample');
    assert.deepEqual(concurrent, first);
    assert.deepEqual(cached, first);
    assert.equal(fetchCalls, 1);
  });
});

test('missing configuration and malformed NASA payloads never claim live data', async () => {
  let fetchCalls = 0;
  await withNASA(null, async () => {
    fetchCalls += 1;
    return response(200, { error: { message: 'unexpected' } });
  }, async () => {
    assert.equal((await nasa.getApod()).status, 'sample');
    assert.equal((await nasa.getSpaceWeather()).status, 'sample');
    assert.equal(fetchCalls, 0);
  });

  await withNASA('test-key-not-real', async () => response(200, { error: { message: 'invalid payload' } }), async () => {
    assert.equal((await nasa.getApod()).status, 'sample');
    assert.equal((await nasa.getSpaceWeather()).status, 'sample');
  });
});

test('APOD and DONKI timeouts use bounded abortable requests and labeled fallbacks', async () => {
  const requestedUrls = [];
  await withNASA('test-key-not-real', async (url, options) => {
    requestedUrls.push(new URL(url));
    assert.ok(options.signal instanceof AbortSignal);
    throw new DOMException('Request timed out.', 'TimeoutError');
  }, async () => {
    const apod = await nasa.getApod();
    const weather = await nasa.getSpaceWeather();

    assert.equal(apod.status, 'sample');
    assert.match(apod.error, /too long to respond/);
    assert.equal(weather.status, 'sample');
    assert.match(weather.error, /too long to respond/);
    assert.equal(requestedUrls.length, 2);
    assert.ok(requestedUrls.some((url) => url.pathname === '/planetary/apod'));
    assert.ok(requestedUrls.some((url) => url.pathname === '/DONKI/CME'));
    assert.ok(requestedUrls.every((url) => url.searchParams.has('api_key')));
    assert.equal(JSON.stringify({ apod, weather }).includes('test-key-not-real'), false);
  });
});
