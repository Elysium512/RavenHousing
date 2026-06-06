/**
 * Cloudflare Worker — ServiceM8 CORS proxy for Raven Self Booking portal
 *
 * Routes:
 *   GET /job-coords          → slim {uuid, lat, lng} map of all active jobs this year
 *   GET /job.json?...        → proxied to ServiceM8
 *   GET /jobactivity.json?.. → proxied to ServiceM8
 *   PUT /job/<uuid>.json     → proxied to ServiceM8
 */

const SM8_API_KEY = 'smk-a4a27e-d2c088ea47457368-438e36ebabe69a2a';
const SM8_BASE    = 'https://api.servicem8.com/api_1.0';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function sm8Fetch(path) {
  const res = await fetch(SM8_BASE + path, {
    headers: { 'X-API-Key': SM8_API_KEY, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`SM8 ${res.status}`);
  return res.json();
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    // ── Special route: lightweight job coordinates map ──────────────────────
    if (url.pathname === '/job-coords') {
      try {
        const thisYear = new Date().getFullYear();
        const jobs = await sm8Fetch(
          `/job.json?%24filter=active+eq+1+and+date+gt+%27${thisYear}-01-01%27`
        );
        const slim = {};
        for (const j of jobs) {
          if (j.geo_is_valid && j.lat && j.lng) {
            slim[j.uuid] = { lat: parseFloat(j.lat), lng: parseFloat(j.lng) };
          }
        }
        return new Response(JSON.stringify(slim), {
          headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Generic proxy for all other ServiceM8 endpoints ─────────────────────
    const sm8Path = url.pathname + url.search;
    const init = {
      method:  request.method,
      headers: { 'X-API-Key': SM8_API_KEY, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    };
    if (request.method === 'PUT') init.body = await request.text();

    try {
      const sm8Res = await fetch(SM8_BASE + sm8Path, init);
      const body   = await sm8Res.text();
      return new Response(body, {
        status:  sm8Res.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  },
};
