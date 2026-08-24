---
name: yah-web-clone
description: >
  Yah Web Clone v3 网站复刻工作流，先自动发现并核验目标源码、素材或 Inspiration，再按 full、mirror、effect 或 collection 模式交付可验证镜像、效果实验或参考集合；支持可恢复编排、结构化 Meta、workspace 即时检索、GitHub Topics 与可选发布。Use when 用户明确指定 Yah Web Clone、$yah-web-clone，或要求产出网站 clone/mirror、离线缓存、单效果复刻、Yah Collection、可迁移实验代码及其分类或发布；普通设计推荐或素材搜索若不要求形成 Yah 项目，不应单独触发本 Skill。
---

# Yah Web Clone v3

交付可直接运行、可验证且不过度膨胀的复刻项目。不要把“严格复刻”改成风格参考或品牌重设计。

## 先选一个模式

| 模式 | 用户意图 | 默认产物 |
|---|---|---|
| `full` | 1:1 克隆，并做实现解构 | `site/` + `lab/` + `docs/` + 精简证据 |
| `mirror` | 只克隆，作为本地缓存 | `site/` + 最小镜像清单 |
| `effect` | 只复刻某个效果 | `lab/` + `docs/` + 效果证据 |
| `collection` | 收录多个相似网站并比较、提炼 | `cases/` + `docs/` + 可选 `lab/` |

默认模式始终是 `full`。只有用户明确说“只缓存”“不要分析”、显式传入 `--mode mirror`，或本机配置明确覆盖时才使用 `mirror`；只有用户明确只要单个效果时使用 `effect`。用户输入多个相似网站并要求收录、列表、比较或总结共性时使用 `collection`；CLI 收到多个 `--url` 时也会自动选择它。意图不明确时不要猜成更轻的模式。不要再把泛化的 `analysis`、`study` 当成交付模式。

单站与单效果项目统一命名为 `<slug>-clone`。把已有的 `-clone`、`-mirror` 或叠加后缀归一为单个 `-clone`；`mirror` 只作为模式名。Collection 使用主题名且不加 `-clone`，如 `nature-sketches`。不要自动重命名已有仓库，除非用户明确要求迁移远端、部署与链接。

## 初始化

初始化前先读 `references/discovery.md`，确定本轮需要检索源码、素材还是 Inspiration。先用目标域名、标题、作者/工作室、独特文案与 credits 做定向发现；素材同时检查字体、图片、视频、3D 模型、纹理、音频和图标的原始出处与完整性。完成检索后再初始化项目并用 `yah source` 登记结果；revision、checksum 和 license 是可选的可复现信息，内部仓库与内部素材无需为了通过流程补填。相似实现或替代素材只能标为 `PARTIAL`，不得冒充原站来源。

Yah 必须能独立运行，不依赖 Sune Library。当前环境恰好提供 `sune-library` 时，可先用它检索个人书签和 Source Registry；不可用或命中不足时，直接使用用户给定清单、公开源码平台、通用 Web 搜索和 discovery 文档的 fallback seeds，不得因此阻塞克隆。

优先使用统一 CLI：

```bash
YAH="$HOME/.codex/skills/yah-web-clone/scripts/yah.mjs"
node "$YAH" init <站名> --url <原站URL> --mode full --authorized
```

初始化后运行有边界的候选发现；默认 dry-run，加 `--apply` 后才把候选与 adapter 状态写入项目证据。候选不会自动成为 `SOURCE`：

```bash
node "$YAH" discover --project "$YAH_PROJECT"
node "$YAH" discover --project "$YAH_PROJECT" --apply
```

初始化后登记最终采用的精确源码；最后一条发现记录加 `--complete` 闭合阶段：

```bash
node "$YAH" source --project "$YAH_PROJECT" \
  --kind repository --source https://github.com/owner/repo \
  --revision <commit> --relation exact \
  --path site --evidence SOURCE --complete
```

源码未命中也要形成可验证结论：

```bash
node "$YAH" source --project "$YAH_PROJECT" --no-match --scope code \
  --note "查过的身份线索、平台和后续部署资产路线" --complete
```

单效果复刻：

```bash
node "$YAH" init <站名> --url <原站URL> \
  --mode effect --effect "液态折射 Hero" --authorized
```

Collection 可重复传入 URL；两个以上 URL 且未显式指定模式时会自动进入 `collection`：

```bash
node "$YAH" init nature-sketches --mode collection \
  --url https://example-a.com --url https://example-b.com
```

只有用户明确要求发布，或用户配置声明发布目标时，才加 `--publish github,cloudflare`；用户明确说不发布时加 `--publish none` 覆盖本机配置。初始化器已经内置以下默认契约，无需让用户重复写长 prompt：

- 保证镜像/效果忠实；做不到时先报告具体缺口，不用相似设计冒充 1:1。
- `full` 自动要求中文分析、关键截图、来源等级、可运行效果代码、必要时 Dialkit GUI 与 Preset。
- `mirror` 不生成分析或实验室，只保留运行必需内容与最小证据。
- `effect` 先建立忠实 baseline，再格式化为独立可运行实验；参数化不得改变默认 Preset 的原版表现。
- `collection` 为每个成员选择 `reference-only`、`mirror`、`effect` 或 `full`，分别验收后再做横向比较；不把整个集合笼统声称为 1:1。
- 所有模式从项目根目录执行 `npm run dev`；不依赖 Storybook 或另一个 Site 工程。
- 录屏是低优先级：只有截图无法表达关键时序且成本低时，才保留短录屏；默认交付 MP4，也可按用途选择 WebM。

工作区配置优先级为 `--root`、`YAH_WEB_CLONE_ROOT`、`${YAH_WEB_CLONE_CONFIG:-~/.config/yah-web-clone/config.json}`、当前目录。配置可包含 `workspaceRoot`、`githubOrg`、`repoVisibility`、`docsLanguage`、`publishMode`、`deploymentProvider`、`defaultMode`、`publishTargets`、`viewports`、`maxProjectSizeMB`、`maxSingleFileMB`、`maxRecordingSeconds`、`labBuildCommand`、`labOutputDir` 与 `labMountPath`。

### 语言契约

默认 `docsLanguage=zh-CN`。除非用户明确指定其他语言，README、`docs/`、运行说明、代码解释性注释、GitHub description 和交付说明全部使用中文；库名、API、变量名和必要术语可保留英文。不要翻译或改写 `site/` 中的原站文案，原站内容语言属于 1:1 镜像的一部分。

### 检索分类

完成侦察后为每个项目填写内容分类，供 GitHub、README 全文索引与可选 Library 检索。把 `clone.config.json.catalog` 作为项目分类源；Collection 成员使用 `collection.members[].catalog`。核心 tags 记录技术、能力、视觉与主题；`facets` 记录形态、素材类型、行业、色彩、平台和建站工具；`keywords` 保留中文与自然语言。README 分类区和 GitHub Topics 由 `yah catalog` 投影，不要手工维护，也不要再复制一份默认 `DESIGN.md`。

```bash
node "$YAH" catalog --project "$YAH_PROJECT" \
  --technology threejs,webgl2,glsl \
  --capability interactive-3d,gpu-simulation \
  --visual-style underwater,organic-motion \
  --subject coral,marine-life \
  --artifact hero,brand-site --asset-type 3d-model,texture --industry technology \
  --palette dark,blue --platform web --builder custom \
  --keywords "水下珊瑚,海洋生物,GPU 动画" --apply
```

Collection 成员用 `--case <slug>` 分类。成员可保留丰富 tags/facets，不再全部挤入 GitHub Topics；默认只投影项目级核心 tags，必要时用 `--github-topics <csv>` 从项目或成员核心 tags 中精选不超过 20 个仓库级 Topics。

命令默认 dry-run。创建 GitHub 仓库后再加 `--github --apply` 同步精选 Topics。只有 facets/keywords 的 reference-only 案例也属于合法 Catalog，不强迫猜测技术标签。读取 `references/catalog.md` 获取字段、规范词和同步规则。

Yah 的 workspace `index/search` 只按需扫描项目 Meta，不维护长期数据库。读取 `references/automation.md` 获取发现 adapter、即时检索、可恢复 runner 与旧项目迁移规则。

### 可恢复执行

`yah run`/`yah resume` 默认只预览未完成阶段；加 `--apply` 后执行 Yah 内置安全步骤与项目显式声明的 `npm run yah:<stage>` hook。没有确定性 handler、需要来源采用或视觉判断时，保存状态并停在 review gate，不从 Meta 执行任意 shell 字符串。

```bash
node "$YAH" run --project "$YAH_PROJECT"
node "$YAH" resume --project "$YAH_PROJECT" --apply
```

## 简约目录契约

按模式创建目录，不创建空壳：

```text
<project>/
├── site/                 # 原样镜像；仅 full、mirror
├── cases/                # Collection 列表与成员入口；其他模式不创建
├── lab/                  # full、effect；collection 按需创建
├── docs/                 # 中文分析与精选媒体；mirror 模式不创建
├── .clone/               # 过程目录；最终交付前完成提升并删除
│   ├── project.json      # 过程状态，不原样进入最终交付
│   ├── evidence/         # 待提升的精简机器证据
│   └── work/             # 临时抓取与中间产物，验收后清理
├── README.md
└── package.json
```

不要创建 `RECON/`、`study-src/` 或独立 Storybook。把给人看的结果放 `docs/`，把可运行重建放 `lab/`，把单站原镜像放 `site/`，把 Collection 列表与成员入口放 `cases/`。

最终交付结构不再依赖隐藏过程目录：

```text
<project>/
├── site/                 # full、mirror
├── cases/                # collection
├── lab/                  # full、effect；collection 可选
├── docs/
│   ├── ANALYSIS.md       # full、effect
│   ├── COMPARISON.md     # collection
│   ├── SYNTHESIS.md      # collection
│   ├── cases/            # collection 的逐项分析
│   ├── media/            # 精选截图/低成本短录屏
│   └── evidence/         # 精简机器证据与 workflow-summary.json
├── scripts/              # 可重复预览与部署组合脚本
├── clone.config.json     # 无本机绝对路径的最小稳定配置
├── README.md
└── package.json
```

### 保留、提升与清理

- 在过程阶段的 `.clone/evidence/` 只保留来源登记、镜像清单摘要、失败项、覆盖结果、diff 指标和支撑关键结论的最小证据；最终提升到 `docs/evidence/`。
- 在 `.clone/work/` 放 HAR、完整 source map、帧转储、临时下载、未筛选截图和中间构建；默认 Git 忽略。
- 把最终截图移到 `docs/media/`，只留桌面、移动端和关键状态。不要同时保存 PNG、WebP 和重复尺寸。
- 不保留无引用的完整录屏、重复依赖、构建缓存、`node_modules` 或失败探索。不要为了减小体积删除 `site/` 运行必需资产。
- 需要保存旧实现时才创建 `.clone/archive/<timestamp>-<label>/`，并说明继续保留它的理由。

验收后先预览清理范围，再执行清理与最终提升：

```bash
node "$YAH" clean --project "$YAH_PROJECT"
node "$YAH" clean --project "$YAH_PROJECT" --apply
node "$YAH" size --project "$YAH_PROJECT"
node "$YAH" catalog --project "$YAH_PROJECT"
node "$YAH" validate --project "$YAH_PROJECT" --strict --write
node "$YAH" finalize --project "$YAH_PROJECT"
node "$YAH" finalize --project "$YAH_PROJECT" --apply
```

`finalize` 默认只做 dry-run。`--apply` 必须确认必需阶段完成、`.clone/work/` 已清空、archive 已明确处置，然后提升证据、可重复运行脚本、部署脚本和稳定配置；它会暂时移开 `.clone/` 验证最终结构，失败则恢复，成功才删除。绝不允许为了删 `.clone/` 丢失有价值证据、脚本或让 `npm run dev` / `npm run build:deploy` 失效。

体积超预算时先删除临时物和重复证据，再压缩文档媒体；若体积来自镜像必需的大资产，如实报告并调整发布方案，不破坏复刻。

## 按模式执行

### `full`

1. 完成 `source_discovery`，登记精确源码、未命中结论或降级路线；再按“来源决策树”获得 `site/`，先保证原样可运行。
2. 抓取页面、路由、交互、网络与 source map 到 `.clone/work/`。
3. 将来源、覆盖、失败项和差异摘要提升到 `.clone/evidence/`。
4. 在 `lab/effects/<effect>/` 保留可验证的 RAW REPLAY baseline，并提供至少一个不依赖 `site/` 的 PROJECTIZE 学习实现；再格式化、命名和拆分。
5. 在需要实时调参时加入 Dialkit；为可调效果提供原版默认值和至少三个有辨识度的 Preset。
6. 在 `docs/ANALYSIS.md` 写中文实现分析、证据等级、关键文件导航、参数和迁移说明。
7. 采集原站与本地版本的路由 × 视口 × 状态矩阵；把少量关键图移到 `docs/media/` 并在 README 引用。截图无法表达时间或交互时，使用 `yah.mjs record` 等待 ready 条件后录制并裁掉 Loading 前摇。
8. 本地与生产验收完成后清理 `.clone/work/`，检查体积，运行 `validate --strict --write`；通过后再 `finalize` 提升长期内容并删除过程目录。

### `mirror`

1. 完成 `source_discovery`；优先复制与目标精确对应的完整仓库源码，revision 可用时记录但不作为内部项目门槛；否则用 `mirror-site.mjs` 捕获部署资产。
2. 只修复离线路径、必要的第三方自托管、追踪移除与静态托管适配，并记录这些改动。
3. 验证首页、深层路由、关键资源、响应式和 console/page error。
4. 保留 `.clone/evidence/mirror/` 的最小清单；不创建技术分析、GUI、Preset 或重建代码。
5. 清理临时物并报告仍需联网的依赖。`mirror` 表示缓存方式，不降低忠实度要求。

### `effect`

1. 完成 `source_discovery`，再明确效果边界、触发条件、输入、目标视口和关键帧；不要顺手克隆整站。
2. 按证据优先级定位真实实现，将原始捕获放 `.clone/work/`，只提升关键证据。
3. 先做最小 RAW REPLAY，不换框架、不优化、不补偿性调参；逐帧或多状态对照通过后，才工程化到 `lab/effects/<effect>/`。最终至少有一个不依赖整站的可读实现。
4. 默认 Preset 必须忠实于原版；额外 Preset 和参数用于探索 variation，并清楚区分原版值与派生值。
5. 保证效果可从 `npm run dev` 直接预览，并在 `docs/ANALYSIS.md` 写依赖、参数、证据、差异与迁移方法。

### `collection`

1. 完成 `source_discovery`；把研究问题、成员 URL、provider/sourcePage、排序、状态与处理方式写入过程配置；需要素材呈现时把素材的 type、role、来源、可选许可、本地路径或允许使用的 previewUrl 写入成员 `assets`。至少包含两个成员，成员分别使用 `reference-only`、`mirror`、`effect` 或 `full`。
2. 运行 `yah collection sync --apply` 从 Meta 重建 `cases/` 与 README 来源区。只分析的成员同时链接 provider 详情页和原站；需运行的成员提供独立路由。完整单站 `full` 通常拆到独立 `<slug>-clone` 仓库并从 Collection 链接，避免集合无限膨胀。
3. 在 `docs/cases/<slug>.md` 逐项记录观察、实现、证据和它对集合结论的支持或反驳；在 `docs/COMPARISON.md` 做横向矩阵，在 `docs/SYNTHESIS.md` 提炼共性、差异、反例与可迁移方法。只有研究问题明确需要时才增加 Design DNA。
4. 只有跨案例提炼出的实验才进入可选 `lab/`；Lab 可以是静态目录或由 `build:lab` 构建，并在存在时发布到 `/__lab/`。
5. 同时填写集合级与成员级 Catalog；纯 `reference-only` 集合优先链接 provider 预览、素材来源页与原站，不要求自制截图/录屏。只有内部素材或已核实可以呈现且 URL 稳定时才保存 previewUrl；含 mirror、effect 或 full 成员时仍保留支撑验收的最小本地媒体。

所有模式先读取 `references/discovery.md`。执行 `collection` 时读取 `references/collection.md`。读取 `references/effect-extraction.md` 获取 RAW REPLAY、证据分级和 baseline 闸门；读取 `references/deliverables.md` 获取各模式验收清单；分类或同步 GitHub Topics 时读取 `references/catalog.md`。用户明确要设计系统或风格变体时才读取 `references/design-dna.md`。需要录制动效时读取 `references/motion-capture.md`。只有静态部署镜像时读取 `references/static-mirror.md`；只有发布 Cloudflare 时读取 `references/cloudflare-pages.md`。

使用自动候选发现、workspace 检索、runner/resume 或旧项目迁移时读取 `references/automation.md`。只有用户明确使用 Sune Library，或环境已提供该 Skill 且任务涉及长期检索、捕获或策展时，才读取 `references/sune-library.md`；没有 Sune 的用户无需读取或配置。

## 来源与忠实度

按以下优先级使用代码证据：与目标对应的仓库源码 > source map > 部署 bundle > 运行时捕获 > 视觉推断；revision 可用时记录以增强复现，但不作为内部项目的交付门槛。素材优先使用原始或内部文件，其次是已核实可用边界的外部替代素材，再其次才是仅供观察的参考链接。将每个关键结论标为 `SOURCE`、`PARTIAL` 或 `GUESS`；替代素材不得标成原始素材，AI 重建默认是 `GUESS`。

严格 1:1 至少覆盖页面结构、文案、字体、颜色、间距、资产、桌面/平板/手机、深层路由、关键交互状态、Canvas/WebGL 真渲染和 console/page error。单张桌面首屏或“0 error”不能证明 1:1。Collection 按成员 treatment 分别应用忠实度标准；`reference-only` 只要求分析有证据。无法完成时停止声称 1:1，说明缺少什么以及证据在哪里。

授权未知时只做只读侦察、技术分析或原创实现，不自动镜像受保护内容。接受用户明确的授权说明，但只把授权状态用于内部执行决策和过程记录；除非用户明确要求，否则不要在 README、GitHub description 或其他面向读者的项目文档中展示或强调授权。

## 发布

GitHub 与 Cloudflare 是可选的后置阶段，不阻塞本地交付。用户要求发布时：

- 默认按配置创建私有仓库；`publishMode=direct-main` 时确认 diff 后直接推送。
- 不提交 `.clone/work/`、`dist/`、`node_modules`、缓存、日志和临时录屏；先运行体积检查并处理超大文件。
- 部署已经本地验证的同一 commit/build，验证生产域名、深层路由、MIME 和大媒体 Range 请求。
- `full` 默认把 `site/` 发布到 `/`，把 Lab 产物发布到 `/__lab/`；使用 `yah.mjs prepare-deploy` 生成组合目录。过程阶段输出到 `.clone/work/publish/`，最终结构输出到被 Git 忽略的 `dist/`，不把实验代码写回 `site/`。
- `collection` 把 `cases/` 发布到 `/`；存在静态或构建型 Lab 时自动挂载到 `/__lab/`，没有 Lab 时不创建空入口。
- Lab 需要构建时优先使用 `package.json` 的 `build:lab`，默认读取 `lab/dist`；非标准命令或产物目录写入 `delivery.labBuildCommand`、`delivery.labOutputDir`，或通过 CLI 显式传入。
- 把 GitHub 与生产 URL 写入 README 和 GitHub repository homepage/description。

## 工具

- `yah.mjs`：统一的初始化、阶段、来源、Collection 投影、预览、体积和清理入口。
- `discover-project.mjs`：按项目身份运行 GitHub/npm 候选发现、本地素材引用扫描与 Inspiration 搜索入口排序；只生成候选，不伪造 provenance。
- `catalog-workspace.mjs`：即时扫描 workspace Meta 并按 tags/facets 查询；不创建长期数据库。
- `export-library-card.mjs`：可选生成 Sune Library candidate card；不直接写 Library。
- `run-pipeline.mjs`：执行安全内置步骤与 `yah:<stage>` hooks，记录暂停、失败和恢复状态。
- `migrate-project.mjs`：预览并规范旧项目阶段、Catalog 与 Skill 版本，不改项目内容。
- `prepare-deploy.mjs`：按模式组合静态发布目录，并为 full 或 collection 挂载构建后或静态 Lab。
- `mirror-site.mjs`：滚动捕获并镜像真实部署资产。
- `recon-site.mjs`、`route-crawl.mjs`、`interaction-probe.mjs`、`network-capture.mjs`：把过程输出写入 `.clone/work/`。
- `sourcemap-hunt.mjs`：在 `.clone/work/` 恢复 source map；只提升真正有引用价值的模块。
- `capture-matrix.mjs`、`visual-diff.mjs`、`compare-recon.mjs`：生成覆盖与差异证据。
- `source-provenance.mjs`：登记源码 relation/revision、素材 role/checksum、许可与证据等级，也可登记有边界的 no-match；统一入口为 `yah source`。
- `sync-collection.mjs`：从稳定 Meta 重建 README 来源区和 `cases/index.html`，统一入口为 `yah collection sync`。
- `catalog-project.mjs`：以稳定配置为分类源，生成 README 分类区并按需同步 GitHub Topics。
- `validate-deliverables.mjs`：按模式检查目录、独立 Lab 源码、分析、媒体、证据和根命令；`finalize` 强制通过 strict 验收。
- `record-motion.mjs`：等待页面 ready 与加载层消失后执行交互录屏，裁掉 Loading 前摇，默认输出 MP4、可选 WebM。
- `archive-project.mjs`：按需保存旧实现到 `.clone/archive/`，只复制、不删除。
- `finalize-project.mjs`：提升长期内容、验证最终布局并安全删除 `.clone/`。
- `project-size.mjs`、`cleanup-project.mjs`：过程阶段清理 `.clone/work/`；最终阶段清理忽略的 `dist/`，并报告体积。
