import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { analyze } from "./deepseek.mjs";
import { collect, readArticle, sources } from "./sources.mjs";

const archivePath = process.env.FEED_ARCHIVE_PATH || ".feed/archive.json";
const outputPath = process.env.FEED_OUTPUT_PATH || "site/feed-data.js";
const maxItems = 450;
const detailLimit = 24;
const analysisLimit = 6;

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
const archived = await loadArchive();
const configured = new Set(sources.map(source => source.id));
const byUrl = new Map(archived.filter(item => configured.has(item.sourceId)).map(item => [item.url, item]));
const sourceStates = await Promise.all(sources.map(async source => {
  const { id, name, shortName, url } = source;
  try {
    const records = await collect(source);
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

const items = [...byUrl.values()]
  .sort((first, second) => second.day.localeCompare(first.day) || first.sourceId.localeCompare(second.sourceId))
  .slice(0, maxItems);
if (!items.length) {
  console.warn("未取得官方资讯，部署将继续使用随源码附带的演示快照。");
} else {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";
  const toAnalyze = key ? items.filter(item => !item.analysis).slice(0, analysisLimit) : [];
  const needsDetail = new Map([...toAnalyze, ...items.filter(item => !item.excerpt)].map(item => [item.id, item]));
  const detailItems = [...needsDetail.values()].slice(0, detailLimit);
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

  for (const item of toAnalyze) {
    const context = articleTexts.get(item.id);
    if (!context) continue;
    try {
      item.analysis = await analyze(item, context, { key, model });
    } catch (error) {
      console.warn("解读暂缓：" + item.id + "，" + error.message);
      if (/HTTP (401|402|403|429)/.test(error.message)) break;
    }
  }

  const archive = { items };
  const snapshot = { mode: "live", generatedAt: checkedAt, aiEnabled: Boolean(key), sources: sourceStates, items };
  await writeAtomic(archivePath, JSON.stringify(archive, null, 2) + "\n");
  await writeAtomic(outputPath, "window.POLICY_FEED = " + JSON.stringify(snapshot, null, 2) + ";\n");
  console.log("已生成发布数据，归档共 " + items.length + " 条。");
}
