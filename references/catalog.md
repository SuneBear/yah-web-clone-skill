# 项目检索分类

把 `clone.config.json.catalog` 作为项目分类 Source of Truth；Collection 成员使用 `collection.members[].catalog`。README 分类区与 GitHub Topics 都是可重新生成的投影，避免多处漂移。

## 配置契约

```json
{
  "catalog": {
    "schemaVersion": 1,
    "tags": {
      "technology": ["threejs", "webgl2", "glsl"],
      "capability": ["interactive-3d", "gpu-simulation"],
      "visualStyle": ["underwater", "organic-motion"],
      "subject": ["coral", "marine-life"]
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

标签使用小写英文 kebab-case。优先使用生态中常见的规范词，如 `threejs`、`webgl`、`webgpu`、`glsl`、`scroll-animation`，不要制造含义相同的新拼法。未知值保持未知，不为了填满字段而猜测。

不要加入 `yah-web-clone`、`web-clone`、`full-clone`、`mirror-clone`、`effect-clone`、`collection` 或 `comparative-study` 等系统标签。仓库与 `mode` 已能表达这些信息；分类只回答“这里有什么值得找到的内容”。

## CLI

```bash
node "$YAH" catalog --project "$YAH_PROJECT" \
  --technology threejs,webgl2,glsl \
  --capability interactive-3d,gpu-simulation \
  --visual-style underwater,organic-motion \
  --subject coral,marine-life \
  --keywords "水下珊瑚,海洋生物,GPU 动画"
```

默认只预览。加 `--apply` 后更新当前阶段的 `.clone/project.json` 或最终 `clone.config.json`，并生成 README 的受管分类区。未传入的字段保留原值；`--clear` 清空全部分类。

Collection 成员传入 `--case <slug>`。每个成员使用同一套分类字段；README 分类区保留成员与标签的对应关系。GitHub Topics 只能表达仓库级标签，因此使用项目与全部成员标签的去重合集，合集仍不得超过 20 个。

仓库创建后运行：

```bash
node "$YAH" catalog --project "$YAH_PROJECT" --github --apply
```

GitHub Topics 完整替换为四类英文内容标签的去重合集，最多 20 个。默认从 `delivery.githubOrg` 与项目 `name` 推断仓库；必要时用 `--repo owner/name` 覆盖。不要把中文关键词同步到 Topics。

## 分类时机

初始化时通常证据不足，不生成占位标签。在侦察、镜像或效果提取完成后分类；在 `validate --strict` 与 `finalize` 前至少保留一个有证据的内容标签。发布 GitHub 后同步 Topics，并通过 API 读取结果确认。
