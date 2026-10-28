# mdhtml VSCode 扩展

把本目录复制到 `~/.vscode/extensions/mdhtml`，重启 VSCode；也可以在 VSCode 中打开本目录，按 F5 启动扩展开发宿主。目录中的模板和 drawio viewer 是独立安装所需的资源副本。无需安装依赖或构建。

发布时脚本会生成 `dist/mdhtml-vscode-vX.Y.Z.vsix`，可用 `code --install-extension mdhtml-vscode-vX.Y.Z.vsix` 安装，或在扩展面板的「…」菜单里选择「从 VSIX 安装」。

双击 `.md` 文件会使用 VSCode 原生文本编辑器。在编辑器标题栏点击 **mdhtml 预览** 图标，或从命令面板运行 **mdhtml 预览**，即可在右侧打开预览面板。预览会跟随当前活动的 `.md` 编辑器；切到其他类型的文件时保持当前 Markdown 内容。关闭 Markdown 标签页不会关闭预览面板。

在原生编辑器修改正文后，预览会自动刷新。预览面板保留大纲、搜索、主题、drawio 和批注。新建、回复、编辑或删除批注会更新 VSCode 文档缓冲区，原生编辑器会立即显示变化；点击预览中的“更新文档”也只更新缓冲区。文档标签页的未保存标记由 VSCode 管理，使用原生编辑器的 Cmd/Ctrl+S 写入磁盘。

若原生文档在批注尚未更新到缓冲区时发生变化，预览会保留未提交的批注并提示检查。新加 drawio 图也可在预览中直接显示。

## 导出 .md.html

有两种入口，导出内容相同，都是当前文档缓冲区（含未保存修改和批注）生成的独立单文件 HTML：

- 预览面板工具栏的 **导出 HTML** 按钮。
- 编辑器标题栏的 **导出 .md.html** 图标，或命令面板中的 **导出 .md.html**；不需要先打开预览。

默认保存为与 `.md` 同目录的 `xxx.md.html`，可在保存对话框中改名或换目录。导出与 CLI `mdhtml build` 一致：内联模板和样式；文档含 drawio 代码块时内联 viewer；本地 `![](x.drawio)` 图片引用会展开为 drawio 代码块（文件缺失时给出警告并保留原引用）。

本地图片仍保留相对路径，因此把导出的 HTML 移到其他目录时需一并移动图片。需要完全自包含时，可改用 CLI：`mdhtml build --embed-images xxx.md`。
