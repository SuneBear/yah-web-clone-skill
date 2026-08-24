# Yah Web Clone v3 产物与验收

## 目录原则

只创建模式需要的目录：

```text
<project>/
├── site/                 # full、mirror
├── cases/                # collection
├── lab/                  # full、effect；collection 可选
├── docs/                 # full、effect、collection
└── .clone/              # 仅过程阶段存在
    ├── project.json
    ├── evidence/
    └── work/             # 临时、Git 忽略、验收后清理
```

最终交付前运行 `yah.mjs catalog`、`yah.mjs validate --strict --write` 和 `yah.mjs finalize`：先检查内容分类、模式目录、独立学习源码、分析、媒体、证据与根命令，再把 `.clone/evidence/` 提升到 `docs/evidence/`，把预览与部署组合脚本提升到 `scripts/`，生成无本机绝对路径的 `clone.config.json`，验证根运行命令后删除 `.clone/`。最终项目不得继续依赖 `.clone/`。

不要创建 `RECON/`、`study-src/`、空的分类目录或只为预览服务的 Storybook。根目录 `npm run dev` 必须能直接打开当前模式的主要交付面。

除非用户明确指定其他语言，README、分析、运行说明、GitHub description 和交付说明使用中文；`site/` 的原站文案保持原语言，不做翻译。

所有模式在任何抓取或重建前完成 `source_discovery`，记录源码候选或有边界的 code no-match。使用素材时同时登记 original/replacement/reference/presentation 角色；内部来源可省略 revision、checksum 和 license。

## `full` 验收

- `site/` 从 web 根运行，保留原布局、内容、资产、交互与响应式。
- `lab/effects/<effect>/` 的每个核心效果都有独立入口，不依赖整站框架才能启动。
- 可以保留依赖 `site/` 的 RAW REPLAY 作为权威 baseline，但至少另有一个 PROJECTIZE 实现从可读 Lab 源码独立运行。
- 默认 Preset 对应原版；额外 Preset 清楚标为 variations。
- 只有确实需要实时调试时引入 Dialkit，并避免把 GUI 打进 `site/`。
- `docs/ANALYSIS.md` 使用中文，包含一句话原理、技术结构、参数、证据等级、差异、迁移说明和已知缺口。
- `docs/media/` 只保留 README/分析实际引用的桌面、移动端和关键状态截图。
- 过程阶段 `.clone/evidence/` 只保留来源、镜像摘要、覆盖、失败项与 diff 指标；最终在 `docs/evidence/` 保留这些精简证据和工作流摘要。
- 发布版保持 `site/` 与 `lab/` 源目录分离，但 `full` 的生产 URL 必须同时提供 `/` 与 `/__lab/`。使用临时组合目录完成挂载，不复制回 `site/`。

## `mirror` 验收

- 过程阶段只包含 `site/`、README、根运行脚本和最小 `.clone/evidence/`；最终把证据提升到 `docs/evidence/`，但不创建 `docs/ANALYSIS.md` 或 `docs/media/`。
- 不包含技术解构、GUI、Preset、格式化重建或重复截图集。
- 记录为了离线运行而做的路径、字体、追踪和静态托管改动。
- 验证主要路由、资源、响应式、Canvas/WebGL 与 console/page error。
- 列出仍依赖联网的字体、视频、API 或 CDN。

## `effect` 验收

- 明确效果边界、触发、输入、目标视口和关键状态，不复制无关页面。
- RAW REPLAY 先通过 baseline；工程化版本再进入 `lab/effects/<effect>/`，且至少一个实现不依赖整站。
- 效果入口包含运行所需的 HTML/CSS/JS/资源或明确的构建配置。
- 原版默认参数与派生 Preset 分开，所有猜测值标为 `GUESS`。
- `docs/ANALYSIS.md` 包含依赖、参数、来源、差异、验证结果和迁移方法。

## `collection` 验收

- 至少包含两个成员；每个成员有唯一 slug、绝对 URL、状态和 `reference-only`、`mirror`、`effect` 或 `full` treatment。
- `cases/index.html` 可从项目根直接预览，列出全部成员；只为确实需要本地运行的成员创建 `cases/<slug>/`。
- 每个成员有 `docs/cases/<slug>.md`，覆盖观察、来源证据以及它对集合共性、差异或反例的贡献。
- `docs/COMPARISON.md` 提供横向矩阵；`docs/SYNTHESIS.md` 提炼共性、差异、反例和可迁移方法；只有研究问题明确需要时才增加 Design DNA。最终交付不保留占位符。
- 集合级和成员级 Catalog 都来自稳定配置；README 分类与 GitHub Topics 可重新投影。
- `lab/` 可省略；一旦存在就必须有可读源码和静态入口或 `build:lab`，并部署到 `/__lab/`。
- `reference-only` 不声称 1:1；其余成员分别继承对应模式的忠实度门槛。
- 纯 `reference-only` Collection 可直接使用 provider 详情页和原站链接，不强制保存本地截图或录屏。
- `yah collection sync --apply` 后 `cases/index.html` 与 README 来源区必须匹配 Meta；有 `assets` 时显示允许呈现的预览和来源链接。
- 每个成员只保留被文档引用的精选媒体和必要运行资产；完整重型 `full` 优先拆到独立 `<slug>-clone` 仓库。

## 文档媒体

通常保留 3-6 张真正有辨识度的图片：桌面 Hero、移动端、关键特效状态或交互前后。优先 WebP；需要像素 diff 的原始 PNG 留在 `.clone/work/`，只在它本身是证据时提升到 `.clone/evidence/`。

只有截图无法表达时序且录制成本低时保留短录屏。必须等待页面 ready、字体和显式加载层完成，再裁掉全部 Loading 前摇；抽查开头、中间、结尾。默认不超过用户配置的 `maxRecordingSeconds`，默认 MP4、可选 WebM，只保留一种编码，不同时提交 GIF 与视频。

## 忠实度报告

只有证据支持时才声称 1:1。至少记录：

- 覆盖的路由、视口和交互状态。
- 原站与克隆的关键截图或多帧采样。
- visual diff 指标和无法自动比较的区域。
- console/page errors。
- 离线依赖与第三方请求。
- 明确的已知缺口。

## 体积闸门

结束前执行 `yah.mjs clean` dry-run、提升有价值证据、`yah.mjs clean --apply`、`yah.mjs size`，最后执行 `yah.mjs finalize` dry-run 与 `--apply`。按以下顺序减小体积：

1. 删除 `.clone/work/`、构建缓存、未筛选截图和失败下载。
2. 删除重复媒体、重复依赖和无引用归档。
3. 压缩 `docs/media/`，缩短或放弃低优先级录屏。
4. 若超额来自 `site/` 运行必需资产，保留本地真实性并调整 Git/部署策略，不擅删资源。

## 发布验收

- GitHub visibility、组织和 publish mode 与配置一致。
- 不提交 `.clone/work/`、最终生成的 `dist/`、`node_modules`、缓存、日志或无用大文件。
- 部署内容与本地验证的 commit/build 相同。
- `full` 验证线上 `/__lab/` 与核心效果入口；Collection 存在 Lab 时同样验证。Lab 需要构建时记录构建命令、输出目录和 public base。
- 验证生产域名、根入口、深层路由、资源 MIME 与视频 Range 请求。
- README、GitHub homepage/description 和生产 URL 一致。
