const SOURCES_START = "<!-- yah-sources:start -->";
const SOURCES_END = "<!-- yah-sources:end -->";

function html(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownText(value) {
  return String(value || "").replace(/[\\[\]]/g, "\\$&");
}

function markdownLink(label, url) {
  return url ? `[${markdownText(label)}](${String(url).replace(/\)/g, "%29")})` : markdownText(label);
}

function memberLinks(member) {
  const links = [];
  if (member.route) links.push({ label: "运行", url: member.route });
  if (member.cloneRepo) links.push({ label: "Clone", url: member.cloneRepo });
  if (member.sourcePage) links.push({ label: member.provider || "Provider", url: member.sourcePage });
  if (member.url) links.push({ label: "原站", url: member.url });
  return links.filter((item, index, items) => items.findIndex((candidate) => candidate.url === item.url) === index);
}

export function renderSourcesBlock(config = {}) {
  const lines = [SOURCES_START];
  if (config.mode === "collection") {
    for (const member of config.collection?.members || []) {
      const links = memberLinks(member).map((item) => markdownLink(item.label, item.url)).join(" · ");
      const meta = [member.treatment, member.status].filter(Boolean).map((value) => `\`${value}\``).join(" · ");
      lines.push(`- **${markdownText(member.title || member.slug)}**${links ? `：${links}` : ""}${meta ? ` · ${meta}` : ""}`);
    }
  } else if (config.url) lines.push(markdownLink("原站", config.url));
  lines.push(SOURCES_END);
  return lines.join("\n");
}

function removeManagedSources(readme) {
  const start = readme.indexOf(SOURCES_START);
  const end = readme.indexOf(SOURCES_END);
  let next = readme;
  if (start >= 0 && end >= start) {
    next = `${readme.slice(0, start)}${readme.slice(end + SOURCES_END.length)}`;
  }
  return next
    .replace(/(^|\n)## (?:来源与状态|参考来源)\s*\n(?=\s*(?:<!-- yah-catalog:start -->|##\s|$))/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function insertBeforeFirstSection(readme, section) {
  const catalog = readme.indexOf("<!-- yah-catalog:start -->");
  const heading = readme.search(/\n##\s/);
  const insertion = catalog >= 0 ? catalog : heading;
  if (insertion >= 0) return `${readme.slice(0, insertion).trimEnd()}\n\n${section}\n${readme.slice(insertion)}`;
  return `${readme.trimEnd()}\n\n${section}\n`;
}

export function projectReadmeSources(readme, config) {
  const cleaned = removeManagedSources(readme);
  if (config.mode === "collection") {
    return insertBeforeFirstSection(cleaned, `## 参考来源\n\n${renderSourcesBlock(config)}`);
  }
  if (!config.url || cleaned.includes(config.url)) return `${cleaned}\n`;
  return insertBeforeFirstSection(cleaned, renderSourcesBlock(config));
}

function publicLocalPath(localPath, casesRoot) {
  if (!localPath) return "";
  const normalized = String(localPath).replace(/^\.\//, "");
  const prefix = `${String(casesRoot || "cases").replace(/\/$/, "")}/`;
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : "";
}

function assetCard(asset, casesRoot) {
  const title = html(asset.title || asset.type || "素材");
  const localHref = publicLocalPath(asset.localPath, casesRoot);
  const primary = asset.sourcePage || asset.url || localHref || "";
  const preview = asset.previewUrl
    ? `<a class="asset-preview" href="${html(primary || asset.previewUrl)}"><img src="${html(asset.previewUrl)}" alt="${title}" loading="lazy"></a>`
    : "";
  const links = [
    asset.sourcePage ? `<a href="${html(asset.sourcePage)}">来源页</a>` : "",
    asset.url && asset.url !== asset.sourcePage ? `<a href="${html(asset.url)}">原始素材</a>` : "",
    localHref ? `<a href="${html(localHref)}">本地文件</a>` : "",
  ].filter(Boolean).join(" · ");
  const meta = [asset.type, asset.role, asset.license].filter(Boolean).map(html).join(" · ");
  return `<li class="asset">${preview}<div><strong>${primary ? `<a href="${html(primary)}">${title}</a>` : title}</strong><small>${meta}</small>${links ? `<nav>${links}</nav>` : ""}</div></li>`;
}

function memberCard(member, casesRoot) {
  const links = memberLinks(member);
  const primary = links[0]?.url || member.url || "#";
  const secondary = links.map((item) => `<a href="${html(item.url)}">${html(item.label)}</a>`).join(" · ");
  const assets = Array.isArray(member.assets) && member.assets.length
    ? `<details><summary>素材 ${member.assets.length}</summary><ul class="assets">${member.assets.map((asset) => assetCard(asset, casesRoot)).join("")}</ul></details>`
    : "";
  return `<li class="case"><div><a class="title" href="${html(primary)}">${html(member.title || member.slug)}</a><nav>${secondary}</nav>${assets}</div><span>${html(member.treatment || "reference-only")}</span></li>`;
}

export function renderCollectionIndex(config = {}) {
  const name = config.collection?.title || config.name || "Collection";
  const casesRoot = config.paths?.runnableCollection || "cases";
  const items = (config.collection?.members || []).map((member) => memberCard(member, casesRoot)).join("\n");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${html(name)} · Collection</title>
  <style>
    body { margin: 0; color: #24221e; background: #f1eee6; font: 16px/1.6 Georgia, serif; }
    main { width: min(920px, calc(100% - 40px)); margin: 10vh auto; }
    h1 { font-size: clamp(2.5rem, 8vw, 6rem); line-height: .9; }
    ol, ul { padding: 0; list-style: none; }
    ol { border-top: 1px solid #9a9589; }
    .case { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; padding: 20px 0; border-bottom: 1px solid #9a9589; }
    a { color: inherit; text-underline-offset: 3px; }
    .title { font-size: 1.2rem; font-weight: 700; }
    nav { margin-top: 4px; color: #6d685e; font: 12px/1.6 ui-monospace, monospace; }
    .case > span, small { color: #6d685e; font: 12px/1.6 ui-monospace, monospace; }
    details { margin-top: 14px; }
    summary { cursor: pointer; font: 12px/1.6 ui-monospace, monospace; }
    .assets { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 10px; }
    .asset { overflow: hidden; background: rgba(255,255,255,.45); }
    .asset > div { padding: 10px; }
    .asset strong, .asset small { display: block; }
    .asset-preview { display: block; aspect-ratio: 16/10; background: #ddd8cc; }
    .asset-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
  </style>
</head>
<body><main><p>Yah Web Clone · Collection</p><h1>${html(name)}</h1><ol>
${items}
  </ol></main></body>
</html>
`;
}
