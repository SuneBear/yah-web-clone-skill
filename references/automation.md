# 三层自动化

Yah 的自动化只负责克隆项目内部的候选发现、稳定 Meta、即时检索与可恢复执行。全部能力都可独立使用，不要求外部 Library、数据库或索引服务。

## 一、候选发现：`yah discover`

```bash
node "$YAH" discover --project "$YAH_PROJECT" --apply
```

默认同时运行三类有边界的 adapter：

- code：按项目名称、域名和显式 query 查询 GitHub 与 npm；网络 adapter 不可用时保留 partial/error 状态。
- asset：扫描当前 `site/` 或 `cases/` 中 HTML、CSS、JS 和 JSON 对图片、视频、字体、音频、模型、纹理等文件的引用。
- inspiration：为 discovery fallback providers 生成与项目身份对应的搜索入口，不把外部候选声称为已保存的个人资源。

结果按项目身份匹配排序，写入 `.clone/evidence/discovery.json`。重复运行按稳定 candidate ID 合并候选，并保留最近的 run log。`--offline` 只执行本地素材扫描与 inspiration routes；`--scope` 可以限制范围。

候选不是 provenance。核验后仍用 `yah source` 记录采用的精确/部分来源，或记录有边界的 code no-match。`yah discover` 不会自动把视觉相似仓库升级为 `SOURCE`，也不会自动完成 `source_discovery`。

## 二、Workspace 即时检索

Yah 可以即时扫描 workspace 中的 `.clone/project.json` 与 `clone.config.json`：

```bash
node "$YAH" index --root "$YAH_WORKSPACE" --json
node "$YAH" search "水下 GPU 动画" --root "$YAH_WORKSPACE" \
  --technology webgl2 --asset-type 3d-model --palette blue --json
```

`index`/`search` 每次从项目 Meta 重建内存视图；默认不创建数据库。只有显式 `index --out <file>` 才写一个可丢弃、可重建的快照。它适合检查当前 workspace、调试分类和临时定位项目，不承担长期资源库职责。

需要接入外部长期资料库时使用对应的可选集成；Sune Library 用户读取 `references/sune-library.md`，其他用户无需读取或配置。

## 三、可恢复编排：`yah run` / `yah resume`

```bash
node "$YAH" run --project "$YAH_PROJECT"
node "$YAH" run --project "$YAH_PROJECT" --apply
node "$YAH" resume --project "$YAH_PROJECT" --apply --until local_verify
```

默认 dry-run 展示未完成阶段及 handler。`--apply` 后：

1. `source_discovery` 没有核验结论时运行 `yah discover --apply`，保存候选后停在 review gate。
2. 已有非素材来源或 code no-match 时闭合 discovery，进入下一阶段。
3. 项目可在 `package.json` 声明 `yah:<stage>` npm script；runner 通过固定 argv 执行该 hook，成功才完成阶段，失败则记录为 blocked。
4. 没有确定性 handler 的阶段进入 `in_progress` 并停在 manual/review gate，等待 Agent 或人工完成与验收。

运行记录写入 `.clone/evidence/automation-runs.json`，已完成阶段不会重复执行。runner 不从 Meta 执行任意 shell 字符串；这样既能恢复自动步骤，又不会绕过视觉判断、来源采用、文档结论或发布授权。

旧项目先预览迁移：

```bash
node "$YAH" migrate --project "$YAH_PROJECT"
node "$YAH" migrate --project "$YAH_PROJECT" --apply
```

迁移规范 legacy stage 名、Catalog v2 和当前 Skill 版本；保留未知字段与项目内容，不为内部源码/素材补造 revision、checksum 或 license，也不把本机绝对路径写入最终 `clone.config.json`。
