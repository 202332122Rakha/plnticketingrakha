/**
 * Cloudflare Worker Reverse Proxy for PLN Ticketing
 * 
 * Routes incoming requests:
 * - /api/* -> Proxied to backend Node.js (via BACKEND_ORIGIN / Cloudflare Tunnel / Cloudflare Access)
 * - /*     -> Static assets from Vite build (dist/)
 */

export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
  BACKEND_ORIGIN?: string; // e.g. "https://api-ticketing.domain-anda.com" or tunnel URL
}

export default {
  async fetch(request: Request, env: Env, ctx?: any): Promise<Response> {
    const url = new URL(request.url);

    // 1. Handle Preflight OPTIONS for /api/*
    if (url.pathname.startsWith('/api/') && request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': url.origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Cookie',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 2. Handle API endpoints
    if (url.pathname.startsWith('/api/')) {
      const backendOrigin = (env.BACKEND_ORIGIN || '').replace(/\/$/, '');

      if (!backendOrigin) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Konfigurasi BACKEND_ORIGIN belum diatur pada Cloudflare Worker Secrets/Variables.',
            hint: 'Set BACKEND_ORIGIN via wrangler secret put BACKEND_ORIGIN atau di Dashboard Cloudflare Workers.',
          }),
          {
            status: 502,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          }
        );
      }

      // Proxy request to backend
      const targetUrl = new URL(url.pathname + url.search, backendOrigin);
      
      const newHeaders = new Headers(request.headers);
      newHeaders.set('X-Forwarded-Host', url.host);
      newHeaders.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
      newHeaders.set('Host', targetUrl.host);

      try {
        const response = await fetch(targetUrl.toString(), {
          method: request.method,
          headers: newHeaders,
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
          redirect: 'manual',
        });

        // Copy response headers and preserve cookies
        const responseHeaders = new Headers(response.headers);
        // Ensure same-origin browser context receives cookies properly
        responseHeaders.set('Cache-Control', 'no-store');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Gagal menghubungi backend API PLN Ticketing.',
            error: err?.message || 'Upstream connection failed',
          }),
          {
            status: 502,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          }
        );
      }
    }

    // 3. Static assets served by Cloudflare Workers Assets
    return env.ASSETS.fetch(request);
  },
};
