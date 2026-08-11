# 动效录屏

只在截图无法表达时间、滚动、指针或物理变化时录屏。默认使用兼容性更广的 MP4；只有明确面向 Web 或更看重体积时选择 WebM。不要同时保留两种编码。

## 标准命令

```bash
node "$YAH" record \
  --project "$YAH_PROJECT" \
  --name hero-motion \
  --surface site \
  --route /demo/ \
  --duration 8 \
  --viewport 1440x900 \
  --format mp4 \
  --promote
```

过程阶段省略 `--promote`，视频与报告写入 `.clone/work/recordings/`。确认有文档价值后再加 `--promote`，视频进入 `docs/media/`，录制条件、文件大小和错误记录进入长期 evidence。finalize 后录制必须显式使用 `--promote` 或 `--out`。

## Ready 闸门

录屏不得包含 Loading。至少等待 `load`、`document.fonts.ready` 和可见加载层消失；复杂 Canvas/WebGL 页面显式指定：

```bash
node "$YAH" record \
  --project "$YAH_PROJECT" \
  --name reef-motion \
  --ready-selector 'canvas[data-engine]' \
  --wait-hidden '#loader' \
  --settle 6 \
  --duration 8 \
  --format mp4 \
  --promote
```

`--settle` 是 ready 后的安全稳定窗口，不计入最终时长。工具会用 FFmpeg 裁掉导航、资源加载和稳定窗口，只保留之后的指定时长。完成后必须抽查开头、中间、结尾三帧；任一帧出现 Loading、空 Canvas、布局闪烁或错误态，都不得提升。

## 动作

- `--action none`：记录自动播放的 Shader、粒子、鱼群和环境动画。
- `--action scroll`：在指定时长内平滑滚动到底部。
- `--action hover|click --selector <css>`：记录指针触发状态。
- `--action drag --selector <css> --dx 120 --dy 0`：记录拖拽或 Canvas 控制。

录制报告保留 URL、surface、route、动作、selector、ready 条件、稳定时间、裁切起点、视口、格式、时长、字节数以及 console/page error。Playwright 录屏不包含系统音频；需要声音同步时使用明确的系统捕获方案，并在文档里标注音频来源。

## GitHub README 播放器

GitHub 会清除 README 中手写的 `<video>` 标签，仓库内 MP4/WebM 的相对路径或裸 URL 只会变成普通链接。需要 README 内直接播放时，在 GitHub Markdown 编辑器里把视频作为附件上传，然后把生成的 canonical URL 单独放一行：

```markdown
https://github.com/user-attachments/assets/<attachment-id>
```

GitHub 会根据附件的 `video/mp4` 或 `video/webm` 类型渲染带 controls 的播放器。不要把带临时签名、JWT 或 S3 查询参数的重定向 URL 写入 README；只保存稳定的 `github.com/user-attachments/assets/<id>`。附件上传目前没有正式 REST API，自动化时使用已登录的 GitHub 编辑器文件上传能力，并在提交前用 GitHub Markdown Preview 确认播放器出现。
