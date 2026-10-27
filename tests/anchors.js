const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const template = fs.readFileSync(path.join(__dirname, '..', 'template.html'), 'utf8');
const app = template.match(/<script id="mdhtml-app">\n([\s\S]*?)<\/script>/)[1];
const code = app.slice(0, app.indexOf('/* 模板的 Base64'));
const Anchors = vm.runInNewContext(code + '\nAnchors');
function note(text, start, end) {
  return {target:{selector:Anchors.makeSelector(text, start, end)}};
}
function locate(text, item) {
  const found = Anchors.resolve(text, item);
  return found && [found.start, found.end];
}

assert.deepEqual(locate('甲乙丙丁', note('甲乙丙丁', 1, 3)), [1, 3]);
assert.deepEqual(locate('甲重复乙，丙重复丁', note('甲重复乙，丙重复丁', 6, 8)), [6, 8]);
const noContext = note('重复，重复', 3, 5);
noContext.target.selector[0].prefix = '不存在';
noContext.target.selector[0].suffix = '不存在';
assert.deepEqual(locate('重复，重复', noContext), [3, 5]);
assert.equal(locate('甲乙丙', note('其他文字', 0, 2)), null);
assert.deepEqual(locate('新增前文 甲乙丙丁', note('甲乙丙丁', 1, 3)), [6, 8]);
console.log('批注锚定：OK');
