'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {buildWebviewHtml} = require('../vscode/extension');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
const viewerCode = fs.readFileSync(path.join(root, 'vendor/viewer-static.min.js'), 'utf8');
assert.equal(fs.readFileSync(path.join(root, 'vscode/template.html'), 'utf8'), template);
assert.equal(fs.readFileSync(path.join(root, 'vscode/viewer-static.min.js'), 'utf8'), viewerCode);
// 1:1 分屏（约 960px）进入移动布局：正文占满宽度，大纲变成抽屉，批注在正文下方。
assert.match(template, /@media\(max-width:1100px\)\{\.layout\{flex-wrap:wrap\}#main\{flex:0 0 100%\}#notes-panel\{position:static;width:100%/);
assert.match(template, /const mobileOutline = window\.matchMedia\("\(max-width: 1100px\)"\)/);
// 移动布局的大纲是浮层抽屉，必须有不透明背景，否则正文会从下面透出。
assert.match(template, /@media\(max-width:1100px\)\{#outline\{background:var\(--page-bg\)/);
// 大纲支持到六级标题，父标题可逐个展开/折叠，默认展开到第 3 级。
assert.match(template, /viewer\.querySelectorAll\("h1,h2,h3,h4,h5,h6"\)/);
assert.match(template, /className = "outline-caret"/);
assert.match(template, /const expanded = node\.level < 3;/);
assert.match(template, /children\.hidden = !expanded;/);
// 内部滚动条尽量少占宽度：统一细滚动条，移动布局的批注列表跟随页面滚动。
assert.match(template, /::-webkit-scrollbar\{width:8px;height:8px\}/);
assert.match(template, /@media\(max-width:1100px\)\{#notes-panel\{max-height:none;display:block;overflow:visible\}/);
// 大纲不显示滚动条，也不为它预留宽度；批注面板悬停时才显示滚动条。
assert.match(template, /#outline::-webkit-scrollbar\{display:none!important\}/);
assert.match(template, /#notes-panel::-webkit-scrollbar-thumb\{background:transparent\}/);
// 正文图片可点击放大。
assert.match(template, /id="image-lightbox"/);
assert.match(template, /target\.closest\("#viewer img, #preview img"\)/);
// 宽表格放进独立横向滚动容器，单元格不被挤压换行。
assert.match(template, /\.markdown-body \.table-scroll\{max-width:100%;overflow-x:auto\}/);
assert.match(template, /\.markdown-body \.table-scroll table\{display:table;width:max-content;max-width:none\}/);
assert.match(template, /scroller\.className = "table-scroll"/);
// 正文宽度可调并记住选择：宽屏时减少两侧留白，最后一级铺满可用宽度。
assert.match(template, /id="width-control"/);
assert.match(template, /const WIDTH_LEVELS = \[640, 720, 800, 880, 1000, 1120, 1280, 1440, 1600, null\]/);
assert.match(template, /localStorage\.getItem\("mdhtml-content-width"\)/);
assert.match(template, /viewer\.style\.maxWidth = contentWidth === null \? "none" : `\$\{contentWidth\}px`/);
const markdown = '# 中文 & <标题> "引号"\n\n原样保留 </script>、<\\/script>、\\\\、$& 和 emoji 🌿\n';
const resourceBase = 'vscode-webview://test/文档</script>/';
const html = buildWebviewHtml(template, markdown, {fileName:'demo.md', viewerCode, cspSource:'vscode-resource:', resourceBase});
assert.match(html, /<meta http-equiv="Content-Security-Policy"/);
assert.match(html, /script-src 'unsafe-inline'/);
assert.match(html, /img-src data:/);
assert.match(html, /img-src data: vscode-resource:/);
assert.match(html, /connect-src vscode-resource:/);
assert.ok(html.indexOf('window.mdhtmlResourceBase') < html.indexOf('<script id="md-source"'));
// 引导探针单独成段，应用脚本解析失败时仍能回报，用来区分“没加载”和“脚本报错”。
assert.match(html, /<script id="mdhtml-boot">/);
assert.ok(html.indexOf('<script id="mdhtml-boot">') < html.indexOf('<script id="md-source"'));
assert.match(template, /window\.__mdhtmlHost = typeof window\.acquireVsCodeApi/);
assert.match(template, /type:"webviewState", href:location\.href/);
assert.match(template, /blocks:viewer\.childElementCount/);
// archify iframe 的加载结果单独回报，区分“资源没加载”和“加载了但内部空白”。
assert.match(template, /type:"archifyFrame", status, detail:detail \|\| "", src:url, index/);
assert.match(template, /frame\.addEventListener\("load"/);
assert.match(template, /reportFrame\("timeout"\)/);
assert.match(template, /frameSrc:/);
// 记录 iframe 是否在首屏外，避免把懒加载未触发误判成加载失败。
assert.match(template, /frameTop:/);
assert.match(template, /viewportHeight:window\.innerHeight/);
// 用 fetch 复核资源状态：区分 401/404 与“加载了但内容空白”。
assert.match(template, /reportFrame\("fetch", `status=/);
assert.match(template, /securitypolicyviolation/);
// webview 下资源能取到但 src 文档渲染为空，改为读取同一文件后用 srcdoc 渲染。
assert.match(template, /await response\.text\(\)/);
assert.match(template, /frame\.srcdoc = text/);
assert.match(template, /reportFrame\("srcdoc", `bytes=\$\{text\.length\}`\)/);
// VSCode 下直接导航到资源 URL 只会得到空文档，因此不设 src；浏览器模式仍走 src。
assert.match(template, /if \(vscodeHost\) frame\.style\.visibility = "hidden";\s*else frame\.src = url;/);
assert.match(template, /if \(vscodeHost && !srcdocApplied\) return;/);
// archify 图提供独立的放大按钮，在浮层里用同一份交互 HTML 打开。
assert.match(template, /id="archify-lightbox"/);
assert.match(template, /tools\.className = "archify-tools"/);
// 放大按钮是悬浮在图右上角的放大镜图标，不显示文字。
assert.match(template, /zoomButton\.innerHTML = '<svg/);
assert.match(template, /zoomButton\.setAttribute\("aria-label", "放大查看架构图"\)/);
assert.match(template, /\.archify-tools\{position:absolute;top:8px;right:8px/);
assert.match(template, /function openArchifyLightbox\(/);
assert.match(template, /openArchifyLightbox\(url, srcdocText\)/);
assert.match(template, /frame\.srcdoc = srcdocText;/);
assert.match(template, /function closeArchifyLightbox\(/);
assert.match(template, /archify-lightbox-open/);
assert.ok(html.includes('window.mdhtmlResourceBase = "vscode-webview://test/文档\\u003c/script>/";'));
assert.match(html, /<title>中文 &amp; &lt;标题&gt; &quot;引号&quot;<\/title>/);
assert.equal(html.includes('</script>\n<script id="drawio-viewer">'), false);
assert.equal((html.match(/<script id="md-source" type="text\/markdown">([\s\S]*?)<\/script>/) || [])[1]
  .includes('</script>'), false);
const encoded = html.match(/<script id="md-source" type="text\/markdown">([\s\S]*?)<\/script>/)[1];
const decoded = encoded.replace(/<\\\/script/gi, '</script').replace(/\\\\/g, '\\');
assert.equal(decoded, markdown);
assert.equal(Buffer.from(html.match(/const TEMPLATE_BASE64 = "([^"]+)";/)[1], 'base64').toString('utf8'), template);

const diagram = buildWebviewHtml(template, '```drawio\n<mxGraphModel/>\n```\n', {viewerCode});
assert.ok(diagram.includes(`</script>\n<script id="drawio-viewer">${viewerCode}</script>\n<script id="mdhtml-app">`));
const diagramImage = buildWebviewHtml(template, '![](./x.drawio)\n', {viewerCode});
assert.ok(diagramImage.includes(`<script id="drawio-viewer">${viewerCode}</script>`));
assert.ok(buildWebviewHtml(template, '![](<./图 表.drawio>)\n', {viewerCode}).includes(`<script id="drawio-viewer">${viewerCode}</script>`));

// archify 独立 HTML 文件通过 iframe 内嵌；webview 必须放行资源域，且单文件打开时能访问同目录。
assert.match(html, /frame-src vscode-resource:/);
assert.match(template, /lang\.trim\(\)\.toLowerCase\(\) === "archify"/);
assert.match(template, /class="archify-slot" data-archify-index/);
assert.match(template, /\.archify-frame\{display:block;width:100%;height:720px/);
assert.match(template, /const url = hostResourceUrl\(src\) \|\| src;/);
assert.match(template, /else frame\.src = url;/);
const extension = fs.readFileSync(path.join(root, 'vscode/extension.js'), 'utf8');
assert.match(extension, /localResourceRoots/);
// 只允许本地相对 .html/.htm，避免把远程或绝对路径塞进 iframe。
const source = template.match(/function isLocalArchifySource\(src\) \{[\s\S]*?\n\}/)[0];
const isLocalArchifySource = new Function(`${source}; return isLocalArchifySource;`)();
assert.equal(isLocalArchifySource('./diagrams/web-app.html'), true);
assert.equal(isLocalArchifySource('diagrams/web-app.htm'), true);
assert.equal(isLocalArchifySource('./a.html?v=1#x'), true);
assert.equal(isLocalArchifySource('https://example.com/a.html'), false);
assert.equal(isLocalArchifySource('//example.com/a.html'), false);
assert.equal(isLocalArchifySource('/abs/a.html'), false);
assert.equal(isLocalArchifySource('#a.html'), false);
assert.equal(isLocalArchifySource('./a.txt'), false);
assert.equal(isLocalArchifySource('./a.html\nsecond.html'), false);
console.log('VSCode webview HTML: OK');
