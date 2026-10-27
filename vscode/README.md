# mdhtml VSCode 扩展

把本目录复制到 `~/.vscode/extensions/mdhtml`，重启 VSCode；也可以在 VSCode 中打开本目录，按 F5 启动扩展开发宿主。目录中的模板和 drawio viewer 是独立安装所需的资源副本。无需安装依赖或构建。

打开 `.md` 文件后，选择“使用以下编辑器重新打开…”→ **mdhtml**。扩展以同一份 `template.html` 显示正文、大纲、批注和可用的 drawio 图。右上角“编辑”可切换源码与预览。

网页里的“保存”将 Markdown（包括末尾批注注释块）更新到 VSCode 文档缓冲区，标签页会显示未保存标记；再用 VSCode 的 Cmd/Ctrl+S 写入磁盘。外部更改会自动更新页面；若页面尚有未提交的修改，会保留本地内容并提示冲突。新加 drawio 代码块后，先保存，再重新打开编辑器以载入渲染器。
