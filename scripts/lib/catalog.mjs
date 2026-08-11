export const CATALOG_TAG_FIELDS = Object.freeze([
  "technology",
  "capability",
  "visualStyle",
  "subject",
]);

export const CATALOG_LABELS = Object.freeze({
  technology: "技术",
  capability: "能力",
  visualStyle: "视觉",
  subject: "主题",
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
  const keywords = unique(values(input.keywords).map((value) => String(value).trim()).filter(Boolean));
  return { schemaVersion: 1, tags, keywords };
}

export function catalogTopics(catalog) {
  const normalized = normalizeCatalog(catalog);
  return unique(CATALOG_TAG_FIELDS.flatMap((field) => normalized.tags[field]));
}

export function catalogHasContent(catalog) {
  return catalogTopics(catalog).length > 0;
}

export function catalogProblems(catalog) {
  const topics = catalogTopics(catalog);
  const problems = [];
  if (!topics.length) problems.push("至少填写一个内容标签");
  if (topics.length > 20) problems.push(`GitHub Topics 最多 20 个，当前为 ${topics.length} 个`);
  const workflow = topics.filter((topic) => WORKFLOW_TOPICS.has(topic) || topic.endsWith("-clone"));
  if (workflow.length) problems.push(`不要使用 clone/mode/workflow 系统标签：${workflow.join("、")}`);
  return problems;
}

export function projectCatalogTopics(config = {}) {
  const catalogs = [config.catalog];
  if (config.mode === "collection" && Array.isArray(config.collection?.members)) {
    catalogs.push(...config.collection.members.map((member) => member.catalog));
  }
  return unique(catalogs.flatMap((catalog) => catalogTopics(catalog)));
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
  const topics = projectCatalogTopics(config);
  if (topics.length > 20) problems.push(`项目与案例汇总后的 GitHub Topics 最多 20 个，当前为 ${topics.length} 个`);
  return unique(problems);
}
