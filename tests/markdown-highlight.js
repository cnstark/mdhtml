const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const template = fs.readFileSync(path.join(__dirname, '..', 'template.html'), 'utf8');
const app = template.match(/<script id="mdhtml-app">\n([\s\S]*?)<\/script>/)[1];
const start = app.indexOf('function tokenizeMarkdown(');
const end = app.indexOf('/* 模板的 Base64', start);
const tokenizeMarkdown = vm.runInNewContext(app.slice(start, end) + '\ntokenizeMarkdown');
const has = (source, fragment) => assert.ok(tokenizeMarkdown(source).includes(fragment), `${source}: missing ${fragment}`);
const text = html => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

has('# Title', '<span class="hl-heading-mark">#</span> <span class="hl-heading-text hl-heading-level-1">Title</span>');
has('### 标题', '<span class="hl-heading-mark">###</span> <span class="hl-heading-text hl-heading-level-3">标题</span>');
has('> 引用', '<span class="hl-quote">&gt; </span>引用');
has('- item', '<span class="hl-list">-</span> item');
has('12. item', '<span class="hl-list">12.</span> item');
has('+ [x] done', '<span class="hl-list">[x] </span>done');
has('**bold** *em* ~~gone~~', '<span class="hl-strong">**bold**</span> <span class="hl-em">*em*</span> <span class="hl-strike">~~gone~~</span>');
has('`**literal**`', '<span class="hl-code">`**literal**`</span>');
has('[label](https://a.test/?x=1&y=2)', '<span class="hl-link-text">label</span><span class="hl-mark">](</span><span class="hl-url">https://a.test/?x=1&amp;y=2</span>');
has('![alt](diagram.png)', '<span class="hl-mark">![</span><span class="hl-link-text">alt</span>');
has('```js\n**raw**\n```', '<span class="hl-fence-text">**raw**</span>');
has('```drawio\n<mxGraphModel/>\n```', '<span class="hl-drawio">&lt;mxGraphModel/&gt;</span>');
assert.ok(!tokenizeMarkdown('```drawio\n**raw**\n```').includes('hl-strong'));
assert.equal(text(tokenizeMarkdown('<script>alert("x")</script> & a')), '<script>alert("x")</script> & a');
assert.ok(!tokenizeMarkdown('<script>').includes('<script>'));
for (const source of ['', 'plain\n', 'a **b** c', '> - [ ] task\n', '```\n# no heading\n```\n# yes']) {
  assert.equal(text(tokenizeMarkdown(source)), source);
}
console.log('Markdown 语法高亮：OK');
