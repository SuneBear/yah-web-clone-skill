# Collection 模式

用 `collection` 研究多个相似网站。Collection 是 Yah Web Clone 内的第四种模式，不是独立 Skill，也不是把多个完整 clone 无条件塞进一个仓库。

## 对象模型

集合描述一个研究问题；成员描述一个来源及其处理方式：

- `reference-only`：只登记、观察和分析，不保存完整镜像。
- `mirror`：在 Collection 内保留必要的本地运行资产，并按单站镜像标准验收。
- `effect`：只提取与集合问题有关的效果，按 effect baseline 验收。
- `full`：完整解构。资产较大或结构复杂时建立独立 `<slug>-clone` 仓库，在 Collection 中保存链接、摘要和精选证据。

`nature-sketches` 代表研究型 Collection：重点是多案例分析和共性提炼。`renderaissance-pbr-card` 代表工作台型 Collection：重点是多个可运行参考、统一调试和衍生实验。二者使用同一个模式，不再增加子模式。

## 稳定配置

```json
{
  "mode": "collection",
  "collection": {
    "schemaVersion": 1,
    "slug": "nature-sketches",
    "title": "自然感网页效果",
    "members": [
      {
        "slug": "sunlit",
        "title": "Sunlit",
        "url": "https://example.com",
        "provider": "lapa-ninja",
        "sourcePage": "https://www.lapa.ninja/post/example",
        "treatment": "reference-only",
        "status": "analyzed",
        "catalog": {
          "schemaVersion": 2,
          "tags": {
            "technology": ["webgl"],
            "capability": ["dappled-light"],
            "visualStyle": ["organic-motion"],
            "subject": ["sunlight"]
          },
          "facets": {
            "artifact": ["landing-page"],
            "assetType": ["image", "font"],
            "industry": ["travel"],
            "palette": ["warm"],
            "platform": ["web"],
            "builder": ["custom"]
          },
          "keywords": ["树影", "自然光"]
        },
        "assets": [
          {
            "title": "Sunlight texture reference",
            "type": "texture",
            "role": "reference",
            "sourcePage": "https://assets.example.com/sunlight",
            "previewUrl": "https://assets.example.com/sunlight.webp"
          }
        ]
      }
    ]
  }
}
```

成员 `slug` 必须唯一且稳定。`status` 可使用 `pending`、`captured`、`analyzed`、`implemented`、`verified` 或 `blocked`。`provider` 与 `sourcePage` 只在来源来自 Inspiration gallery 时填写：`url` 始终指原站，`sourcePage` 指 provider 的详情/预览页。

`assets` 只登记对研究、实现或呈现有明确作用的素材。`type` 使用 `image`、`video`、`font`、`icon`、`3d-model`、`texture`、`audio` 或 `other`；`role` 使用 `original`、`replacement`、`reference` 或 `presentation`。内部素材可省略 license；外部素材在复制或发布前核实边界。`localPath` 必须是项目相对路径且真实存在；`previewUrl` 只有在允许呈现时填写。不要把过程绝对路径、临时截图清单或完整网络日志写进稳定配置。

非 `reference-only` 成员用 `route` 指向 Collection 内的可运行入口，或用 `cloneRepo` 指向独立 clone 仓库。重型 `full` 优先使用 `cloneRepo`；不要同时复制一份完整镜像又链接独立仓库。

## 目录

```text
<collection>/
├── cases/
│   ├── index.html          # 可部署列表和成员入口
│   └── <case>/             # 只有需要本地运行的成员才创建
├── lab/                    # 可选；只放跨案例提炼的实验
├── docs/
│   ├── cases/<slug>.md     # 逐项观察、证据与集合关系
│   ├── COMPARISON.md       # 横向矩阵
│   ├── SYNTHESIS.md        # 共性、差异、反例与可迁移方法
│   └── media/              # 少量被文档引用的精选媒体
└── clone.config.json
```

不要创建一个共享的 `site/` 来假装它是权威单站镜像。不要保留 `RECON/`、未筛选截图、重复构建物或每个来源的无条件完整下载。

## 工作流

1. 明确研究问题和成员纳入标准；成员不足两个时改用 `full`、`mirror` 或 `effect`。
2. 为每个成员选择 treatment，并记录它要回答的问题，而不是对所有来源执行相同重量的抓取。
3. 先完成逐项证据和分析，再写横向矩阵；从矩阵提炼共性、差异、反例和可迁移方法。
4. 只有综合结论需要运行验证时创建 Lab；默认参数对应有证据的案例，派生参数明确标记为 variation。
5. 分别执行项目级和成员级 Catalog，再运行 `yah collection sync --apply`，从 Meta 重建 README 的紧凑参考来源列表，以及 Collection 页的 provider/原站链接与素材卡片；完整分类仍只保存在 `clone.config.json`。随后运行严格验收、体积检查、清理和 finalize。纯 `reference-only` Collection 不强制自制截图或录屏；有本地镜像或实现时才保留相应视觉证据。

成员分类示例：

```bash
node "$YAH" catalog --project "$YAH_PROJECT" --case sunlit \
  --technology webgl --capability dappled-light \
  --visual-style organic-motion --subject sunlight \
  --keywords "树影,自然光" --apply
```

## 验收边界

- `reference-only` 不声称 1:1，只验证来源、观察和结论链路。
- `mirror`、`effect`、`full` 继承对应模式的忠实度门槛。
- Collection 首页必须能直接运行并列出所有成员；成员分析、比较和综合文档不得残留占位符。
- Collection 首页与 README 来源区必须能由稳定配置重新生成，不手工维护 provider、原站或素材链接。
- 集合级与成员级 Catalog 都保存在稳定配置；GitHub Topics 只使用项目级或显式精选的核心标签。
- Collection Lab 如果存在，必须有可读源码，可静态运行或提供 `build:lab`；构建型 Lab 先构建再从 `/__lab/` 本地预览，并进入同一路径的部署验收。
