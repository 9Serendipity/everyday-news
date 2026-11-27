# 政策雷达

一个用 GitHub Pages 托管的中文政策资讯网站。收录中国政府网、国家发改委、人民银行、证监会和国家数据局当天的公开发布，提供简报、资讯筛选、原文链接和信源状态。

## 浏览和更新

在网站点「刷新资讯」即可查询五个官方信源。新资讯先显示，解读完成后会在同页补上。即时和定时解读共用一份结果，已有解读会直接复用。GitHub Actions 定时更新公开归档。

双击打开 `site/index.html`，可离线查看随源码附带的演示快照。使用 Node.js 24 运行以下命令，可在本机采集公开资讯并更新页面数据。

    npm ci --ignore-scripts
    npm run refresh
    npm run check

采集按北京时间的发布日期筛选。公开数据只保留当天收录的记录，页面在北京时间零点切换日期。采集失败时会保留当天之前已取得的记录，并显示信源状态。

## 发布到 GitHub Pages

1. 将源码提交到仓库的 `main` 分支，保留 `.github/workflows/publish.yml`。
2. 在仓库 **Settings → Pages → Build and deployment** 将 **Source** 设置为 **GitHub Actions**。
3. 到 **Actions → 更新并发布政策雷达** 手动运行，或提交一次更新触发部署。上线地址会显示在 Pages 设置和部署任务中。

工作流计划在每小时第 17 分钟运行，实际启动时间取决于 GitHub 调度。工作流用 `feed-archive` 分支保存公开资讯归档，分支由首次成功采集自动创建。仓库需允许工作流的 `GITHUB_TOKEN` 写入归档分支。

[GitHub Pages 工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 启用 DeepSeek

生产环境在实时资讯服务中配置 `DEEPSEEK_API_KEY`。服务按文章保存结果，即时和定时任务合计每小时最多调用 50 次。工作流通过 `ANALYSIS_SERVICE_URL` 使用同一个服务，手动运行时可以填写 0 到 50，填 0 仅采集。用于解读的数据包括官方新闻标题、发布日期和正文的有限片段。

本机运行也可通过环境变量配置 `DEEPSEEK_API_KEY` 和可选的 `DEEPSEEK_MODEL`，默认模型为 `deepseek-flash`。

[GitHub Actions 密钥文档](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets) · [DeepSeek API 文档](https://api-docs.deepseek.com/api/create-chat-completion/)
