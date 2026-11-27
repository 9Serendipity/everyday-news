import { analyze } from "./deepseek.mjs";
import { readArticle } from "./sources.mjs";

const hour = 60 * 60_000;
const maxAttempts = 50;
const maxConcurrent = 4;
const activeFor = 60_000;

export async function prepareAnalyses(db, items, ready) {
  if (!items.length) return { ready, tickets: [] };
  const values = items.map(({ id }) => id);
  const placeholders = values.map(() => "?").join(", ");
  const statements = items.map(({ id, sourceId, day, title, url }) => db.prepare(
    "INSERT INTO article_analysis (article_id, ticket, article_json) VALUES (?, ?, ?) ON CONFLICT (article_id) DO NOTHING"
  ).bind(id, crypto.randomUUID(), JSON.stringify({ id, sourceId, day, title, url })));
  statements.push(db.prepare(
    "SELECT article_id, ticket, result_json FROM article_analysis WHERE article_id IN (" + placeholders + ")"
  ).bind(...values));
  const reports = await db.batch(statements);
  const rows = new Map(reports.at(-1).results.map(row => [row.article_id, row]));
  const tickets = [];
  for (const id of values) {
    const row = rows.get(id);
    if (row.result_json) ready.push({ id, analysis: JSON.parse(row.result_json) });
    else tickets.push({ id, ticket: row.ticket });
  }
  return { ready, tickets };
}

function loadJob(db, ticket) {
  return db.prepare(
    "SELECT article_id, article_json, started_at, finished_at, result_json FROM article_analysis WHERE ticket = ?"
  ).bind(ticket).first();
}

function jobStatus(job, now) {
  if (job.result_json) return { state: "done", analysis: JSON.parse(job.result_json) };
  if (job.started_at > now - activeFor && job.finished_at === null) return { state: "running" };
  if (job.started_at > now - hour) return { state: "deferred" };
  return { state: "waiting" };
}

export async function analyzeWithTicket(db, ticket, settings) {
  const job = await loadJob(db, ticket);
  if (!job) return { state: "unknown" };
  const now = Date.now();
  const status = jobStatus(job, now);
  if (status.state !== "waiting") return status;

  const claimed = await db.prepare(`
    UPDATE article_analysis
    SET started_at = ?, finished_at = NULL
    WHERE article_id = ? AND result_json IS NULL AND (started_at IS NULL OR started_at <= ?)
      AND (SELECT COUNT(*) FROM article_analysis WHERE started_at > ?) < ?
      AND (SELECT COUNT(*) FROM article_analysis WHERE started_at > ? AND finished_at IS NULL) < ?
    RETURNING article_id
  `).bind(now, job.article_id, now - hour, now - hour, maxAttempts, now - activeFor, maxConcurrent).first();
  if (!claimed) {
    const current = jobStatus(await loadJob(db, ticket), Date.now());
    if (current.state !== "waiting") return current;
    const used = await db.prepare(
      "SELECT COUNT(*) AS used FROM article_analysis WHERE started_at > ?"
    ).bind(Date.now() - hour).first("used");
    return { state: used >= maxAttempts ? "limited" : "waiting" };
  }

  const item = JSON.parse(job.article_json);
  let analysis;
  let limited = false;
  try {
    const text = await readArticle(item);
    if (text) analysis = await analyze(item, text, settings);
  } catch (error) {
    console.warn("解读暂缓", item.id, error.message);
    limited = /HTTP (401|402|403|429)/.test(error.message);
  }
  await db.prepare(
    "UPDATE article_analysis SET finished_at = ?, result_json = ? WHERE article_id = ? AND started_at = ?"
  ).bind(Date.now(), analysis ? JSON.stringify(analysis) : null, item.id, now).run();
  if (analysis) return { state: "done", analysis };
  return { state: limited ? "limited" : "deferred" };
}
