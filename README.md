# 实战簿 · Repo to Practice

把一个 GitHub 项目或职位要求变成一项带出处、可验收的练习，再保存成果和面试追问。每张实战卡包含针对目标编写的操作步骤和专属带教入口。Repository 简称 repo，是 GitHub 上存放项目代码和文档的地方。

## 在线试用

[打开实战簿](https://lll-vic.github.io/repo-to-practice/)即可试用。第一次可以选「视频生成评测」，留空 GitHub Repository，点「生成实战卡」→「开始带教」，用内置模拟样片走完一次评测。

## 本地运行

需要 Python 3 和现代浏览器。在项目目录运行：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

打开 [本地工作台](http://127.0.0.1:8765)。也可把静态文件部署到 GitHub Pages，无需构建步骤、后端或 API 密钥。

1. **有看中的项目。** 粘贴公开 repository 的首页链接，填写能力目标，生成实战卡。读取失败时也可以手动粘贴 README。
2. **只有能力目标。** 把 Repository 留空，输入技能或粘贴一段岗位要求，从推荐项目中选一个生成实战卡。每个项目显示 GitHub 维护账号、stars 和匹配的搜索词。
3. **完成并记录。** 填写实际结果，可附上 commit、测试报告或演示链接。在「我的记录」回看面试追问或导出 Markdown。

「项目看板」可以查看近 30 天创建的 GitHub 热门项目或累计热门项目。列表使用 GitHub Search API 按累计 Stars 排序，并标明数据更新时间。「适合你练」根据你提交的目标、最近一次保存的练习或选定的方向搜索，列出匹配的关键词，优先展示尚未保存过练习记录的 Repository。

**视频生成评测。** 选「视频生成评测」或输入类似目标，留空 Repository 也可以生成实战卡。点「开始带教」后，选用两段内置模拟样片或自己的生成视频，设定共用 Prompt 与对照条件，按四项标准打分并记录时间戳。带教会汇总两段视频的总分和最大分差，并把评测报告填入实战记录。自己的视频文件只在浏览器中用于播放，记录里保留文件名或链接。

右上角可切换中文和英文。可以用「试用离线示例」体验流程。界面和当前实战卡会切换语言，用户输入、GitHub 原文和已保存的成果保留原语言。

## 设计与边界

- **发现项目。** 从技能或岗位要求中本地提取至多两个查询，再通过 [GitHub Search REST API](https://docs.github.com/en/rest/search/search#search-repositories) 搜索。全文不会发送给 GitHub。优先保留与关键词匹配、来自不同维护账号的项目，stars 用来帮助判断社区关注度。
- **可追溯的来源。** 通过 [GitHub REST API](https://docs.github.com/en/rest/repos/contents) 将 README 摘录和 root directory 路径固定到 default branch 的某个 commit。File 和 Directory 候选仅按路径匹配。手动粘贴的材料不与 GitHub 上的内容核对。
- **规则生成。** 按目标关键词选择练习类型，对 README 段落和路径排序，再生成练习和验收标准。目前提供视频生成评测、AI 评测、产品拆解、测试与调试、架构理解、性能分析等练习。未覆盖的技能会采用通用带教流程，并结合填写的目标和卡片引用的材料。追问结合填写的目标和成果。首版不调用大模型。
- **本地记录。** 成果和语言偏好保存在当前浏览器。清除站点数据会删除记录，可以把重要成果导出为 Markdown。
- **实时读取有配额。** [GitHub REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#primary-rate-limit-for-unauthenticated-users) 对匿名请求有限额，搜索还有更严格的限额。界面在搜索失败时仍提供 GitHub 网页搜索入口。离线示例和手动粘贴不需要访问 API。

## 灵感

灵感来自小红书博主分享的《Learn from GitHub》。实战簿从求职能力练习出发独立实现，可以根据岗位要求找项目，再把做过的练习保存为可回顾的成果。
