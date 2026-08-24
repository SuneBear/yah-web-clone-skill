export const CATALOG_TAG_FIELDS = Object.freeze([
  "technology",
  "capability",
  "visualStyle",
  "subject",
]);

export const CATALOG_FACET_FIELDS = Object.freeze([
  "artifact",
  "assetType",
  "industry",
  "palette",
  "platform",
  "builder",
]);

export const CATALOG_LABELS = Object.freeze({
  technology: "技术",
  capability: "能力",
  visualStyle: "视觉",
  subject: "主题",
  artifact: "形态",
  assetType: "素材",
  industry: "行业",
  palette: "色彩",
  platform: "平台",
  builder: "建站工具",
});

const WORKFLOW_TOPICS = new Set([
  "clone",
  "web-clone",
  "yah-web-clone",
  "full-clone",
  "mirror-clone",
  "effect-clone",
  "collection",
  "collection-clone",
  "comparative-study",
]);

function values(input) {
  if (Array.isArray(input)) return input;
  if (input === undefined || input === null || input === "") return [];
  return String(input).split(",");
}

function unique(items) {
  return [...new Set(items)];
}

export function normalizeTopic(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

export function normalizeCatalog(input = {}) {
  const tags = {};
  for (const field of CATALOG_TAG_FIELDS) {
    tags[field] = unique(values(input.tags?.[field]).map(normalizeTopic).filter(Boolean));
  }
  const facets = {};
  for (const field of CATALOG_FACET_FIELDS) {
    facets[field] = unique(values(input.facets?.[field]).map(normalizeTopic).filter(Boolean));
  }
  const keywords = unique(values(input.keywords).map((value) => String(value).trim()).filter(Boolean));
  return { schemaVersion: 2, tags, facets, keywords };
}

export function catalogTopics(catalog) {
  const normalized = normalizeCatalog(catalog);
  return unique(CATALOG_TAG_FIELDS.flatMap((field) => normalized.tags[field]));
}

export function catalogHasContent(catalog) {
  const normalized = normalizeCatalog(catalog);
  return catalogTopics(normalized).length > 0
    || CATALOG_FACET_FIELDS.some((field) => normalized.facets[field].length > 0)
    || normalized.keywords.length > 0;
}

export function projectCatalogHasContent(config = {}) {
  if (catalogHasContent(config.catalog)) return true;
  return config.mode === "collection"
    && (config.collection?.members || []).some((member) => catalogHasContent(member.catalog));
}

export function catalogProblems(catalog) {
  const topics = catalogTopics(catalog);
  const problems = [];
  if (!catalogHasContent(catalog)) problems.push("至少填写一个内容标签、筛选 facet 或关键词");
  const workflow = topics.filter((topic) => WORKFLOW_TOPICS.has(topic) || topic.endsWith("-clone"));
  if (workflow.length) problems.push(`不要使用 clone/mode/workflow 系统标签：${workflow.join("、")}`);
  return problems;
}

export function projectCatalogTopics(config = {}) {
  const selected = unique(values(config.delivery?.githubTopics).map(normalizeTopic).filter(Boolean));
  if (selected.length) return selected;
  return catalogTopics(config.catalog);
}

export function projectCatalogProblems(config = {}) {
  const problems = catalogProblems(config.catalog).map((problem) => `项目分类：${problem}`);
  if (config.mode === "collection") {
    for (const member of config.collection?.members || []) {
      for (const problem of catalogProblems(member.catalog)) {
        problems.push(`案例 ${member.slug || "<missing-slug>"}：${problem}`);
      }
    }
  }
  const availableTopics = unique([
    ...catalogTopics(config.catalog),
    ...((config.collection?.members || []).flatMap((member) => catalogTopics(member.catalog))),
  ]);
  const selected = unique(values(config.delivery?.githubTopics).map(normalizeTopic).filter(Boolean));
  const unknown = selected.filter((topic) => !availableTopics.includes(topic));
  if (unknown.length) problems.push(`精选 GitHub Topics 必须来自项目或案例核心标签：${unknown.join("、")}`);
  const topics = projectCatalogTopics(config);
  if (topics.length > 20) problems.push(`精选 GitHub Topics 最多 20 个，当前为 ${topics.length} 个`);
  return unique(problems);
}
