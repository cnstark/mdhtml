const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const template = fs.readFileSync(path.join(__dirname, '..', 'template.html'), 'utf8');
const app = template.match(/<script id="mdhtml-app">\n([\s\S]*?)<\/script>/)[1];
const start = app.indexOf('function tokenizeMarkdown(');
const end = app.indexOf('/* 模板的 Base64', start);
const tokenizeMarkdown = vm.runInNewContext(app.slice(start, end) + '\ntokenizeMarkdown');
const unit = '# 长文档 Heading\n> 引用 **加粗** 和 [链接](https://example.com)\n- [x] 任务 `code` 与普通文字。\n';
const source = unit.repeat(Math.ceil(300000 / unit.length)).slice(0, 300000);
for (let i = 0; i < 3; i++) tokenizeMarkdown(source);
const times = [];
for (let i = 0; i < 5; i++) {
  const startTime = performance.now();
  const html = tokenizeMarkdown(source);
  times.push(performance.now() - startTime);
  assert.ok(html.length >= source.length);
}
times.sort((a, b) => a - b);
console.log(`300,000 字符 tokenize：中位数 ${times[2].toFixed(1)} ms（5 次；目标 <100 ms）`);
assert.ok(times[2] < 100, `中位数 ${times[2].toFixed(1)} ms 超过 100 ms`);
