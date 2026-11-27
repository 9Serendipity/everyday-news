import { beijingDays, collect, sources } from "./sources.mjs";
import { analyzeWithTicket, prepareAnalyses } from "./article-analysis.mjs";

const origin = "https://9serendipity.github.io";
const cors = { "Access-Control-Allow-Origin": origin };
const archiveUrl = "https://raw.githubusercontent.com/9Serendipity/everyday-news/feed-archive/archive.json";
const apiHeaders = { ...cors, "Cache-Control": "no-store" };

async function latestFeed(url, context) {
  const checkedAt = new Date().toISOString();
  const days = beijingDays(Date.parse(checkedAt));
  const cache = globalThis.caches?.default;
  const cacheUrl = new URL("/latest", url);
  cacheUrl.searchParams.set("from", days[0]);
  const cacheKey = new Request(cacheUrl);
  const cached = await cache?.match(cacheKey).catch(() => undefined);
  if (cached) return cached;

  const results = await Promise.allSettled(sources.map(source => collect(source, days)));
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") console.warn(sources[index].id + " 查询失败", result.reason?.message);
  }
  const sourceStates = sources.map(({ id }, index) => ({
    id, status: results[index].status === "fulfilled" ? "ok" : "error", checkedAt
  }));
  const items = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const allSourcesAvailable = sourceStates.every(source => source.status === "ok");
  const response = Response.json({ checkedAt, sources: sourceStates, items }, {
    status: sourceStates.some(source => source.status === "ok") ? 200 : 503,
    headers: {
      ...cors,
      "Cache-Control": allSourcesAvailable ? "public, max-age=60" : "no-store"
    }
  });
  if (cache && allSourcesAvailable) context.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
  return response;
}

async function analysisTickets(url, db, context) {
  const days = beijingDays();
  const ids = [...new Set((url.searchParams.get("ids") ?? "").split(","))];
  if (ids.length > 50 || !ids.every(id => /^[a-f0-9]{16}$/.test(id))) {
    return Response.json({ error: "invalid article ids" }, { status: 400, headers: apiHeaders });
  }
  const archived = await fetch(archiveUrl, { redirect: "manual", signal: AbortSignal.timeout(8_000) });
  if (!archived.ok) throw new Error("无法读取资讯归档");
  const catalog = new Map((await archived.json()).items
    .filter(item => days.includes(item.day)).map(item => [item.id, item]));
  if (ids.some(id => !catalog.has(id))) {
    const latest = await latestFeed(url, context);
    for (const item of (await latest.json()).items) {
      if (days.includes(item.day) && !catalog.has(item.id)) catalog.set(item.id, item);
    }
  }
  const items = ids.map(id => catalog.get(id)).filter(Boolean);
  const ready = items.filter(item => item.analysis).map(({ id, analysis }) => ({ id, analysis }));
  const pending = items.filter(item => !item.analysis);
  return Response.json(await prepareAnalyses(db, pending, ready), { headers: apiHeaders });
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname === "/latest" && request.method === "GET") return latestFeed(url, context);
    if (!["/analysis-tickets", "/analyse"].includes(url.pathname)) return new Response(null, { status: 404 });

    const requestOrigin = request.headers.get("Origin");
    if (requestOrigin && requestOrigin !== origin) return new Response(null, { status: 403 });
    if (url.pathname === "/analyse" && request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...cors, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "X-Analysis-Ticket" }
      });
    }
    const key = env.DEEPSEEK_API_KEY?.trim();
    if (!env.DB || !key) return new Response(null, { status: 503, headers: apiHeaders });
    try {
      if (url.pathname === "/analysis-tickets" && request.method === "GET") {
        return await analysisTickets(url, env.DB, context);
      }
      if (url.pathname === "/analyse" && request.method === "POST") {
        const ticket = request.headers.get("X-Analysis-Ticket");
        if (!/^[a-f0-9-]{36}$/.test(ticket ?? "")) return new Response(null, { status: 403, headers: apiHeaders });
        const job = analyzeWithTicket(env.DB, ticket, { key });
        context.waitUntil(job.catch(() => {}));
        const result = await job;
        return Response.json(result, { status: result.state === "unknown" ? 403 : 200, headers: apiHeaders });
      }
      return new Response(null, { status: 405, headers: apiHeaders });
    } catch (error) {
      console.warn("资讯解读暂不可用", error.message);
      return new Response(null, { status: 503, headers: apiHeaders });
    }
  }
};
