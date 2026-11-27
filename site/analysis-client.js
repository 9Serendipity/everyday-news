const batchSize = 4;
const maxAttempts = 4;

async function read(url, options = {}) {
  const response = await fetch(url, {
    ...options, credentials: "omit", redirect: "manual", signal: AbortSignal.timeout(45_000)
  });
  if (!response.ok) throw new Error("解读服务暂不可用");
  return response.json();
}

async function analyzeTicket(url, { id, ticket }) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await read(url, {
      method: "POST", headers: { "X-Analysis-Ticket": ticket }
    });
    if (!["running", "waiting"].includes(result.state)) return { id, ...result };
    if (attempt + 1 < maxAttempts) await new Promise(resolve => setTimeout(resolve, 2_000));
  }
  return { id, state: "deferred" };
}

export async function requestAnalyses(service, ids, onReady) {
  if (!ids.length) return 0;
  const ticketsUrl = new URL("/analysis-tickets", service);
  ticketsUrl.searchParams.set("ids", ids.join(","));
  const { ready, tickets } = await read(ticketsUrl, { method: "POST" });
  let completed = ready.length;
  if (ready.length) onReady(ready);
  const analysisUrl = new URL("/analyse", service);
  for (let start = 0; start < tickets.length; start += batchSize) {
    const batch = tickets.slice(start, start + batchSize);
    const settled = await Promise.allSettled(batch.map(ticket => analyzeTicket(analysisUrl, ticket)));
    const results = settled.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
    const analyzed = results.filter(result => result.state === "done");
    completed += analyzed.length;
    if (analyzed.length) onReady(analyzed);
    if (results.some(result => result.state === "limited")) break;
  }
  return completed;
}
