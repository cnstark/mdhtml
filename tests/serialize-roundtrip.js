const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdhtml-roundtrip-'));
try {
  const input = path.join(dir, 'source.md');
  const output = path.join(dir, 'source.md.html');
  const saved = path.join(dir, 'saved.md.html');
  const markdown = '# 中文 & <标题> "引号"\n\n原样保留 </script>、<\\/script>、\\\\ 和 emoji 🌿\n';
  const notes = [{text: '批注 </script> & "引号" \\ 🌿'}];
  fs.writeFileSync(input, markdown);
  execFileSync('python3', [path.join(root, 'mdhtml'), 'build', input, '-o', output]);
  const built = fs.readFileSync(output, 'utf8');
  const base64 = built.match(/const TEMPLATE_BASE64 = "([^"]+)";/)[1];
  const template = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
  const app = template.match(/<script id="mdhtml-app">\n([\s\S]*?)<\/script>/)[1];
  const functions = app.slice(app.indexOf('function escapeMarkdown('), app.indexOf('function downloadHtml('));
  const context = {TEMPLATE_BASE64: base64, TEMPLATE: Buffer.from(base64, 'base64').toString('utf8'), viewerScript: null};
  vm.createContext(context);
  vm.runInContext(functions, context);
  const html = vm.runInContext('serialize(markdown, notes)', Object.assign(context, {markdown, notes}));
  fs.writeFileSync(saved, html);
  const extracted = execFileSync('python3', [path.join(root, 'mdhtml'), 'extract', saved], {encoding: 'utf8'});
  assert.equal(extracted, markdown);
  assert.deepEqual(JSON.parse(html.match(/<script id="annotations" type="application\/json">(.*?)<\/script>/s)[1]), notes);
  execFileSync('python3', [path.join(root, 'mdhtml'), 'check', saved]);
  console.log('serialize → CLI extract/check: OK');
} finally {
  fs.rmSync(dir, {recursive:true, force:true});
}
