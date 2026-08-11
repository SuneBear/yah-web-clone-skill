# Cloudflare Pages 交付检查

Cloudflare 的产品能力和限制可能变化；部署时先核对当前官方文档和 Wrangler 输出。

## 发布前

- 确认发布目录是本地已验证的同一份产物。
- 不直接假设发布目录永远是 `site/`。先运行 `yah.mjs prepare-deploy --project <dir>` 或根目录 `npm run build:deploy`。过程阶段发布 `.clone/work/publish/`；finalize 后发布被 Git 忽略的 `dist/`。
- `full` 的组合布局默认为 `site/ → /`、Lab 产物 `→ /__lab/`；`mirror` 只发布 `site/`；`effect` 把 Lab 产物发布到 `/`；`collection` 发布 `cases/ → /`，存在 Lab 时再挂载到 `/__lab/`。
- 若存在 `build:lab`，组合器先运行它并默认读取 `lab/dist`。其他构建命令和输出目录通过 `delivery.labBuildCommand`、`delivery.labOutputDir`、`--lab-command`、`--lab-output` 指定。
- Lab 构建工具的 public base 必须匹配 `/__lab/`。不要用部署后的路径改写补偿错误的构建配置。
- 静态发布目录顶层提供可访问的入口页面。
- 检查 SPA/Next/RSC 深层路由、重写规则和直接刷新。
- 检查字体、WASM、模型、视频、JSON 和无扩展名资源的 MIME。
- 检查单文件和总上传大小；大媒体需要时改用 R2。
- 不提交 `.wrangler/`、本地凭据、缓存或安装产物。

## 发布

- 优先复用现有 Pages 项目，不重复创建同名项目。
- 记录 Git commit、构建命令、输出目录和 deployment ID。
- 过程阶段记录 `.clone/work/publish-manifest.json` 中的实际 surface、Lab build 命令和挂载路径；部署完成后把必要字段提升到 `.clone/evidence/`。finalize 后 manifest 位于被 Git 忽略的 `dist.manifest.json`，长期部署证据位于 `docs/evidence/`。
- 网络失败时先检查部署状态，再进行有限重试，避免重复发布。
- 不把临时 preview URL 当作最终生产 URL。

## 生产验证

- 根路径和主要深层路由返回成功状态。
- `full` 还要验证 `/__lab/`、至少一个 `lab/effects/<effect>/` 深层入口、Lab 的 JS/CSS chunk 和 GUI / Preset；Collection 存在 Lab 时验证 `/__lab/` 及其构建资源。不能只确认 HTML 为 200。
- JS、CSS、字体、WASM、模型、视频和 API fixture 可加载。
- 浏览器 console/page error 与本地验证一致。
- Canvas/WebGL/WebGPU 和关键交互状态真实运行。
- GitHub README、repository homepage 和最终答复使用生产 URL。
- 如果站点仍依赖上游实时代理，明确标注其不是完全离线镜像。
