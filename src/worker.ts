/**
 * Cloudflare Worker for PLN Ticketing
 * 
 * Standalone Mode:
 * - If BACKEND_ORIGIN is set: Proxies /api/* to the specified backend URL
 * - If BACKEND_ORIGIN is empty: Serves full mock API directly inside Cloudflare Workers
 *   (No PostgreSQL, no backend server needed! Login, Units, Tickets all work instantly)
 * - /*: Serves static assets from dist/
 */

import { handleMockApi } from './mockApiHandler';

export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
  BACKEND_ORIGIN?: string;
}

export default {
  async fetch(request: Request, env: Env, _ctx?: any): Promise<Response> {
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

    // 2. Handle /api/* endpoints
    if (url.pathname.startsWith('/api/')) {
      const backendOrigin = (env.BACKEND_ORIGIN || '').replace(/\/$/, '');

      // Jika ada BACKEND_ORIGIN, teruskan ke server backend
      if (backendOrigin) {
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
          const responseHeaders = new Headers(response.headers);
          responseHeaders.set('Cache-Control', 'no-store');
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
          });
        } catch {
          // Fallback to standalone mode if backend unreachable
        }
      }

      // Mode Standalone: Eksekusi API langsung di dalam Worker (Tanpa Backend/DB)
      let parsedBody: any = null;
      if (!['GET', 'HEAD'].includes(request.method)) {
        try {
          parsedBody = await request.clone().json();
        } catch {
          parsedBody = null;
        }
      }

      const mockResponse = handleMockApi(url.pathname, request.method, parsedBody);
      if (mockResponse) {
        return mockResponse;
      }

      return new Response(
        JSON.stringify({ success: false, message: 'Endpoint tidak ditemukan.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Static assets served by Cloudflare Workers Assets
    return env.ASSETS.fetch(request);
  },
};
