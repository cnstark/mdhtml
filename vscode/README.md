# mdhtml VSCode 扩展

把本目录复制到 `~/.vscode/extensions/mdhtml`，重启 VSCode；也可以在 VSCode 中打开本目录，按 F5 启动扩展开发宿主。目录中的模板和 drawio viewer 是独立安装所需的资源副本。无需安装依赖或构建。

发布时脚本会生成 `dist/mdhtml-vscode-vX.Y.Z.vsix`，可用 `code --install-extension mdhtml-vscode-vX.Y.Z.vsix` 安装，或在扩展面板的「…」菜单里选择「从 VSIX 安装」。

双击 `.md` 文件会直接用 mdhtml 自定义编辑器打开，占据标签页而不是侧边预览。需要编辑源码时，右键标签页选择 **Reopen Editor With… → Text Editor**（中文界面为“重新打开编辑器…”→“文本编辑器”）；在原生编辑器中点击标题栏的 **用 mdhtml 打开** 图标，或从命令面板运行同名命令，即可把当前标签页换回 mdhtml。多个 `.md` 标签页各自拥有独立的 mdhtml 界面。

在原生编辑器修改正文后，mdhtml 会自动刷新。界面保留大纲、搜索、主题、正文缩放、drawio 和批注。新建、回复、编辑或删除批注会直接写入磁盘文件，两种编辑器会同步显示变化；点击工具栏的“保存”也会保存到文件。若文件只读或保存失败，状态栏会显示错误，标签页保留未保存标记。

若文档在批注保存前发生外部变化，mdhtml 会保留未提交的批注并提示检查。新加 drawio 图也可直接显示。

## 导出 .md.html

有两种入口，导出内容相同，都是当前文档缓冲区（含未保存修改和批注）生成的独立单文件 HTML：

- mdhtml 工具栏的 **导出 HTML** 按钮。
- 编辑器标题栏的 **导出 .md.html** 图标，或命令面板中的 **导出 .md.html**；不需要先打开 mdhtml。

默认保存为与 `.md` 同目录的 `xxx.md.html`，可在保存对话框中改名或换目录。导出与 CLI `mdhtml build` 一致：内联模板和样式；文档含 drawio 代码块时内联 viewer；本地 `![](x.drawio)` 图片引用会展开为 drawio 代码块（文件缺失时给出警告并保留原引用）。

本地图片仍保留相对路径，因此把导出的 HTML 移到其他目录时需一并移动图片。需要完全自包含时，可改用 CLI：`mdhtml build --embed-images xxx.md`。
