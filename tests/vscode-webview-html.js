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
const markdown = '# 中文 & <标题> "引号"\n\n原样保留 </script>、<\\/script>、\\\\、$& 和 emoji 🌿\n';
const resourceBase = 'vscode-webview://test/文档</script>/';
const html = buildWebviewHtml(template, markdown, {fileName:'demo.md', viewerCode, cspSource:'vscode-resource:', resourceBase});
assert.match(html, /<meta http-equiv="Content-Security-Policy"/);
assert.match(html, /script-src 'unsafe-inline'/);
assert.match(html, /img-src data:/);
assert.match(html, /img-src data: vscode-resource:/);
assert.match(html, /connect-src vscode-resource:/);
assert.ok(html.indexOf('window.mdhtmlResourceBase') < html.indexOf('<script id="md-source"'));
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
console.log('VSCode webview HTML: OK');
