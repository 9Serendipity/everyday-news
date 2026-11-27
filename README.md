# 政策雷达

一个用 GitHub Pages 托管的中文政策资讯网站。收录中国政府网、国家发改委、人民银行、证监会、国家数据局、工信部、国家统计局和金融监管总局的公开发布，提供简报、资讯筛选、原文链接和信源状态。

## 浏览和更新

点网站的「刷新资讯」后采集八个官方信源，查询北京时间当天和前一天的发布。新资讯先显示，解读完成后会在同页补上。已有解读会直接复用。

打开网站时加载上一次手动刷新保存的结果。在两次手动刷新之间，页面显示的日期范围和资讯以保存的结果为准。

双击打开 `site/index.html`，可离线查看随源码附带的演示快照。使用 Node.js 24 运行以下命令，可在本机采集公开资讯并更新页面数据。

    npm ci --ignore-scripts
    npm run refresh
    npm run check

单个信源采集失败时，会保留本次日期范围内已收录的记录，并显示信源状态。全部信源采集失败时，继续显示上次保存的结果。

## 发布到 GitHub Pages

1. 将源码提交到仓库的 `main` 分支，保留 `.github/workflows/publish.yml`。
2. 在仓库 **Settings → Pages → Build and deployment** 将 **Source** 设置为 **GitHub Actions**。
3. 到 **Actions → 更新并发布政策雷达** 手动运行，或提交一次更新触发部署。上线地址会显示在 Pages 设置和部署任务中。

GitHub Actions 在提交代码或手动发布时部署静态文件。手动刷新结果由实时资讯服务保存并供不同设备读取。首次手动刷新前可读取原有的 `feed-archive` 发布快照。

[GitHub Pages 工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 启用 DeepSeek

生产环境在实时资讯服务中配置 `DEEPSEEK_API_KEY`。网站手动刷新后按文章保存解读结果，每小时最多尝试 50 条。用于解读的数据包括官方新闻标题、发布日期和正文的有限片段。

本机运行也可通过环境变量配置 `DEEPSEEK_API_KEY` 和可选的 `DEEPSEEK_MODEL`，默认模型为 `deepseek-flash`。

[GitHub Actions 密钥文档](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets) · [DeepSeek API 文档](https://api-docs.deepseek.com/api/create-chat-completion/)
