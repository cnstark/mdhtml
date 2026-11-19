# mdhtml

一个 HTML 就是一个 md：把 Markdown 转成单文件、自包含、可离线使用的 HTML 文档，浏览器打开即可查看、编辑、批注，保存即原地覆写自身（quine 模式）。

## 功能

- **查看**：GFM 表格/任务列表、代码高亮、左侧大纲（1–6 级，子标题可逐个折叠）、右侧批注栏（可整体隐藏）、drawio 图（浏览器内渲染）、archify 图（独立 HTML 文件 iframe 内嵌，同名 SVG 作其他阅读器预览）、图片点击全屏放大、暗色主题、全文搜索、正文缩放（80%–200%，`Ctrl/⌘ +/-/0`）
- **编辑**：Markdown 源码 + 实时预览分屏，编辑界面带语法高亮
- **批注**：划词批注 + 段落块首位置批注（文档开头直接批注第一个块，可写待办或大纲），支持归档与删除；W3C Web Annotation 格式，附带在 md 源码末尾的 HTML 注释块里，extract 不丢
- **保存**：File System Access API 原地覆写（Chrome/Edge），其他浏览器降级为下载覆盖
- **单文件**：应用代码、渲染库、文档数据全部内联，零 CDN 依赖；图片可选 base64 内联；archify 图和它的预览图除外，由同目录的独立文件承载

## 截图

| 查看（大纲 / 表格 / drawio / 批注高亮） | 批注气泡与多轮回复 |
|---|---|
| ![查看模式](docs/screenshots/view.png) | ![批注气泡](docs/screenshots/annotation-popover.png) |

| 编辑（语法高亮 + 实时预览分屏） | 暗色主题 |
|---|---|
| ![编辑模式](docs/screenshots/edit.png) | ![暗色主题](docs/screenshots/dark.png) |

## 使用

```bash
./mdhtml build 笔记.md              # 生成 笔记.md.html
./mdhtml build 笔记.md --embed-images   # 本地图片转 base64 内联
./mdhtml extract 笔记.md.html       # 还原纯 Markdown（含批注注释块）
./mdhtml check 笔记.md.html         # 校验文件完整性
```

生成的 `.md.html` 用 Chrome/Edge 打开，点「保存」授权一次后即可原地保存。

## 嵌入 archify 图

archify 生成的交互 HTML 由独立文件承载，Markdown 里放一张同名预览图，紧跟一条注释指令：

```markdown
![架构图](./diagrams/web-app.svg)

<!-- mdhtml-archify: ./diagrams/web-app.html -->
```

mdhtml 会把这张图和指令合并成一个交互插槽，图片和注释都不显示；不支持 archify 的 Markdown 阅读器则正常显示图片、把注释当成普通注释。在 archify 页面点 Export → SVG · Light 就能生成同名预览图。

- 预览图必须和 HTML 同目录、同主文件名，只接受 `.svg` / `.png`；找不到配对图片时，指令本身也会内嵌交互图；
- 路径必须相对 `.md` 所在目录，只接受本地 `.html`/`.htm`，不支持远程地址；
- 配对预览图不会被 `--embed-images` 内联；`.md.html`、HTML 图和预览图是分开的文件，分发时要一起拷贝；
- 浏览器直接打开用相对路径加载；VSCode 扩展会读取同一文件后用 `srcdoc` 渲染（iframe 直接导航到 webview 资源 URI 只会得到空文档）；
- 也支持旧的代码块写法，适合没有预览图、或只在 mdhtml 里查看的场合：

  ````markdown
  ```archify
  ./diagrams/web-app.html
  ```
  ````

- 图右上角的「放大」按钮会在浮层中打开同一份交互 HTML，节点点击、缩放等交互保留；
- 图默认高 720px，可拖动下边缘调整；文件缺失时显示空白框。

## 文件格式

```
xxx.md.html = 内联应用代码 + <script type="text/markdown"> 里的 md 源码
批注 = md 源码末尾的 <!-- mdhtml-annotations [...] --> 注释块（W3C JSON）
```

详细设计见 [docs/技术方案.md](docs/技术方案.md)。给 AI agent 用的操作指南见 [skills/mdhtml/SKILL.md](skills/mdhtml/SKILL.md)（批注与 drawio 的格式和编辑流程）。

## 开发

```bash
node tests/anchors.js                  # 批注锚定测试
node tests/serialize-roundtrip.js      # 序列化往返测试
node tests/markdown-highlight.js       # 语法高亮测试
```

## 发布

维护者在干净的工作区运行 `scripts/release.sh x.y.z`。脚本会运行全部 JavaScript 测试和 examples 自检，生成 `dist/mdhtml-skill-vx.y.z.tar.gz` 和 `dist/mdhtml-vscode-vx.y.z.vsix`，并在本地创建 `vx.y.z` tag。

确认产物后推送 tag：

```bash
git push origin vx.y.z
```

推送后 GitHub Actions 会按 `.github/workflows/release.yml` 重新运行测试、构建 skill 压缩包和 VSCode 扩展，并自动创建对应的 GitHub Release。也可以在 Actions 页面重新运行失败的任务，已存在的 Release 附件会被覆盖。

使用者下载对应的 tar.gz，解压到 `~/.hermes/skills/` 或 `~/.claude/skills/` 即可。解压后得到 `mdhtml/` 目录，其中的 `mdhtml` CLI、模板和 vendor 资源同级，可直接运行 `mdhtml/mdhtml build mdhtml/examples/demo.md`。

VSCode 扩展可通过 `code --install-extension dist/mdhtml-vscode-vx.y.z.vsix` 安装，或在 VSCode 扩展面板的「…」菜单里选择「从 VSIX 安装」。
