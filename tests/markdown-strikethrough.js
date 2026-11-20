'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const template = fs.readFileSync(path.join(__dirname, '..', 'template.html'), 'utf8');
const library = template.match(/<script id="marked-library">([\s\S]*?)<\/script>/)[1];
const config = template.match(/<script id="mdhtml-marked-config">([\s\S]*?)<\/script>/)[1];

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(library, sandbox);
vm.runInContext(config, sandbox);
const parse = markdown => sandbox.marked.parse(markdown);

// 单个 ~ 必须保持原样：路径里的 ~ 很常见，不能被当成删除线。
assert.equal(parse('路径 ~/.local/bin:~/.config 结尾'), '<p>路径 ~/.local/bin:~/.config 结尾</p>\n');
assert.equal(parse('~x~ 和 ~y~'), '<p>~x~ 和 ~y~</p>\n');
assert.equal(parse('路径 ~/a 到 ~/b'), '<p>路径 ~/a 到 ~/b</p>\n');
// 成对的 ~~ 仍然是删除线。
assert.equal(parse('~~删除~~'), '<p><del>删除</del></p>\n');
assert.equal(parse('前 ~~删除~~ 后'), '<p>前 <del>删除</del> 后</p>\n');
// 行内三个及以上的 ~ 不构成删除线（行首的 ~~~ 仍按围栏代码块处理）。
assert.equal(parse('前 ~~~x~~~ 后'), '<p>前 ~~~x~~~ 后</p>\n');
// 代码块里的 ~ 原样保留。
assert.equal(parse('```\n~/.local/bin\n```'), '<pre><code>~/.local/bin\n</code></pre>\n');
// 转义后的 ~ 保持字面量。
assert.equal(parse('\\~x~'), '<p>~x~</p>\n');

console.log('Markdown 删除线：OK');
