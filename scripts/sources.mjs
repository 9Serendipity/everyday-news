import { load } from "cheerio/slim";

const government = "https://www.gov.cn/zhengce/zuixin/";
const csrc = "https://www.csrc.gov.cn/csrc/c100028/common_xq_list.shtml?tab=02";
const csrcList = "https://www.csrc.gov.cn/searchList/a1a078ee0bc54721ab6b148884c784a8?_isAgg=true&_isJson=true&_pageSize=18&_template=index&_rangeTimeGte=&_channelName=&page=1";

export const sources = [
  {
    id: "gov", name: "中国政府网", shortName: "中国政府网", category: "政策文件", url: government,
    endpoint: new URL("ZUIXINZHENGCE.json", government).href,
    decode: body => JSON.parse(body).map(row => [row.URL, row.TITLE, row.DOCRELPUBTIME]),
    article: "#UCAP-CONTENT"
  },
  {
    id: "ndrc", name: "国家发展和改革委员会", shortName: "国家发改委", category: "宏观与产业",
    url: "https://www.ndrc.gov.cn/xwdt/xwfb/wap_index.html",
    list: "li a[href*='/t20']", date: "span", article: ".article_con .TRS_Editor, .article_con"
  },
  {
    id: "pbc", name: "中国人民银行", shortName: "人民银行", category: "货币与金融",
    url: "https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/index.html",
    list: "font.newslist_style a[istitle]", container: "td", date: ".hui12", article: "#zoom"
  },
  {
    id: "csrc", name: "中国证券监督管理委员会", shortName: "证监会", category: "资本市场", url: csrc,
    endpoint: csrcList,
    decode: body => JSON.parse(body).data.results.map(row => [row.url, row.title, row.publishedTimeStr]),
    article: ".detail-news #UCAP-CONTENT, .detail-news .detail-news-content, .detail-news"
  },
  {
    id: "nda", name: "国家数据局", shortName: "国家数据局", category: "数字经济",
    url: "https://www.nda.gov.cn/sjj/zwgk/tzgg/list/index_pc_1.html",
    list: "li a[href^='/sjj/zwgk/tzgg/'][href$='_pc.html']", date: "span", article: ".article"
  }
];

const listLimit = 12;
const contextLimit = 4200;
const encoder = new TextEncoder();

function clean(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function chinaDay(value) {
  const parts = clean(value).match(/^(20\d{2})[./年-](\d{1,2})[./月-](\d{1,2})/);
  if (!parts) return "";
  const day = parts[1] + "-" + parts[2].padStart(2, "0") + "-" + parts[3].padStart(2, "0");
  const date = new Date(day + "T00:00:00Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(day) ? day : "";
}

function canonical(raw, source) {
  if (!clean(raw)) return "";
  try {
    const url = new URL(raw, source.url);
    if (url.protocol === "http:") url.protocol = "https:";
    const origin = new URL(source.url).origin;
    if (url.origin !== origin || url.username || url.password) return "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

async function download(url) {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PolicyRadar/1.0)",
      Accept: "text/html,application/json;q=0.9,*/*;q=0.5"
    }
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.text();
}

function htmlRows(html, source) {
  const $ = load(html);
  return $(source.list).toArray().map(element => {
    const anchor = $(element);
    const container = anchor.closest(source.container ?? "li");
    return [anchor.attr("href"), anchor.attr("title") || anchor.text(), container.find(source.date).first().text()];
  });
}

async function articleId(url) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(url));
  return Array.from(new Uint8Array(hash, 0, 8), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function collect(source) {
  const body = await download(source.endpoint ?? source.url);
  const rows = source.decode ? source.decode(body) : htmlRows(body, source);
  const entries = new Map();
  for (const [rawUrl, rawTitle, rawDate] of rows) {
    const url = canonical(rawUrl, source);
    const title = clean(rawTitle).slice(0, 240);
    const day = chinaDay(rawDate);
    if (!url || !title || !day || entries.has(url)) continue;
    entries.set(url, { sourceId: source.id, title, day, url, category: source.category, excerpt: "" });
    if (entries.size >= listLimit) break;
  }
  if (!entries.size) throw new Error("未识别到带日期的文章");
  return Promise.all([...entries.values()].map(async item => ({ id: await articleId(item.url), ...item })));
}

export async function readArticle(item) {
  const source = sources.find(entry => entry.id === item.sourceId);
  if (!source || canonical(item.url, source) !== item.url) return "";
  const $ = load(await download(item.url));
  const section = $(source.article).first();
  if (!section.length) return "";
  section.find("script,style,iframe,video,noscript,form,[hidden]").remove();
  section.find("br").replaceWith("\n");
  section.find("p,div").after("\n");
  const lines = section.text().split(/\n+/).map(clean).filter(
    line => line.length >= 18 && line !== item.title && !line.includes("扫一扫在手机打开")
  );
  return lines.join("\n").slice(0, contextLimit);
}
