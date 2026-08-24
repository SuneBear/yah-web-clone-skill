# 克隆前发现：源码、素材与 Inspiration

任何模式在抓站、录屏或重建之前，先完成一次有边界的发现。目标有三类：找到与目标对应的源码；找到还原或呈现所需的原始/替代素材；需要视觉方向或集合研究时建立可检索 Inspiration 引用。三类结果都只是输入，不自动扩大克隆或发布权限。

初始化项目后可先运行 `yah discover --project <dir> --apply`，自动生成 GitHub/npm code candidates、镜像内素材引用清单与 inspiration provider 搜索入口。结果保存在 `.clone/evidence/discovery.json`，但候选仍需核验并通过 `yah source` 登记，不能仅凭自动排名成为 `SOURCE`。adapter、离线模式与恢复规则见 `references/automation.md`。

## 一、先找与目标对应的公开源码

按以下线索做一轮定向检索，不做无休止的广搜：

1. 原站页脚、About、Credits、开发者或工作室名称，以及页面源码中的 repository、author、generator、package 和 source map 线索。
2. 用完整域名、页面标题、独特文案、作者名分别查 GitHub/GitLab；同时检查仓库的 homepage、README 演示链接、部署配置和提交时间是否能与目标对应。
3. 检查作者公开的 CodePen、CodeSandbox、StackBlitz、npm package、演讲文章或案例页；这些可以补充实现，但不能仅因视觉相似就认定为原站源码。
4. 找到候选后确认 relation、入口路径、资产完整性和运行方式。revision 与 license 在可用时记录以增强复现；内部仓库无需为了流程补填。无法核验为同一目标时标为 `partial`，继续使用部署 bundle、source map 或运行时证据。

把采用的来源登记到 `.clone/evidence/source-provenance.json`：

```bash
node "$YAH" source \
  --project "$YAH_PROJECT" \
  --kind repository \
  --source https://github.com/owner/repo \
  --revision <commit> \
  --relation exact \
  --path site \
  --evidence SOURCE \
  --complete
```

搜索未命中也是结论，用同一命令记录并完成阶段：

```bash
node "$YAH" source --project "$YAH_PROJECT" \
  --no-match --scope code \
  --note "查过域名、标题、credits、GitHub、CodePen 与 npm；改走部署资产路线" \
  --complete
```

不要把相似开源模板、主题市场商品或 AI 生成实现写成目标的 `SOURCE`。如果还要继续登记多条结果，只在最后一条加 `--complete`；阶段也可通过 `yah stage` 显式管理。

## 二、同时找还原与呈现所需的素材

素材发现不是“随便找一张相似图”。先从原站网络请求、CSS/font-face、HTML metadata、模型/纹理引用、媒体清单、作者仓库和品牌资源页定位原始文件，再根据任务决定：

- `original`：确认属于目标或内部项目的原始素材，relation 可为 `exact`。
- `replacement`：用于补齐缺失内容的合法替代，必须是 `partial`，不可声称与原始一致。
- `reference`：仅帮助理解风格、构图、材质或声音，不进入最终产品。
- `presentation`：用于 Collection/文档呈现的预览或封面，不等于可复用 Master Asset。

覆盖字体、图片、视频、3D 模型、纹理、HDRI、音频、图标和动效文件。内部素材可直接登记来源与角色；外部素材在复制、发布或热链前核实可用边界。revision、checksum 与 license 均为可选的复现信息，不是内部交付硬门槛。

```bash
node "$YAH" source --project "$YAH_PROJECT" \
  --kind asset --source https://assets.example.com/coral.glb \
  --role original --relation exact --evidence SOURCE \
  --path site/assets/coral.glb
```

素材没有命中时可用 `--no-match --scope asset --note ...` 记录查询与替代路线。只有素材记录不能替代 code discovery：严格验收仍要求源码候选或 code no-match 结论。

## 三、先查可用个人来源，再使用 fallback seeds

Yah Web Clone 不依赖 Sune Library。若环境中恰好有 `sune-library` Skill，先按它的 Layer 1 搜索个人书签/项目记忆，再按 Source Registry 选择适合源码、素材或网站灵感的 2–3 个来源；这一步只是可选加速，结果仍写入 Yah 项目 Meta。没有该 Skill、没有本地索引或命中不足时，直接使用用户给定清单、公开代码平台、通用 Web 搜索和下面的 fallback seeds。只有实际使用 Sune 集成时才读取 `references/sune-library.md`。

这些站点是 fallback seeds，不是个人 Registry、固定排名或完整 allowlist。按研究问题选择 1–3 个入口，不要每次全量浏览。

| Provider | 适合找什么 | 建议记录的筛选维度 |
|---|---|---|
| [recent.design](https://recent.design/) | 网页、品牌、字体、动效等综合精选 | artifact、visualStyle、subject |
| [Lapa Ninja](https://www.lapa.ninja/) | 落地页、完整页面、行业与建站工具 | artifact、industry、palette、builder |
| [Land-book](https://land-book.com/) | 商业网站、落地页与作品集 | artifact、industry、visualStyle |
| [SiteInspire](https://www.siteinspire.com/) | 精选网站、视觉方向与工作室案例 | visualStyle、industry、artifact |
| [Awwwards](https://www.awwwards.com/) | 高创意、高动效与技术型网站 | technology、capability、visualStyle |
| [The FWA](https://thefwa.com/) | 获奖数字体验、实验性交互与高完成度案例 | capability、technology、visualStyle |
| [mesh3d](https://mesh3d.gallery/) | Three.js、WebGL 与交互式 3D 网站 | technology、capability、artifact |
| [Mobbin](https://mobbin.com/) | 真实 App/Web 产品界面、元素与完整流程 | platform、artifact、capability、industry |
| [Refero](https://refero.design/) | 真实产品页面与组件，尤其 SaaS | artifact、component keywords、industry |
| [Design Spells](https://www.designspells.com/) | 微交互、彩蛋和精致设计细节 | capability、visualStyle、artifact |
| [Details.so Inspo](https://www.details.so/inspo) | 真实网站的 Hero、Footer、Preloader、页面转场与动画细节 | artifact、capability、visualStyle |
| [Supahero](https://supahero.io/) | 网站 Hero | artifact=hero、industry、palette |
| [Navbar Gallery](https://www.navbar.gallery/) | 导航栏、菜单和导航类型 | artifact=navbar、capability、builder |
| [CTA.gallery](https://www.cta.gallery/) | CTA 区块、按钮与转化文案 | artifact=cta、industry、palette |
| [Footer Design](https://www.footer.design/) | 网站页脚 | artifact=footer、industry、palette |
| [loadmo.re](https://loadmo.re/) | 非常规、实验型移动网站 | platform=mobile-web、visualStyle、capability |

用户提供的书签、团队资料库、站点集合、素材库或其他公开 gallery 都可补充 seeds。只有当前环境允许读取时才使用个人来源；读取不到时使用用户已给的清单，不绕过浏览器安全边界。

## 四、如何保存 Inspiration 与素材，不制造截图债务

Inspiration 不是新的交付模式。多个参考进入 `collection`，默认用 `reference-only` 成员；单个 clone 只有在用户明确要求视觉方向时才附相关参考。

Collection 成员把原站放在 `url`，把 gallery 的详情页放在 `sourcePage`，并记录 `provider` 与 `catalog`：

```json
{
  "slug": "example-hero",
  "title": "Example Hero",
  "url": "https://example.com/",
  "provider": "supahero",
  "sourcePage": "https://supahero.io/example",
  "treatment": "reference-only",
  "status": "analyzed",
  "catalog": {
    "schemaVersion": 2,
    "tags": {
      "technology": [],
      "capability": ["scroll-reveal"],
      "visualStyle": ["editorial"],
      "subject": ["saas"]
    },
    "facets": {
      "artifact": ["hero"],
      "assetType": ["3d-model", "texture"],
      "industry": ["saas"],
      "palette": ["dark"],
      "platform": ["web"],
      "builder": ["custom"]
    },
    "keywords": ["超大标题", "首屏叙事"]
  }
}
```

需要呈现具体素材时可在成员下增加 `assets`：

```json
{
  "assets": [
    {
      "title": "Coral model",
      "type": "3d-model",
      "role": "original",
      "url": "https://assets.example.com/coral.glb",
      "sourcePage": "https://assets.example.com/coral",
      "localPath": "cases/assets/coral.glb",
      "previewUrl": "./assets/coral.webp"
    }
  ]
}
```

- `yah collection sync --apply` 从 Meta 重建 README 来源区和 `cases/`，同时显示 provider 详情页、原站和素材来源。
- 不默认热链 provider 的图片；只有内部素材或已确认可以呈现、URL 稳定且预览有价值时才保存 `previewUrl` 或本地缩略图。
- 纯 `reference-only` Collection 不要求本地截图或录屏。`full`、`effect` 以及含 mirror/实现成员的 Collection 仍需本地视觉证据来验收忠实度。
- 录屏只用于无法由静态预览说明的时间、滚动或交互机制，不能充当检索索引。

## 五、Meta、DESIGN.md 与 Design DNA 的边界

`clone.config.json.catalog`、`collection.members[].catalog/assets` 是检索 Source of Truth。README、Collection 首页和 GitHub Topics 都是可重建投影；可选的 Sune Library 或其他索引只消费这些公开投影，不是 Yah 的依赖。不要再维护一份同字段的 `DESIGN.md`。

只有以下情况才增加设计文档：

- 需要解释设计决策、设计系统或跨案例结论：写入已有 `docs/ANALYSIS.md` 或 `docs/SYNTHESIS.md`。
- 用户明确要提取设计系统、制作风格变体或把视觉语言移植到新内容：生成 `design-dna.json`，并按需再生成面向人的 `docs/DESIGN.md`。

因此默认答案是：Meta 足够支撑筛选时，不创建 `DESIGN.md`。文档可以从 Meta 生成，但不能反过来成为第二份需要人工同步的数据源。
