const sampleApod = {
  title: 'A view beyond our home',
  explanation: 'This is sample content, not a live NASA image. NASA APOD data is unavailable right now.',
  url: null,
  date: null,
  media_type: 'sample',
  source: 'SAMPLE DATA — not a live NASA image'
};

const sampleEvents = [
  { eventType: 'Sample solar activity', eventDate: 'Not a live event', note: 'Sample only—not a live NASA event. NASA DONKI data is unavailable right now.' }
];

const NASA_REQUEST_TIMEOUT_MS = 10_000;
const APOD_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DONKI_CACHE_TTL_MS = 15 * 60 * 1000;
const FALLBACK_CACHE_TTL_MS = 60 * 1000;
const responseCache = new Map();
const inFlightRequests = new Map();

function failureMessage(error) {
  if (error.status === 401 || error.status === 403) {
    return 'NASA did not accept the API key. Check the server .env configuration.';
  }
  if (error.status === 429) {
    return 'NASA request limit reached. Please try again later.';
  }
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return 'NASA took too long to respond. Showing clearly labeled sample data.';
  }
  return 'NASA data could not be loaded. Showing clearly labeled sample data.';
}

function logFailure(service, error) {
  const reason = Number.isInteger(error.status)
    ? `HTTP ${error.status}`
    : error.name === 'TimeoutError' || error.name === 'AbortError'
      ? 'timeout'
      : 'network or invalid response';
  console.warn(`${service} unavailable (${reason}); using sample data.`);
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(NASA_REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    const error = new Error('NASA returned an unsuccessful response.');
    error.status = response.status;
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('NASA returned an invalid response.');
  }
  if (data && !Array.isArray(data) && typeof data === 'object' && data.error) {
    throw new Error('NASA returned an error payload.');
  }
  return data;
}

async function fetchApod() {
  const key = process.env.NASA_API_KEY;
  if (!key) return { ...sampleApod, status: 'sample' };
  try {
    const query = new URLSearchParams({ api_key: key });
    const data = await fetchJson(`https://api.nasa.gov/planetary/apod?${query}`);
    if (!data || typeof data.title !== 'string' || !['image', 'video'].includes(data.media_type)) {
      throw new Error('NASA returned incomplete APOD data.');
    }
    if (data.media_type === 'image' && typeof data.url !== 'string') {
      throw new Error('NASA returned an image without a URL.');
    }
    return {
      title: data.title,
      explanation: typeof data.explanation === 'string' ? data.explanation : '',
      url: data.media_type === 'image' ? data.url : null,
      date: typeof data.date === 'string' ? data.date : null,
      media_type: data.media_type,
      source: 'NASA Astronomy Picture of the Day (APOD)',
      status: 'live'
    };
  } catch (error) {
    logFailure('NASA APOD', error);
    return { ...sampleApod, status: 'sample', error: failureMessage(error) };
  }
}

async function fetchSpaceWeather() {
  const key = process.env.NASA_API_KEY;
  if (!key) return { events: sampleEvents, status: 'sample', source: 'NASA DONKI — SAMPLE DATA, not live' };
  try {
    const params = new URLSearchParams({
      startDate: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      api_key: key
    });
    const data = await fetchJson(`https://api.nasa.gov/DONKI/CME?${params}`);
    if (!Array.isArray(data)) throw new Error('NASA returned incomplete DONKI data.');
    return {
      events: data.slice(0, 6).map((event) => ({
        eventType: 'Coronal mass ejection',
        eventDate: typeof event.startTime === 'string' ? event.startTime : 'Date unavailable',
        note: typeof event.note === 'string' ? event.note : 'A cloud of solar material was observed.',
        link: Array.isArray(event.linkedEvents) && typeof event.linkedEvents[0]?.activityID === 'string'
          ? event.linkedEvents[0].activityID
          : null
      })),
      status: 'live',
      source: 'NASA DONKI CME API'
    };
  } catch (error) {
    logFailure('NASA DONKI', error);
    return {
      events: sampleEvents,
      status: 'sample',
      source: 'NASA DONKI — SAMPLE DATA, not live',
      error: failureMessage(error)
    };
  }
}

async function cachedResponse(name, ttl, load) {
  const cached = responseCache.get(name);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (inFlightRequests.has(name)) return inFlightRequests.get(name);

  const request = (async () => {
    try {
      const value = await load();
      const cacheTime = value.status === 'live' ? ttl : FALLBACK_CACHE_TTL_MS;
      responseCache.set(name, { value, expiresAt: Date.now() + cacheTime });
      return value;
    } finally {
      inFlightRequests.delete(name);
    }
  })();
  inFlightRequests.set(name, request);
  return request;
}

function getApod() {
  return cachedResponse('apod', APOD_CACHE_TTL_MS, fetchApod);
}

function getSpaceWeather() {
  return cachedResponse('donki-cme', DONKI_CACHE_TTL_MS, fetchSpaceWeather);
}

function clearCache() {
  responseCache.clear();
  inFlightRequests.clear();
}

module.exports = { getApod, getSpaceWeather, clearCache };
