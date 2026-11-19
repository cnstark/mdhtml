'use strict';

// 配对预览图只服务其他 Markdown 阅读器：构建时既不内联，也不提示“未内联”。
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdhtml-archify-'));
const decode = value => value.replace(/<\\\/script/gi, '</script').replace(/\\\\/g, '\\');

function buildSource() {
  const html = fs.readFileSync(path.join(dir, 'doc.md.html'), 'utf8');
  const source = html.match(/<script id="md-source" type="text\/markdown">([\s\S]*?)<\/script>/)[1];
  return decode(source);
}

try {
  fs.mkdirSync(path.join(dir, 'archify'));
  fs.writeFileSync(path.join(dir, 'archify/a.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n');
  fs.writeFileSync(path.join(dir, 'archify/a.html'), '<!doctype html><title>a</title>\n');
  fs.writeFileSync(path.join(dir, 'archify/图 1.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n');
  fs.writeFileSync(path.join(dir, 'archify/图 1.html'), '<!doctype html><title>spaced</title>\n');
  fs.writeFileSync(path.join(dir, 'doc.md'), '# 图\n\n![预览](./archify/a.svg)\n\n<!-- mdhtml-archify: ./archify/a.html -->\n\n![带空格](<./archify/图 1.svg>)\n\n<!-- mdhtml-archify: ./archify/图 1.html -->\n\n![编码](./archify/%E5%9B%BE%201.svg)\n\n<!-- mdhtml-archify: ./archify/图 1.html -->\n\n普通图片：\n\n![普通](./plain.svg)\n');
  fs.writeFileSync(path.join(dir, 'plain.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n');

  const run = (...args) => spawnSync(path.join(root, 'mdhtml'), ['build', path.join(dir, 'doc.md'), ...args], {encoding: 'utf8'});

  // 默认不内联；配对图不应该再出现“本地图片未内联”的提示。
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr.includes('archify/a.svg'), false);
  assert.equal(result.stderr.includes('图 1.svg'), false);
  assert.equal(result.stderr.includes('%E5%9B%BE'), false);
  assert.match(result.stderr, /plain\.svg/);
  assert.match(buildSource(), /!\[预览\]\(\.\/archify\/a\.svg\)/);

  // --embed-images 只内联普通图片，配对图保留相对路径，避免把预览图塞进 .md.html。
  result = run('--embed-images');
  assert.equal(result.status, 0, result.stderr);
  const embedded = buildSource();
  assert.match(embedded, /!\[预览\]\(\.\/archify\/a\.svg\)/);
  assert.match(embedded, /!\[带空格\]\(<\.\/archify\/图 1\.svg>\)/);
  assert.match(embedded, /!\[普通\]\(data:image\/svg\+xml;base64,/);
  console.log('CLI archify preview pairing: OK');
} finally {
  fs.rmSync(dir, {recursive: true, force: true});
}
