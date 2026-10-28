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

// 位置型批注：锚在块首，解析为长度为零的点。
const point = {target:{selector:Anchors.makePointSelector('甲乙丙丁', 2, '丙丁')}};
assert.deepEqual(locate('甲乙丙丁', point), [2, 2]);
assert.equal(Anchors.resolve('甲乙丙丁', point).point, true);
assert.equal(Anchors.kind(point), 'point');
// 文档被编辑后靠块首文字指纹重新定位。
assert.deepEqual(locate('新增前文 甲乙丙丁', point), [7, 7]);
// 同样的块首文字出现多次时，用前后文消歧。
const repeated = {target:{selector:Anchors.makePointSelector('重复\n\n重复\n\n重复', 4, '重复')}};
assert.deepEqual(locate('重复\n\n重复\n\n重复', repeated), [4, 4]);
// 无文字块（分隔线、图片）退化为字符偏移。
const emptyPoint = {target:{selector:Anchors.makePointSelector('甲乙', 2, '')}};
assert.deepEqual(locate('甲乙', emptyPoint), [2, 2]);
// 有文字但块首指纹消失（段落被删除）应判失锚，而不是静默漂移。
assert.equal(Anchors.resolve('完全不同', point), null);
// 旧版全文批注按文首位置批注兼容解析。
const legacyDocument = {target:{selector:[
  {type:'x-mdhtml-anchor', kind:'document', label:'全文'},
  {type:'TextPositionSelector', start:0, end:0}
]}};
assert.deepEqual(locate('任意内容', legacyDocument), [0, 0]);
assert.equal(Anchors.resolve('任意内容', legacyDocument).point, true);
assert.equal(Anchors.kind(legacyDocument), 'point');
assert.equal(Anchors.label(legacyDocument), '文首');
assert.equal(Anchors.kind(note('甲乙丙', 0, 1)), 'range');
console.log('批注锚定：OK');
