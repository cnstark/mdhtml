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
const markdown = '# 中文 & <标题> "引号"\n\n原样保留 </script>、<\\/script>、\\\\、$& 和 emoji 🌿\n';
const html = buildWebviewHtml(template, markdown, {fileName:'demo.md', viewerCode, cspSource:'vscode-resource:'});
assert.match(html, /<meta http-equiv="Content-Security-Policy"/);
assert.match(html, /script-src 'unsafe-inline'/);
assert.match(html, /img-src data:/);
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
console.log('VSCode webview HTML: OK');
