# 项目检索分类

把 `clone.config.json.catalog` 作为项目分类 Source of Truth；Collection 成员使用 `collection.members[].catalog`。README 的紧凑检索摘要与 GitHub Topics 都是可重新生成的投影；环境中存在 Library 索引时优先读取稳定配置，Yah 本身不依赖它。不要为相同字段再维护默认 `DESIGN.md`。

## 配置契约

```json
{
  "catalog": {
    "schemaVersion": 2,
    "tags": {
      "technology": ["threejs", "webgl2", "glsl"],
      "capability": ["interactive-3d", "gpu-simulation"],
      "visualStyle": ["underwater", "organic-motion"],
      "subject": ["coral", "marine-life"]
    },
    "facets": {
      "artifact": ["hero", "brand-site"],
      "assetType": ["3d-model", "texture"],
      "industry": ["technology"],
      "palette": ["dark", "blue"],
      "platform": ["web"],
      "builder": ["custom"]
    },
    "keywords": ["水下珊瑚", "海洋生物", "GPU 动画"]
  }
}
```

- `technology`：运行时、框架、语言、图形 API 或关键库。
- `capability`：代码能完成的效果、行为或可复用机制。
- `visualStyle`：视觉语言、运动气质和感知特征。
- `subject`：画面或内容所表现的对象与题材。
- `keywords`：中文、别名和自然语言检索词；不进入 GitHub Topics。
- `artifact`：内容形态或局部范围，如 `landing-page`、`product-ui`、`app-flow`、`hero`、`navbar`、`cta`、`footer`、`microinteraction`。
- `assetType`：呈现或实现涉及的素材类型，如 `image`、`video`、`font`、`icon`、`3d-model`、`texture`、`audio`。
- `industry`：行业筛选，如 `saas`、`finance`、`fashion`。
- `palette`：感知色彩筛选，如 `dark`、`light`、`monochrome`、`blue`。
- `platform`：`web`、`mobile-web`、`ios`、`android`。
- `builder`：`custom`、`framer`、`webflow`、`wordpress`、`shopify` 等；未知时不猜。

`tags` 回答“项目中有什么内容或能力”，可投影到 GitHub Topics；`facets` 回答“用户想怎样筛选”，完整值只进入 Meta 与外部索引。README 从 tags、facets、keywords 中精选不超过 8 个词作为检索摘要，并引导读者查看 `clone.config.json`。视觉叙述、设计原则与 token 不塞进 Catalog；确需详细表达时写进现有分析/综合文档，或按需生成 Design DNA。

标签使用小写英文 kebab-case。优先使用生态中常见的规范词，如 `threejs`、`webgl`、`webgpu`、`glsl`、`scroll-animation`，不要制造含义相同的新拼法。未知值保持未知，不为了填满字段而猜测。

不要加入 `yah-web-clone`、`web-clone`、`full-clone`、`mirror-clone`、`effect-clone`、`collection` 或 `comparative-study` 等系统标签。仓库与 `mode` 已能表达这些信息；分类只回答“这里有什么值得找到的内容”。

## CLI

```bash
node "$YAH" catalog --project "$YAH_PROJECT" \
  --technology threejs,webgl2,glsl \
  --capability interactive-3d,gpu-simulation \
  --visual-style underwater,organic-motion \
  --subject coral,marine-life \
  --artifact hero,brand-site --asset-type 3d-model,texture --industry technology \
  --palette dark,blue --platform web --builder custom \
  --keywords "水下珊瑚,海洋生物,GPU 动画"
```

默认只预览。加 `--apply` 后更新当前阶段的 `.clone/project.json` 或最终 `clone.config.json`，并生成 README 的受管检索摘要。未传入的字段保留原值；`--clear` 清空全部分类。

Collection 成员传入 `--case <slug>`。每个成员使用同一套分类字段；只有 facets 或 keywords 的 reference-only 成员也有效，不要为了通过验证猜测技术。完整成员级分类保存在 `clone.config.json`，README 不重复展开每个成员的全部标签。

GitHub Topics 只能表达仓库级内容。默认只使用项目级核心 tags；成员标签不自动汇总，避免大型 Collection 超过 20。需要从成员标签中提升少数仓库主题时显式精选：

```bash
node "$YAH" catalog --project "$YAH_PROJECT" \
  --github-topics webgl,interactive-3d,coral --apply
```

精选值必须已经存在于项目或成员核心 tags，最多 20 个；facets 与 keywords 不进入 Topics。

仓库创建后运行：

```bash
node "$YAH" catalog --project "$YAH_PROJECT" --github --apply
```

GitHub Topics 完整替换为项目默认或显式精选的核心英文 tags，最多 20 个。默认从 `delivery.githubOrg` 与项目 `name` 推断仓库；必要时用 `--repo owner/name` 覆盖。不要把中文关键词同步到 Topics。

## Workspace 即时检索

`yah index` 与 `yah search` 每次扫描 workspace 中的 `.clone/project.json` 或 `clone.config.json`，支持对项目和 Collection 成员按 query、mode、kind、tags 与 facets 组合筛选。默认只使用内存，不维护长期数据库；显式 `index --out` 产生的 JSON 也是可删除、可重建投影。

该命令只负责当前 workspace 的即时定位和分类诊断，不承担外部长期资料库职责。使用 Sune Library 的用户再读取 `references/sune-library.md`；其他用户无需配置任何集成。

## 分类时机

初始化时通常证据不足，不生成占位标签。在侦察、镜像或效果提取完成后分类；在 `validate --strict` 与 `finalize` 前至少保留一个有证据的核心 tag、facet 或关键词。发布 GitHub 后同步 Topics，并通过 API 读取结果确认。
