# Yah Web Clone

Yah Web Clone 是一套面向创意网站、WebGL、Canvas、Three.js、Shader、滚动与交互动效的可验证复刻工作流。它把镜像、效果解构、可运行实验、证据、录屏、分类和发布收束到统一 CLI 中。

默认使用中文交付，默认模式为 `full`。Agent 的完整执行契约以 [`SKILL.md`](SKILL.md) 为准；本 README 只提供给维护者和使用者快速定位。

## 三种模式

| 模式 | 适用场景 | 主要产物 |
|---|---|---|
| `full` | 严格 1:1 镜像并解构关键实现 | `site/` + `lab/` + `docs/` |
| `mirror` | 只保存可本地运行的网站缓存 | `site/` + 最小镜像证据 |
| `effect` | 只忠实复刻一个独立效果 | `lab/` + `docs/` + 效果证据 |

项目和仓库统一以 `<slug>-clone` 命名。所有模式都从项目根目录运行，不依赖外部 Site 工程或 Storybook。

## 核心能力

- 保留可直接运行的权威镜像，并把可读、可迁移的效果实现放入独立 Lab。
- 采集页面、路由、资源、网络、交互和视觉差异证据，无法达到目标忠实度时明确报告缺口。
- 为效果提供原版基线、可选 GUI 和有辨识度的 Preset。
- 等待页面真正加载完成后录制 MP4 或 WebM，并裁掉 Loading 前摇。
- 以 `clone.config.json.catalog` 为分类源，投影 README 分类区并同步 GitHub Topics，方便 Sune Library 检索。
- 在最终交付前提升长期证据、清理临时内容并删除 `.clone/` 过程目录。
- 将主站与可选 Lab 组合为同一静态部署产物，Lab 默认挂载到 `/__lab/`。

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

查看全部命令：

```bash
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" --help
```

## 常用命令

```bash
# 查看工作流状态
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" status --project ./example-clone

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

## 项目分类

完成侦察后再填写有证据的内容标签，不添加 clone、mode 或 workflow 系统标签：

```bash
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" catalog \
  --project ./example-clone \
  --technology threejs,webgl2,glsl \
  --capability interactive-3d,gpu-simulation \
  --visual-style underwater,organic-motion \
  --subject coral,marine-life \
  --keywords "水下珊瑚,海洋生物,GPU 动画" \
  --apply
```

仓库创建后可将同一份内容标签同步为 GitHub Topics：

```bash
node "$YAH_WEB_CLONE_DIR/scripts/yah.mjs" catalog \
  --project ./example-clone --github --apply
```

## 交付结构

```text
<project>/
├── site/                 # full、mirror：权威镜像
├── lab/                  # full、effect：独立可运行效果
├── docs/                 # 分析、精选媒体与精简证据
├── scripts/              # 最终预览与部署脚本
├── clone.config.json     # 稳定配置与检索分类
├── README.md
└── package.json
```

工作过程中使用 `.clone/` 保存状态、临时捕获和待提升证据。`finalize --apply` 只有在严格验收通过后才会删除它。

## 参考文档

- [`references/deliverables.md`](references/deliverables.md)：三种模式的交付与验收清单。
- [`references/effect-extraction.md`](references/effect-extraction.md)：RAW REPLAY、PROJECTIZE 和效果 baseline。
- [`references/motion-capture.md`](references/motion-capture.md)：等待 ready、裁切 Loading 与 GitHub 视频播放。
- [`references/catalog.md`](references/catalog.md)：分类字段、README 投影与 GitHub Topics。
- [`references/static-mirror.md`](references/static-mirror.md)：静态镜像策略。
- [`references/cloudflare-pages.md`](references/cloudflare-pages.md)：主站与 Lab 的 Cloudflare Pages 发布。

## 开发与验证

```bash
for test in tests/*.test.mjs; do
  node "$test" || exit
done
```

测试覆盖默认模式、三模式矩阵、部署组合、最终提升、项目分类以及 MP4/WebM 录制。

## 版本记录

本项目使用 Git commit 作为可追溯的变更记录，不单独维护容易漂移的 `CHANGELOG.md`。查看完整历史：

```bash
git log --oneline --decorate
```

## License

[MIT](LICENSE)
