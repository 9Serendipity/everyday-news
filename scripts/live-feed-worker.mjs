import { beijingDays, collect, sources } from "./sources.mjs";
import { analyzeWithTicket, prepareAnalyses } from "./article-analysis.mjs";

const origin = "https://9serendipity.github.io";
const archiveUrl = "https://raw.githubusercontent.com/9Serendipity/everyday-news/feed-archive/archive.json";
const apiHeaders = { "Access-Control-Allow-Origin": origin, "Cache-Control": "no-store" };
const analysisLimit = 50;

function sourceState({ id, name, shortName, url }, status, checkedAt) {
  return { id, name, shortName, url, status, checkedAt };
}

async function storedSnapshot(db) {
  const data = await db.prepare("SELECT snapshot_json FROM feed_snapshot WHERE id = 1").first("snapshot_json");
  return data ? JSON.parse(data) : null;
}

async function archivedSnapshot() {
  const response = await fetch(archiveUrl, { redirect: "manual", signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error("无法读取上次发布的资讯");
  const { items } = await response.json();
  const lastDay = items.map(item => item.day).sort().at(-1);
  return {
    checkedAt: null,
    days: lastDay ? beijingDays(Date.parse(lastDay + "T12:00:00+08:00")) : [],
    sources: sources.map(source => sourceState(source, items.some(item => item.sourceId === source.id) ? "ok" : "pending", null)),
    items
  };
}

async function withSavedAnalyses(db, snapshot, aiEnabled) {
  const ids = snapshot.items.filter(item => !item.analysis).map(item => item.id);
  if (!ids.length) return { ...snapshot, aiEnabled };
  const rows = await db.prepare(
    "SELECT article_id, result_json FROM article_analysis WHERE result_json IS NOT NULL AND article_id IN (SELECT value FROM json_each(?))"
  ).bind(JSON.stringify(ids)).all();
  const saved = new Map(rows.results.map(row => [row.article_id, JSON.parse(row.result_json)]));
  const items = snapshot.items.map(item => saved.has(item.id) ? { ...item, analysis: saved.get(item.id) } : item);
  return { ...snapshot, aiEnabled, items };
}

async function refreshSnapshot(db, aiEnabled) {
  const checkedAt = new Date().toISOString();
  const days = beijingDays(Date.parse(checkedAt));
  const results = await Promise.allSettled(sources.map(source => collect(source, days)));
  const sourceStates = sources.map((source, index) => {
    const result = results[index];
    if (result.status === "rejected") console.warn(source.id + " 查询失败", result.reason?.message);
    return sourceState(source, result.status === "fulfilled" ? "ok" : "error", checkedAt);
  });
  if (sourceStates.every(source => source.status === "error")) return null;

  const previous = await storedSnapshot(db) ?? await archivedSnapshot().catch(() => null);
  const retained = previous?.items.filter(item => days.includes(item.day)) ?? [];
  const collected = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const merged = new Map(retained.map(item => [item.id, item]));
  for (const item of collected) {
    const older = merged.get(item.id);
    merged.set(item.id, older?.title === item.title ? { ...older, day: item.day } : item);
  }
  const items = [...merged.values()].sort(
    (first, second) => second.day.localeCompare(first.day) || first.sourceId.localeCompare(second.sourceId)
  );
  const snapshot = { checkedAt, days, sources: sourceStates, items };
  const saved = await db.prepare(
    "INSERT INTO feed_snapshot (id, checked_at, snapshot_json) VALUES (1, ?, ?) " +
    "ON CONFLICT (id) DO UPDATE SET checked_at = excluded.checked_at, snapshot_json = excluded.snapshot_json " +
    "WHERE feed_snapshot.checked_at < excluded.checked_at RETURNING id"
  ).bind(checkedAt, JSON.stringify(snapshot)).first("id");
  const current = await withSavedAnalyses(db, saved ? snapshot : await storedSnapshot(db), aiEnabled);
  const collectedIds = new Set(collected.map(item => item.id));
  const analysisIds = aiEnabled
    ? current.items.filter(item => collectedIds.has(item.id) && !item.analysis).slice(0, analysisLimit).map(item => item.id)
    : [];
  return { ...current, analysisIds };
}

async function analysisTickets(url, db) {
  const ids = new Set((url.searchParams.get("ids") ?? "").split(","));
  if (ids.size > analysisLimit || ![...ids].every(id => /^[a-f0-9]{16}$/.test(id))) {
    return Response.json({ error: "invalid article ids" }, { status: 400, headers: apiHeaders });
  }
  const snapshot = await storedSnapshot(db);
  const days = beijingDays();
  const items = snapshot?.items.filter(item => ids.has(item.id) && days.includes(item.day)) ?? [];
  const ready = items.filter(item => item.analysis).map(({ id, analysis }) => ({ id, analysis }));
  const pending = items.filter(item => !item.analysis);
  return Response.json(await prepareAnalyses(db, pending, ready), { headers: apiHeaders });
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const route = url.pathname;
    if (!["/latest", "/refresh", "/analysis-tickets", "/analyse"].includes(route)) return new Response(null, { status: 404 });
    const requestOrigin = request.headers.get("Origin");
    if (requestOrigin && requestOrigin !== origin) return new Response(null, { status: 403 });
    if (route === "/analyse" && request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...apiHeaders, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "X-Analysis-Ticket" }
      });
    }
    if (!env.DB) return new Response(null, { status: 503, headers: apiHeaders });
    const key = env.DEEPSEEK_API_KEY?.trim();
    try {
      if (route === "/latest" && request.method === "GET") {
        const snapshot = await storedSnapshot(env.DB) ?? await archivedSnapshot();
        return Response.json(await withSavedAnalyses(env.DB, snapshot, Boolean(key)), { headers: apiHeaders });
      }
      if (request.method !== "POST") return new Response(null, { status: 405, headers: apiHeaders });
      if (requestOrigin !== origin) return new Response(null, { status: 403, headers: apiHeaders });
      if (route === "/refresh") {
        const result = await refreshSnapshot(env.DB, Boolean(key));
        return result ? Response.json(result, { headers: apiHeaders }) : new Response(null, { status: 503, headers: apiHeaders });
      }
      if (!key) return new Response(null, { status: 503, headers: apiHeaders });
      if (route === "/analysis-tickets") return await analysisTickets(url, env.DB);
      if (route === "/analyse") {
        const ticket = request.headers.get("X-Analysis-Ticket");
        if (!/^[a-f0-9-]{36}$/.test(ticket ?? "")) return new Response(null, { status: 403, headers: apiHeaders });
        const job = analyzeWithTicket(env.DB, ticket, { key });
        context.waitUntil(job.catch(() => {}));
        const result = await job;
        return Response.json(result, { status: result.state === "unknown" ? 403 : 200, headers: apiHeaders });
      }
      return new Response(null, { status: 405, headers: apiHeaders });
    } catch (error) {
      console.warn("资讯服务暂不可用", error.message);
      return new Response(null, { status: 503, headers: apiHeaders });
    }
  }
};
