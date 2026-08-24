# Yah Web Clone

Yah Web Clone 是一套面向创意网站、WebGL、Canvas、Three.js、Shader、滚动与交互动效的可验证复刻工作流。它把克隆前源码与素材发现、镜像、效果解构、可运行实验、Inspiration Collection、证据、分类、可恢复执行和发布收束到统一 CLI 中。所有核心能力都可独立使用，不要求外部 Library、数据库或索引服务。

默认使用中文交付，默认模式为 `full`。Agent 的完整执行契约以 [`SKILL.md`](SKILL.md) 为准；本 README 只提供给维护者和使用者快速定位。

## 四种模式

| 模式 | 适用场景 | 主要产物 |
|---|---|---|
| `full` | 严格 1:1 镜像并解构关键实现 | `site/` + `lab/` + `docs/` |
| `mirror` | 只保存可本地运行的网站缓存 | `site/` + 最小镜像证据 |
| `effect` | 只忠实复刻一个独立效果 | `lab/` + `docs/` + 效果证据 |
| `collection` | 组织多个相似网站并做逐项分析、横向比较与共性提炼 | `cases/` + `docs/` + 可选 `lab/` |

单站与单效果项目统一以 `<slug>-clone` 命名；Collection 使用不带后缀的主题名。所有模式都从项目根目录运行，不依赖外部 Site 工程或 Storybook。

## 核心能力

- 在抓站前按域名、标题、作者与 credits 定向寻找对应源码，并查找还原或呈现所需的内部/外部素材；revision、checksum 和 license 是可选复现信息，不是内部项目硬门槛。
- `yah discover` 自动运行有边界的 GitHub/npm 候选发现、本地素材引用扫描和 inspiration 搜索入口排序；候选需核验后才进入 provenance。
- 保留可直接运行的权威镜像，并把可读、可迁移的效果实现放入独立 Lab。
- 采集页面、路由、资源、网络、交互和视觉差异证据，无法达到目标忠实度时明确报告缺口。
- 为效果提供原版基线、可选 GUI 和有辨识度的 Preset。
- 等待页面真正加载完成后录制 MP4 或 WebM，并裁掉 Loading 前摇。
- 以 `clone.config.json.catalog` 为分类源，保存 tags 与形态/素材/行业/色彩/平台/建站工具 facets，投影 README 分类区并同步精选 GitHub Topics，方便任意全文索引或可选 Library 检索。
- `yah index/search` 即时扫描 workspace Meta，不创建长期数据库；需要外部资料库时再使用对应的可选集成。
- `yah run/resume` 执行安全内置步骤和项目声明的 `yah:<stage>` npm hooks，遇到来源采用、视觉判断或文档结论时保存状态并停在 review gate。
- 在最终交付前提升长期证据、清理临时内容并删除 `.clone/` 过程目录。
- 将主站与可选 Lab 组合为同一静态部署产物，Lab 默认挂载到 `/__lab/`。
- 将相似网站组织为可检索 Collection，为每个成员选择 `reference-only`、`mirror`、`effect` 或 `full`，再提炼共性与差异。
- 纯 `reference-only` Inspiration Collection 直接链接 provider、原站与素材来源，并从 Meta 重建呈现页面；不强制重复截图或录屏，也不默认生成会与 Meta 双写的 `DESIGN.md`。

## 公开案例

- [Underwater Corals Scene](https://github.com/Creative-Web-Refs/underwater-corals-scene-clone) — `full`；Three.js TSL、WebGPU/WebGL2、程序化焦散、GPU 模拟、路径变形与粒子系统；[生产镜像](https://underwater-corals-scene-clone.pages.dev/) · [在线 Lab](https://underwater-corals-scene-clone.pages.dev/__lab/) · [实现分析](https://github.com/Creative-Web-Refs/underwater-corals-scene-clone/blob/main/docs/ANALYSIS.md)

## 安装

最简单的方式是把仓库地址直接交给任何支持 Skills 的 Agent：

```text
请帮我安装这个 Skill：
https://github.com/SuneBear/yah-web-clone-skill

安装到你的 Skills 目录，保持 Skill 名为 yah-web-clone，并确认 SKILL.md 可以被发现。
```

Agent 只需要能够访问该仓库，并支持本地 Skill 或 `SKILL.md` 约定；具体安装目录由 Agent 自己的运行环境决定。

也可以手动克隆到对应 Agent 的 Skills 目录：

```bash
AGENT_SKILLS_DIR="/absolute/path/to/your-agent/skills"

git clone git@github.com:SuneBear/yah-web-clone-skill.git \
  "$AGENT_SKILLS_DIR/yah-web-clone"
```

更新已有安装：

```bash
AGENT_SKILLS_DIR="/absolute/path/to/your-agent/skills"

git -C "$AGENT_SKILLS_DIR/yah-web-clone" pull --ff-only
```

安装后让 Agent 重新加载 Skill 清单或开启新任务，再使用 `$yah-web-clone`，或该 Agent 提供的等效 Skill 调用方式。

## 快速使用

最短 Prompt：

```text
使用 $yah-web-clone 的 full 模式严格 1:1 复刻：
https://example.com
```

直接使用 CLI：

```bash
YAH_WEB_CLONE_DIR="/absolute/path/to/your-agent/skills/yah-web-clone"

node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" init example \
  --url https://example.com \
  --mode full
```

创建 Collection 时重复传入 URL；两个以上 URL 也会自动选择 `collection`：

```bash
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" init nature-sketches \
  --mode collection \
  --url https://example-a.com \
  --url https://example-b.com
```

查看全部命令：

```bash
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" --help
```

## 常用命令

```bash
# 查看工作流状态
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" status --project ./example-clone

# 自动发现源码、素材引用和 inspiration 候选；先预览再落证据
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" discover --project ./example-clone
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" discover --project ./example-clone --apply

# 预览或继续可恢复流水线
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" run --project ./example-clone
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" resume --project ./example-clone --apply

# 登记克隆前找到的对应源码，并闭合发现阶段
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" source \
  --project ./example-clone --kind repository \
  --source https://github.com/owner/repo --revision <commit> \
  --relation exact --evidence SOURCE --path site --complete

# 没找到源码也要记录检索范围与降级路线
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" source \
  --project ./example-clone --no-match --scope code \
  --note "查过域名、credits、GitHub、CodePen 和 npm，改走部署资产" --complete

# 登记原始或替代素材；内部素材可省略 license/checksum
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" source \
  --project ./example-clone --kind asset \
  --source https://assets.example.com/model.glb --role original \
  --relation exact --evidence SOURCE --path site/assets/model.glb

# 从项目根目录预览
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" serve --project ./example-clone

# 录制已完成加载的动效，默认输出 MP4
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" record \
  --project ./example-clone --name hero-motion --promote

# 检查目录、证据、分类和运行契约
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" validate \
  --project ./example-clone --strict --write

# 预览清理与最终提升；确认后再执行 --apply
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" clean --project ./example-clone
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" finalize --project ./example-clone
```

## Workspace 检索

Yah 的检索只用于当前 workspace 的即时扫描和分类诊断：

```bash
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" index --root /path/to/clones --json
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" search "水下 GPU 动画" \
  --root /path/to/clones --technology webgl2 --asset-type 3d-model --palette blue
```

### 可选：Sune Library

没有 Sune Library 的用户可以跳过本节。Yah 只输出候选卡，不直接修改 Library：

```bash
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" export \
  --project ./example-clone --format sune-library
```

职责边界和显式文件导出见 [`references/sune-library.md`](references/sune-library.md)。

旧项目先 dry-run，再显式迁移当前阶段名、Catalog 和 Skill 版本：

```bash
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" migrate --project ./legacy-clone
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" migrate --project ./legacy-clone --apply
```

## 项目分类

完成侦察后再填写有证据的内容标签，不添加 clone、collection、mode 或 workflow 系统标签：

```bash
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" catalog \
  --project ./example-clone \
  --technology threejs,webgl2,glsl \
  --capability interactive-3d,gpu-simulation \
  --visual-style underwater,organic-motion \
  --subject coral,marine-life \
  --artifact hero,brand-site --asset-type 3d-model,texture --industry technology \
  --palette dark,blue --platform web --builder custom \
  --keywords "水下珊瑚,海洋生物,GPU 动画" \
  --apply
```

仓库创建后可将同一份内容标签同步为 GitHub Topics：

```bash
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" catalog \
  --project ./example-clone --github --apply
```

Collection 的成员标签使用 `--case <slug>`；README 会显示成员分类。GitHub Topics 默认只使用项目级核心 tags，需要成员标签时用 `--github-topics` 精选不超过 20 个：

```bash
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" catalog \
  --project ./nature-sketches --case example-a-com \
  --capability dappled-light --visual-style organic-motion \
  --keywords "树影,自然光" --apply

node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" catalog \
  --project ./nature-sketches \
  --github-topics dappled-light,organic-motion --apply

node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" collection sync \
  --project ./nature-sketches --apply
```

## 交付结构

```text
<project>/
├── site/                 # full、mirror：权威镜像
├── cases/                # collection：列表与成员入口
├── lab/                  # full、effect；collection 可选
├── docs/                 # 分析、精选媒体与精简证据
├── scripts/              # 最终预览与部署脚本
├── clone.config.json     # 稳定配置与检索分类
├── README.md
└── package.json
```

工作过程中使用 `.clone/` 保存状态、临时捕获和待提升证据。`finalize --apply` 只有在严格验收通过后才会删除它。

## 参考文档

- [`references/deliverables.md`](references/deliverables.md)：四种模式的交付与验收清单。
- [`references/discovery.md`](references/discovery.md)：克隆前源码、素材、Inspiration fallback sources 与 Meta 边界。
- [`references/collection.md`](references/collection.md)：成员 treatment、目录、比较、综合和体积边界。
- [`references/effect-extraction.md`](references/effect-extraction.md)：RAW REPLAY、PROJECTIZE 和效果 baseline。
- [`references/motion-capture.md`](references/motion-capture.md)：等待 ready、裁切 Loading 与 GitHub 视频播放。
- [`references/catalog.md`](references/catalog.md)：分类字段、README 投影与 GitHub Topics。
- [`references/automation.md`](references/automation.md)：自动发现、workspace 即时检索、run/resume 与迁移。
- [`references/sune-library.md`](references/sune-library.md)：可选的 Sune Library candidate export 与职责边界；不使用 Sune 时无需读取。
- [`references/static-mirror.md`](references/static-mirror.md)：静态镜像策略。
- [`references/cloudflare-pages.md`](references/cloudflare-pages.md)：主站与 Lab 的 Cloudflare Pages 发布。

## 开发与验证

```bash
for test in tests/*.test.mjs; do
  node "$test" || exit
done
```

测试覆盖默认模式、四模式矩阵、源码/素材 provenance、自动发现、可恢复 runner、workspace 检索、Sune candidate export、迁移、Collection 投影、部署组合、最终提升、项目分类以及 MP4/WebM 录制。

## 版本记录

本项目使用 Git commit 作为可追溯的变更记录，不单独维护容易漂移的 `CHANGELOG.md`。查看完整历史：

```bash
git log --oneline --decorate
```

## License

[MIT](LICENSE)
