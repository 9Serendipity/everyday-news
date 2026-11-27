import { collect, sources } from "./sources.mjs";

const origin = "https://9serendipity.github.io";
const cors = { "Access-Control-Allow-Origin": origin };

export default {
  async fetch(request, _env, context) {
    const url = new URL(request.url);
    if (url.pathname !== "/latest") return new Response(null, { status: 404 });
    if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET", ...cors } });

    const cache = globalThis.caches?.default;
    const cacheKey = new Request(new URL("/latest", url));
    const cached = await cache?.match(cacheKey).catch(() => undefined);
    if (cached) return cached;

    const checkedAt = new Date().toISOString();
    const results = await Promise.allSettled(sources.map(collect));
    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") console.warn(sources[index].id + " 查询失败", result.reason?.message);
    }
    const sourceStates = sources.map(({ id }, index) => ({
      id, status: results[index].status === "fulfilled" ? "ok" : "error", checkedAt
    }));
    const items = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
    const allSourcesAvailable = sourceStates.every(source => source.status === "ok");
    const response = Response.json({ checkedAt, sources: sourceStates, items }, {
      status: items.length > 0 ? 200 : 503,
      headers: {
        ...cors,
        "Cache-Control": allSourcesAvailable ? "public, max-age=60" : "no-store"
      }
    });
    if (cache && allSourcesAvailable) context.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
    return response;
  }
};
