# 政策雷达

一个用 GitHub Pages 托管的中文政策资讯网站。收录中国政府网、国家发改委、人民银行、证监会和国家数据局的公开发布，提供按日简报、资讯筛选、原文链接和信源状态。

## 浏览和更新

双击打开 `site/index.html`，可离线查看随源码附带的演示快照。使用 Node.js 24 运行以下命令，可在本机采集公开资讯并更新页面数据。

    npm ci --ignore-scripts
    npm run refresh
    npm run check

采集失败的信源会在页面中显示状态，已归档的资讯会保留。默认每个来源拉取最新 12 条，归档最多保留最新 450 条。原文链接可分别核对来源及发布时间。页面里的简报按北京时间的发布日期汇总。

## 发布到 GitHub Pages

1. 将源码提交到仓库的 `main` 分支，保留 `.github/workflows/publish.yml`。
2. 在仓库 **Settings → Pages → Build and deployment** 将 **Source** 设置为 **GitHub Actions**。
3. 到 **Actions → 更新并发布政策雷达** 手动运行，或提交一次更新触发部署。上线地址会显示在 Pages 设置和部署任务中。

工作流计划在每小时第 17 分钟运行，实际启动时间取决于 GitHub 调度。工作流用 `feed-archive` 分支保存公开资讯归档，分支由首次成功采集自动创建。仓库需允许工作流的 `GITHUB_TOKEN` 写入归档分支。

[GitHub Pages 工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 启用 DeepSeek

在仓库 **Settings → Secrets and variables → Actions → Secrets** 添加名为 `DEEPSEEK_API_KEY` 的仓库密钥，然后重新运行发布工作流。可在同页的 **Variables** 设置 `DEEPSEEK_MODEL`，默认使用 `deepseek-flash`。工作流每次最多解读 6 条资讯，已有解读会随归档保留。分析只接收官方新闻标题、发布日期和正文的有限片段。

[GitHub Actions 密钥文档](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets) · [DeepSeek API 文档](https://api-docs.deepseek.com/api/create-chat-completion/)
