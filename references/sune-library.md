# 可选集成：Sune Library

只有用户明确使用 Sune Library，或当前环境已经提供该 Skill 且任务涉及长期检索、捕获或策展时，才读取本文件。Yah Web Clone 本身不依赖 Sune Library；没有 Sune 的用户不需要任何额外配置。

## 职责边界

- Yah 负责克隆项目工程、过程证据、`clone.config.json` Catalog、README 和 GitHub Topics。
- Sune Library 负责跨项目长期保存、Personal Metadata、去重、可见性、Project Working Set 和检索。
- 克隆工程留在 Git/GitHub；Library 只保存索引卡、关键 Fragment、provenance、仓库地址和可复用发现。
- Yah 不直接写 Sune Library、Raindrop、Studio 或任何 Library index，不成为它们的第二个 Source of Truth。

## Candidate export

默认输出到 stdout：

```bash
node "$YAH" export --project "$YAH_PROJECT" --format sune-library
```

只有显式提供目标路径并加 `--apply` 才写文件：

```bash
node "$YAH" export --project "$YAH_PROJECT" --format sune-library \
  --out /explicit/path/project-candidate.json --apply
```

candidate card 包含仓库、生产环境、原站 URL、Catalog、Collection 成员和 source discovery 摘要，按 Sune Code/Past Work 字段组织。它仍是待 Sune capture、dedup 和 curate 的候选，不创建 Personal Metadata，也不决定 visibility、安全分类、Collection 或长期晋升。

README 与精选 GitHub Topics 是另一条零耦合投影；Sune GitHub Code Profile 可以像读取其他仓库一样读取它们。Yah 不探测 Sune 的本机路径，也不会在 Sune 不存在时改变任何核心行为。
