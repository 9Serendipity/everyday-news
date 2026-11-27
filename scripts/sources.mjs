import { load } from "cheerio/slim";

const government = "https://www.gov.cn/zhengce/zuixin/";
const csrc = "https://www.csrc.gov.cn/csrc/c100028/common_xq_list.shtml?tab=02";
const csrcList = "https://www.csrc.gov.cn/searchList/a1a078ee0bc54721ab6b148884c784a8?_isAgg=true&_isJson=true&_pageSize=18&_template=index&_rangeTimeGte=&_channelName=&page=1";
const miit = "https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/index.html";
const miitNotices = new URL("/api-gateway/jpaas-publish-server/front/page/build/unit", miit);
miitNotices.search = new URLSearchParams({
  parseType: "buildstatic",
  webId: "8d828e408d90447786ddbe128d495e9e",
  tplSetId: "209741b2109044b5b7695700b2bec37e",
  pageType: "column",
  tagId: "右侧内容",
  editType: "null",
  pageId: "3e3ad1a3bec74939890a0d3e54815141"
});
const nfra = "https://www.nfra.gov.cn";
const nfraPolicyItem = "928";
const nfraDetailPath = "/cn/view/pages/ItemDetail.html";
const nfraDocuments = nfra + "/cn/static/data/DocInfo/";

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
    fallbackRss: "https://www.pbc.gov.cn/goutongjiaoliu/113456/2986536/index.html",
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
  },
  {
    id: "miit", name: "工业和信息化部", shortName: "工信部", category: "产业政策", url: miit,
    endpoint: miitNotices.href,
    list: "li > a[href^='/zwgk/zcwj/wjfb/tz/art/']", date: "span.fr", article: "#con_con",
    decode: (body, source) => {
      const $ = load(JSON.parse(body).data.html);
      $("span.fr .jd").remove();
      return htmlRows($, source);
    }
  },
  {
    id: "nbs", name: "国家统计局", shortName: "国家统计局", category: "宏观数据",
    url: "https://www.stats.gov.cn/sj/zxfb/",
    list: ".list-content li a[href*='/t20'][title]", date: "span", article: ".trs_editor_view"
  },
  {
    id: "nfra", name: "国家金融监督管理总局", shortName: "金融监管总局", category: "金融监管",
    url: nfra + "/cn/view/pages/ItemList.html?itemId=" + nfraPolicyItem + "&itemPId=923&itemUrl=ItemListRightList.html",
    endpoint: nfraDocuments + "SelectDocByItemIdAndChild/data_itemId=" + nfraPolicyItem + ",pageIndex=1,pageSize=18.json",
    decode: body => JSON.parse(body).data.rows.map(row => [
      nfraArticleUrl(row.docId, row.generaltype), row.docSubtitle, row.publishDate
    ]),
    canonicalArticle: url => url.pathname === nfraDetailPath
      ? nfraArticleUrl(url.searchParams.get("docId"), url.searchParams.get("generaltype"))
      : "",
    articleEndpoint: url => nfraDocuments + "SelectByDocId/data_docId=" + url.searchParams.get("docId") + ".json",
    articleMarkup: body => JSON.parse(body).data.docClob ?? "",
    article: "body"
  }
];

const contextLimit = 4200;
const encoder = new TextEncoder();

export function beijingDay(time = Date.now()) {
  return new Date(time + 8 * 60 * 60_000).toISOString().slice(0, 10);
}

export function beijingDays(time = Date.now()) {
  return [beijingDay(time - 24 * 60 * 60_000), beijingDay(time)];
}

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

function nfraArticleUrl(docId, generaltype) {
  if (!/^\d+$/.test(docId) || !/^\d$/.test(generaltype)) return "";
  const query = new URLSearchParams({ docId, itemId: nfraPolicyItem, generaltype });
  return nfra + nfraDetailPath + "?" + query;
}

function canonical(raw, source) {
  if (!clean(raw)) return "";
  try {
    const url = new URL(raw, source.url);
    if (url.protocol === "http:") url.protocol = "https:";
    const origin = new URL(source.url).origin;
    if (url.origin !== origin || url.username || url.password) return "";
    if (source.canonicalArticle) return source.canonicalArticle(url);
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

function htmlRows($, source) {
  return $(source.list).toArray().map(element => {
    const anchor = $(element);
    const container = anchor.closest(source.container ?? "li");
    return [anchor.attr("href"), anchor.attr("title") || anchor.text(), container.find(source.date).first().text()];
  });
}

function rssRows(body) {
  const $ = load(body, { xml: true });
  return $("item").toArray().map(element => {
    const entry = $(element);
    const link = clean(entry.find("link").text());
    const published = Date.parse(entry.find("pubDate").text());
    const day = Number.isFinite(published) ? beijingDay(published) : "";
    const url = link.startsWith("www.pbc.gov.cn/") ? "https://" + link : link;
    return [url, entry.find("title").text(), day];
  });
}

async function articleId(url) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(url));
  return Array.from(new Uint8Array(hash, 0, 8), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function collectEntries(rows, source, days) {
  const entries = new Map();
  let recognized = false;
  for (const [rawUrl, rawTitle, rawDate] of rows) {
    const url = canonical(rawUrl, source);
    const title = clean(rawTitle).slice(0, 240);
    const day = chinaDay(rawDate);
    if (!url || !title || !day) continue;
    recognized = true;
    if (!days.includes(day) || entries.has(url)) continue;
    entries.set(url, { sourceId: source.id, title, day, url, category: source.category, excerpt: "" });
  }
  if (!recognized) throw new Error("未识别到带日期的文章");
  return Promise.all([...entries.values()].map(async item => ({ id: await articleId(item.url), ...item })));
}

export async function collect(source, days = beijingDays()) {
  try {
    const body = await download(source.endpoint ?? source.url);
    const rows = source.decode ? source.decode(body, source) : htmlRows(load(body), source);
    return await collectEntries(rows, source, days);
  } catch (error) {
    if (!source.fallbackRss) throw error;
    return collectEntries(rssRows(await download(source.fallbackRss)), source, days);
  }
}

export async function readArticle(item) {
  const source = sources.find(entry => entry.id === item.sourceId);
  if (!source || canonical(item.url, source) !== item.url) return "";
  const body = await download(source.articleEndpoint ? source.articleEndpoint(new URL(item.url)) : item.url);
  const $ = load(source.articleMarkup ? source.articleMarkup(body) : body);
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
