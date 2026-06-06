/**
 * Cloudflare Worker — ServiceM8 CORS proxy for Raven Self Booking portal
 *
 * Deploy steps:
 *  1. Go to https://dash.cloudflare.com → Workers & Pages → Create
 *  2. Click "Create Worker", paste this entire file, click "Deploy"
 *  3. Copy the worker URL (e.g. https://raven-sm8-proxy.yourname.workers.dev)
 *  4. Paste it into raven-booking.html as the PROXY_BASE value
 *
 * The worker forwards GET and PUT requests to ServiceM8, adding the API key
 * server-side so it is never exposed in the browser.
 */

const SM8_API_KEY = 'smk-a4a27e-d2c088ea47457368-438e36ebabe69a2a';
const SM8_BASE    = 'https://api.servicem8.com/api_1.0';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url  = new URL(request.url);
    // Strip the worker path prefix and forward the rest to ServiceM8
    const sm8Path = url.pathname + url.search;
    const sm8Url  = SM8_BASE + sm8Path;

    const init = {
      method:  request.method,
      headers: {
        'X-API-Key':    SM8_API_KEY,
        'Accept':       'application/json',
        'Content-Type': 'application/json',
      },
    };

    if (request.method === 'PUT') {
      init.body = await request.text();
    }

    try {
      const sm8Res  = await fetch(sm8Url, init);
      const body    = await sm8Res.text();
      return new Response(body, {
        status:  sm8Res.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status:  502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  },
};
