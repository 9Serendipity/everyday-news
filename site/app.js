(() => {
  "use strict";

  let feed;
  let sources;
  let items;
  let itemsById;
  let displayDays;
  const beijingOffset = 8 * 60 * 60_000;
  const dayLength = 24 * 60 * 60_000;
  const count = new Intl.NumberFormat("zh-CN");
  const dayFormat = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric"
  });
  const shortDayFormat = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", month: "long", day: "numeric"
  });
  const stampFormat = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });
  const directions = { positive: "偏正面", negative: "偏负面", neutral: "中性", unclear: "待观察" };
  const statuses = { ok: "已采集", error: "采集异常", pending: "待采集", demo: "演示" };
  const feedService = "https://policy-radar-live-9serendipity.shadymint257.chatgpt.site";
  const loadingFeed = "正在读取上次刷新结果…";
  const pageSize = 8;
  let limit = pageSize;
  let currentView = "";
  let previousFocus;

  const byId = id => document.getElementById(id);
  const query = byId("query");
  const sourceFilter = byId("source-filter");
  const categoryFilter = byId("category-filter");
  const dialog = byId("detail-dialog");
  const dialogContent = byId("dialog-content");
  const refreshButton = byId("refresh-feed");
  const refreshStatus = byId("refresh-feed-status");

  function node(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value) element.textContent = value;
    return element;
  }

  function beijingDay(time = Date.now()) {
    return new Date(time + beijingOffset).toISOString().slice(0, 10);
  }

  function beijingDays(time = Date.now()) {
    return [beijingDay(time - dayLength), beijingDay(time)];
  }

  function rangeText(days) {
    return days.map(day => shortDayFormat.format(new Date(day + "T12:00:00+08:00"))).join("至");
  }

  function dateText(day) {
    return day ? dayFormat.format(new Date(day + "T12:00:00+08:00")) : "暂无收录";
  }

  function setDay(element, day, text) {
    element.textContent = text ?? dateText(day);
    if (day) element.dateTime = day;
    else element.removeAttribute("datetime");
    return element;
  }

  function sourceName(item) {
    return sources.get(item.sourceId)?.shortName ?? item.sourceId;
  }

  function externalLink(url, label, className) {
    if (typeof url !== "string" || !url.startsWith("https://")) return node("span", "", "");
    const anchor = node("a", className, label);
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    return anchor;
  }

  function itemButton(item, className) {
    const button = node("button", className, item.title);
    button.type = "button";
    button.dataset.article = item.id;
    return button;
  }

  function directionBadge(direction) {
    return node("span", "direction " + direction, directions[direction] ?? directions.unclear);
  }

  function sourceStatus(source) {
    const status = node("span", "source-status", statuses[source.status] ?? statuses.pending);
    status.dataset.status = source.status;
    return status;
  }

  function optionList(select, first, entries) {
    const previous = select.value;
    select.replaceChildren(new Option(first, ""), ...entries.map(([value, title]) => new Option(title, value)));
    if (entries.some(([value]) => value === previous)) select.value = previous;
  }

  function createRecord(item) {
    const article = node("article", "feed-item");
    const main = node("div");
    const meta = node("div", "item-meta");
    const headline = node("h3");
    const tags = node("div", "tags");
    meta.append(
      node("span", "item-source", sourceName(item)),
      setDay(node("time"), item.day)
    );
    headline.append(itemButton(item, "article-title"));
    main.append(meta, headline);
    const excerpt = item.analysis?.summary || item.excerpt;
    if (excerpt) main.append(node("p", "excerpt", excerpt));
    const categories = new Set([item.category, ...(item.analysis?.industries ?? [])].filter(Boolean));
    tags.append(...[...categories].slice(0, 4).map(category => node("span", "tag", category)));
    if (tags.childElementCount) main.append(tags);
    article.append(main);
    if (item.analysis) article.append(directionBadge(item.analysis.direction));
    return article;
  }

  function findRecords() {
    const words = query.value.trim().toLocaleLowerCase("zh-CN").split(/\s+/).filter(Boolean);
    return items.filter(item => {
      if (sourceFilter.value && item.sourceId !== sourceFilter.value) return false;
      if (categoryFilter.value && item.category !== categoryFilter.value) return false;
      if (!words.length) return true;
      const strings = [
        item.title, item.excerpt, item.category, sourceName(item), item.analysis?.summary,
        ...(item.analysis?.industries ?? [])
      ];
      const searchable = strings.join(" ").toLocaleLowerCase("zh-CN");
      return words.every(word => searchable.includes(word));
    });
  }

  function renderRecords() {
    const matches = findRecords();
    byId("result-count").textContent = "共 " + count.format(matches.length) + " 条";
    byId("feed-list").replaceChildren(...matches.slice(0, limit).map(createRecord));
    byId("load-more").hidden = matches.length <= limit;
    if (matches.length) return;
    const empty = node("div", "empty");
    const filtered = items.length > 0 && [query, sourceFilter, categoryFilter].some(control => control.value.trim());
    empty.append(node("p", "", filtered ? "没有符合条件的资讯。" : "近两日暂无资讯。"));
    if (filtered) {
      const button = node("button", "button button-subtle", "清除筛选");
      button.type = "button";
      button.addEventListener("click", () => {
        resetFilters();
        renderRecords();
        query.focus();
      });
      empty.append(button);
    }
    byId("feed-list").append(empty);
  }

  function resetFilters() {
    for (const control of [query, sourceFilter, categoryFilter]) control.value = "";
    limit = pageSize;
  }

  function showView() {
    const view = location.hash === "#sources" ? "sources" : "overview";
    if (view === currentView) return;
    const first = !currentView;
    currentView = view;
    const overview = view === "overview";
    byId("home-hero").hidden = !overview;
    byId("metrics").hidden = !overview;
    byId("workspace").hidden = !overview;
    byId("source-view").hidden = overview;
    for (const anchor of document.querySelectorAll("[data-view]")) {
      if (anchor.dataset.view === view) anchor.setAttribute("aria-current", "page");
      else anchor.removeAttribute("aria-current");
    }
    resetFilters();
    if (view !== "sources") renderRecords();
    if (!first) window.scrollTo(0, 0);
  }

  function briefItem(item) {
    const listItem = node("li");
    listItem.append(node("span", "item-source", sourceName(item)), itemButton(item, "brief-link"));
    return listItem;
  }

  function displayDialog(title, eyebrow, content) {
    byId("dialog-eyebrow").textContent = eyebrow;
    const heading = byId("dialog-title");
    heading.textContent = title;
    dialogContent.replaceChildren(content);
    if (!dialog.open) {
      previousFocus = document.activeElement;
      dialog.showModal();
    }
    dialog.scrollTop = 0;
    heading.focus({ preventScroll: true });
  }

  function showBrief() {
    const content = document.createDocumentFragment();
    if (!items.length) content.append(node("p", "empty", "近两日暂无资讯。"));
    for (const item of items) {
      const section = node("section", "dialog-section");
      const heading = node("h3");
      heading.append(itemButton(item, "article-title"));
      section.append(node("span", "item-source", sourceName(item)), heading);
      const summary = item.analysis?.summary || item.excerpt;
      if (summary) section.append(node("p", "", summary));
      content.append(section);
    }
    displayDialog("两日简报", rangeText(displayDays), content);
  }

  function showRecord(item) {
    const content = document.createDocumentFragment();
    if (item.excerpt) {
      const original = node("section", "dialog-section");
      original.append(node("h3", "", feed.mode === "live" ? "原文摘录" : "原文要点"), node("p", "", item.excerpt));
      content.append(original);
    }
    if (item.analysis) {
      const analysis = node("section", "dialog-section");
      const fields = node("dl", "analysis-fields");
      const details = [
        ["影响方向", directions[item.analysis.direction]],
        ["涉及行业", item.analysis.industries?.join("、")],
        ["影响判断", item.analysis.impact],
        ["后续观察", item.analysis.watch?.join("；")]
      ];
      for (const [label, value] of details) {
        if (value) fields.append(node("dt", "", label), node("dd", "", value));
      }
      analysis.append(
        node("h3", "", item.analysis.origin === "demo" ? "示例解读" : "DeepSeek 解读"),
        node("p", "", item.analysis.summary),
        fields
      );
      content.append(analysis);
    } else {
      const status = feed.aiEnabled ? "这条资讯正在等待解读。" : "配置 DeepSeek 后可生成行业和市场解读。";
      const analysis = node("section", "dialog-section");
      analysis.append(node("h3", "", "AI 解读"), node("p", "", status));
      content.append(analysis);
    }
    content.append(externalLink(item.url, "查看官方原文", "button button-accent"));
    displayDialog(item.title, sourceName(item) + " · " + dateText(item.day), content);
  }

  function updateText() {
    if (feed.mode !== "live") return "演示快照";
    if (!feed.generatedAt) return items.length ? "上次发布的资讯" : "尚未刷新";
    return "上次刷新 " + stampFormat.format(new Date(feed.generatedAt)) + "（北京时间）";
  }

  function showFeed(snapshot) {
    feed = snapshot;
    const generatedTime = Date.parse(feed.generatedAt);
    displayDays = feed.days ?? beijingDays(Number.isFinite(generatedTime) ? generatedTime : Date.now());
    const sourceList = feed.sources;
    sources = new Map(sourceList.map(source => [source.id, source]));
    items = feed.items.filter(item => displayDays.includes(item.day));
    itemsById = new Map(items.map(item => [item.id, item]));

    const countsBySource = new Map();
    for (const item of items) {
      countsBySource.set(item.sourceId, (countsBySource.get(item.sourceId) ?? 0) + 1);
    }
    optionList(sourceFilter, "全部信源", sourceList.map(source => [source.id, source.shortName]));
    const categories = [...new Set(items.map(item => item.category).filter(Boolean))].sort();
    optionList(categoryFilter, "全部主题", categories.map(value => [value, value]));

    const demo = feed.mode !== "live";
    byId("feed-mode").textContent = demo ? "演示数据" : "官方资讯";
    byId("feed-mode").classList.toggle("demo", demo);
    byId("hero-range").textContent = rangeText(displayDays);
    byId("brief-range").textContent = rangeText(displayDays);
    byId("metric-total").textContent = count.format(items.length);
    byId("metric-sources").textContent = count.format(sources.size);
    byId("metric-analysis").textContent = count.format(items.filter(item => item.analysis).length);
    byId("analysis-label").textContent = demo ? "示例解读" : feed.aiEnabled ? "AI 解读" : "AI 解读 · 待配置";

    const brief = items.slice(0, 3).map(briefItem);
    byId("brief-list").replaceChildren(...(brief.length ? brief : [node("li", "", "近两日暂无简报")]));
    const sideSources = sourceList.slice(0, 4).map(source => {
      const summary = node("li");
      summary.append(node("span", "", source.shortName), sourceStatus(source));
      return summary;
    });
    byId("side-sources").replaceChildren(...sideSources);

    const tiles = sourceList.map(source => {
      const tile = node("article", "source-tile");
      const checked = source.checkedAt ? " · " + stampFormat.format(new Date(source.checkedAt)) + " 检查" : "";
      const details = "两日收录 " + count.format(countsBySource.get(source.id) ?? 0) + " 条" + checked;
      tile.append(
        node("h2", "", source.name),
        node("p", "", details),
        sourceStatus(source),
        node("br"),
        externalLink(source.url, "打开官方栏目", "side-action")
      );
      return tile;
    });
    byId("source-grid").replaceChildren(...tiles);
    byId("source-note").textContent = demo
      ? "正在查看演示快照。各栏目当前状态会随采集结果更新。"
      : "此处显示上次刷新的结果。点「刷新资讯」查询北京时间当天和前一天的发布。";
    byId("footer-update").textContent = updateText();
    if (currentView && currentView !== "sources") renderRecords();
  }

  async function loadFeed(path, method = "GET") {
    const response = await fetch(new URL(path, feedService), {
      method,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(method === "POST" ? 22_000 : 8_000)
    });
    if (!response.ok) throw new Error("资讯服务暂不可用");
    const snapshot = await response.json();
    if ((snapshot?.checkedAt !== null && !Number.isFinite(Date.parse(snapshot?.checkedAt)))
      || !Array.isArray(snapshot.days) || !Array.isArray(snapshot.sources) || !Array.isArray(snapshot.items)) {
      throw new Error("资讯数据格式有误");
    }
    return { ...snapshot, mode: "live", generatedAt: snapshot.checkedAt };
  }

  async function refreshFeed() {
    if (refreshButton.disabled) return;
    refreshButton.disabled = true;
    refreshButton.textContent = "刷新中…";
    refreshStatus.textContent = "正在查询官方信源…";
    try {
      const snapshot = await loadFeed("/refresh", "POST");
      const knownIds = new Set(items.map(item => item.id));
      showFeed(snapshot);
      const newItems = items.filter(item => !knownIds.has(item.id)).length;
      const result = newItems ? "新增 " + count.format(newItems) + " 条资讯。"
        : items.length ? "暂无新增资讯。" : "近两日暂无资讯。";
      const unavailable = snapshot.sources.filter(source => source.status === "error").length;
      const partial = unavailable ? " " + count.format(unavailable) + " 个信源暂未响应。" : "";
      const message = "已刷新。" + result + partial;
      const pending = snapshot.analysisIds ?? [];
      refreshStatus.textContent = message;
      if (!pending.length) return;

      refreshButton.textContent = "解读中…";
      refreshStatus.textContent = message + " 正在解读 " + count.format(pending.length) + " 条资讯…";
      try {
        const { requestAnalyses } = await import("./analysis-client.js?v=2");
        const completed = await requestAnalyses(feedService, pending, results => {
          const ready = new Map(results.map(({ id, analysis }) => [id, analysis]));
          showFeed({
            ...feed,
            items: feed.items.map(item => ready.has(item.id) ? { ...item, analysis: ready.get(item.id) } : item)
          });
        });
        const finished = completed ? " 已显示 " + count.format(completed) + " 条 AI 解读。" : "";
        const later = completed < pending.length ? " 其余解读可在下次手动刷新时重试。" : "";
        refreshStatus.textContent = message + finished + later;
      } catch {
        refreshStatus.textContent = message + " 下次手动刷新时可重试 AI 解读。";
      }
    } catch {
      refreshStatus.textContent = "刷新未完成，当前显示已保存的资讯。";
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = "刷新资讯";
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("button[data-article], button[data-brief]");
    if (!button) return;
    if (button.hasAttribute("data-brief")) showBrief();
    else {
      const item = itemsById.get(button.dataset.article);
      if (item) showRecord(item);
    }
  });
  dialog.addEventListener("close", () => {
    if (previousFocus?.isConnected) previousFocus.focus();
  });
  for (const [control, event] of [
    [query, "input"], [sourceFilter, "change"], [categoryFilter, "change"]
  ]) {
    control.addEventListener(event, () => {
      limit = pageSize;
      renderRecords();
    });
  }
  byId("load-more").addEventListener("click", () => {
    const previousLimit = limit;
    limit += pageSize;
    renderRecords();
    byId("feed-list").querySelectorAll(".article-title")[previousLimit]?.focus();
  });
  refreshButton.addEventListener("click", refreshFeed);
  window.addEventListener("hashchange", showView);
  const local = location.protocol === "file:";
  const bundled = window.POLICY_FEED;
  const empty = { mode: "live", days: [], sources: [], items: [], aiEnabled: true };
  showFeed((local || bundled?.mode === "live") && bundled ? bundled : empty);
  showView();
  if (!local) {
    refreshStatus.textContent = loadingFeed;
    loadFeed("/latest").then(snapshot => {
      if (!feed.generatedAt || Date.parse(snapshot.generatedAt) > Date.parse(feed.generatedAt)) showFeed(snapshot);
      if (refreshStatus.textContent === loadingFeed) refreshStatus.textContent = "";
    }).catch(() => {
      if (refreshStatus.textContent === loadingFeed) refreshStatus.textContent = "暂时无法读取已保存的资讯。";
    });
  }
})();
