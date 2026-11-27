import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { requestAnalyses } from "../site/analysis-client.js";
import { analyze } from "./deepseek.mjs";
import { beijingDay, collect, readArticle, sources } from "./sources.mjs";

const archivePath = process.env.FEED_ARCHIVE_PATH || ".feed/archive.json";
const outputPath = process.env.FEED_OUTPUT_PATH || "site/feed-data.js";
const detailLimit = 24;
const maximumAnalysisLimit = 50;
const analysisConcurrency = 4;
const requestedLimit = process.env.DEEPSEEK_ANALYSIS_LIMIT?.trim();
const analysisLimit = requestedLimit ? Number(requestedLimit) : maximumAnalysisLimit;
if (!Number.isInteger(analysisLimit) || analysisLimit < 0 || analysisLimit > maximumAnalysisLimit) {
  throw new Error("本次解读条数请输入 0 到 " + maximumAnalysisLimit + " 的整数。");
}

async function loadArchive() {
  try {
    const saved = JSON.parse(await readFile(archivePath, "utf8"));
    if (!Array.isArray(saved.items)) throw new Error("资讯归档格式错误");
    return saved.items;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return [];
  }
}

async function writeAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const pending = path + "." + process.pid + ".tmp";
  await writeFile(pending, value, "utf8");
  await rename(pending, path);
}

const checkedAt = new Date().toISOString();
const today = beijingDay(Date.parse(checkedAt));
const archived = await loadArchive();
const configured = new Set(sources.map(source => source.id));
const byUrl = new Map(archived.filter(item => item.day === today && configured.has(item.sourceId))
  .map(item => [item.url, item]));
const sourceStates = await Promise.all(sources.map(async source => {
  const { id, name, shortName, url } = source;
  try {
    const records = await collect(source, today);
    for (const record of records) {
      const previous = byUrl.get(record.url);
      byUrl.set(record.url, previous ? {
        ...record,
        excerpt: previous.excerpt ?? "",
        ...(previous.title === record.title && previous.analysis ? { analysis: previous.analysis } : {})
      } : record);
    }
    console.log(shortName + "：" + records.length + " 条");
    return { id, name, shortName, url, status: "ok", checkedAt };
  } catch (error) {
    console.warn(shortName + "采集失败：" + error.message);
    return { id, name, shortName, url, status: "error", checkedAt };
  }
}));

const items = [...byUrl.values()].sort((first, second) => first.sourceId.localeCompare(second.sourceId));
const key = process.env.DEEPSEEK_API_KEY?.trim();
const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";
const analysisService = process.env.ANALYSIS_SERVICE_URL?.trim();
const aiEnabled = Boolean(analysisService || key);
const toAnalyze = aiEnabled && analysisLimit > 0 ? items.filter(item => !item.analysis) : [];
const localAnalyses = analysisService ? [] : toAnalyze;
console.log("本次 DeepSeek 解读上限 " + analysisLimit + " 条。");
const needsDetail = new Map([...localAnalyses, ...items.filter(item => !item.excerpt)].map(item => [item.id, item]));
const contextLimit = Math.min(localAnalyses.length, analysisLimit * 2);
const detailItems = [...needsDetail.values()].slice(0, Math.max(detailLimit, contextLimit));
const articleTexts = new Map();

for (let start = 0; start < detailItems.length; start += 5) {
  await Promise.all(detailItems.slice(start, start + 5).map(async item => {
    try {
      const article = await readArticle(item);
      if (!article) return;
      articleTexts.set(item.id, article);
      const first = article.split("\n")[0];
      item.excerpt = first.length > 88 ? first.slice(0, 88) + "…" : first;
    } catch {
      console.warn("暂时无法读取原文：" + item.id);
    }
  }));
}

if (analysisService && toAnalyze.length) {
  const pending = new Map(toAnalyze.slice(0, analysisLimit).map(item => [item.id, item]));
  try {
    await requestAnalyses(analysisService, [...pending.keys()], results => {
      for (const { id, analysis } of results) {
        const item = pending.get(id);
        if (item) item.analysis = analysis;
      }
    });
  } catch (error) {
    console.warn("解读稍后更新：" + error.message);
  }
}
const readyToAnalyze = localAnalyses.filter(item => articleTexts.has(item.id)).slice(0, analysisLimit);
for (let start = 0; start < readyToAnalyze.length; start += analysisConcurrency) {
  const batch = readyToAnalyze.slice(start, start + analysisConcurrency);
  const stopBeforeNextBatch = await Promise.all(batch.map(async item => {
    try {
      item.analysis = await analyze(item, articleTexts.get(item.id), { key, model });
      return false;
    } catch (error) {
      console.warn("解读暂缓：" + item.id + "，" + error.message);
      return /HTTP (401|402|403|429)/.test(error.message);
    }
  }));
  if (stopBeforeNextBatch.includes(true)) break;
}

const archive = { items };
const workflowRunId = Number(process.env.GITHUB_RUN_ID) || undefined;
const snapshot = { mode: "live", generatedAt: checkedAt, workflowRunId, aiEnabled, sources: sourceStates, items };
await writeAtomic(archivePath, JSON.stringify(archive, null, 2) + "\n");
await writeAtomic(outputPath, "window.POLICY_FEED = " + JSON.stringify(snapshot, null, 2) + ";\n");
console.log("已生成发布数据，归档共 " + items.length + " 条。");
