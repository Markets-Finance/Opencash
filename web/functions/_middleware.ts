interface MiddlewareEnv {
  ASSETS: { fetch: (input: Request | URL | string) => Promise<Response> };
  KILL_SWITCH?: string;
  BACKEND_URL?: string;
}

const open = [/^\/$/, /^\/index\.html$/, /^\/404(\.html)?$/, /^\/_astro\//, /^\/fonts\//, /^\/images\//, /^\/favicon\.svg$/, /^\/waitlist$/, /^\/\.well-known\//];
const ttlMs = 15_000;
let cached: { at: number; on: boolean } | null = null;

async function switchedOn(env: MiddlewareEnv): Promise<boolean> {
  if (env.KILL_SWITCH === "on") return true;
  if (!env.BACKEND_URL) return false;
  if (cached && Date.now() - cached.at < ttlMs) return cached.on;
  let on = false;
  try {
    const response = await fetch(`${env.BACKEND_URL}/health`);
    on = response.ok && ((await response.json()) as { killed?: boolean }).killed === true;
  } catch {
    on = false;
  }
  cached = { at: Date.now(), on };
  return on;
}

export async function onRequest(context: { request: Request; env: MiddlewareEnv; next: () => Promise<Response> }): Promise<Response> {
  const url = new URL(context.request.url);
  const path = url.pathname;
  if (path === "/" && /^(bot|analytics)\./.test(url.hostname)) return Response.redirect(`${url.origin}/dashboard/`, 302);
  if (open.some((pattern) => pattern.test(path)) || !(await switchedOn(context.env))) return context.next();
  const page = await context.env.ASSETS.fetch(new URL("/404.html", context.request.url));
  return new Response(page.body, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
