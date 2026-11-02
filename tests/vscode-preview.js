'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const manifest = require('../vscode/package.json');

assert.deepEqual(manifest.activationEvents, [
  'onCustomEditor:mdhtml.editor', 'onCommand:mdhtml.openPreview', 'onCommand:mdhtml.exportHtml'
]);
assert.deepEqual(manifest.contributes.customEditors, [{
  viewType: 'mdhtml.editor', displayName: 'mdhtml', selector: [{filenamePattern: '*.md'}], priority: 'default'
}]);
assert.deepEqual(manifest.contributes.commands, [{
  command: 'mdhtml.openPreview', title: '用 mdhtml 打开', icon: '$(open-preview)'
}, {
  command: 'mdhtml.exportHtml', title: '导出 .md.html', icon: '$(export)'
}]);
assert.deepEqual(manifest.contributes.menus['editor/title'], [{
  command: 'mdhtml.openPreview', when: 'resourceExtname == .md', group: 'navigation'
}, {
  command: 'mdhtml.exportHtml', when: 'resourceExtname == .md', group: 'navigation'
}]);

const docs = new Map();
const files = new Map();
function document(name, value) {
  const uri = {scheme: 'file', fsPath: `/tmp/${name}`, toString() { return `file:///tmp/${name}`; }};
  // value 是编辑器缓冲区，savedValue 是磁盘内容；applyEdit 只改缓冲区。
  const doc = {
    uri, value, savedValue: value, saveCount: 0,
    getText() { return this.value; }, positionAt(offset) { return offset; },
    get isDirty() { return this.value !== this.savedValue; },
    async save() { this.saveCount++; this.savedValue = this.value; return true; }
  };
  docs.set(uri.toString(), doc);
  return doc;
}
const first = document('first.md', '# First\n');
const second = document('second.md', '# Second\n');

const changes = [];
const commands = new Map();
const executeCalls = [];
const infoMessages = [];
const warningMessages = [];
const errorMessages = [];
let warningChoice;
let lastWrite;
let customEditor;
let editCount = 0;
const disposable = {dispose() {}};
const vscode = {
  ViewColumn: {Beside: 2, Active: -1},
  Uri: {
    joinPath(uri, ...segments) {
      const fsPath = path.posix.normalize(segments.reduce((base, segment) => path.posix.join(base, segment), uri.fsPath));
      return {scheme: uri.scheme, fsPath, toString() { return `${uri.scheme}://${fsPath}`; }};
    },
    file(fsPath) { return {scheme: 'file', fsPath, toString() { return `file://${fsPath}`; }}; }
  },
  Range: class { constructor(start, end) { this.start = start; this.end = end; } },
  WorkspaceEdit: class { replace(uri, range, value) { this.uri = uri; this.range = range; this.value = value; } },
  commands: {
    registerCommand(name, handler) { commands.set(name, handler); return disposable; },
    async executeCommand(name, ...args) { executeCalls.push([name, ...args]); }
  },
  window: {
    activeTextEditor: {document: first},
    registerCustomEditorProvider(viewType, provider, options) {
      customEditor = {viewType, provider, options};
      return disposable;
    },
    async showSaveDialog(options) {
      return vscode.Uri.file(options.defaultUri?.fsPath || '/tmp/document.md.html');
    },
    showInformationMessage(message) { infoMessages.push(message); },
    showWarningMessage(message) { warningMessages.push(message); return warningChoice; },
    showErrorMessage(message) { errorMessages.push(message); }
  },
  workspace: {
    fs: {
      async readFile(uri) {
        if (!files.has(uri.fsPath)) throw new Error('ENOENT');
        return files.get(uri.fsPath);
      },
      async writeFile(uri, data) { lastWrite = {uri, data}; }
    },
    onDidChangeTextDocument(handler) {
      changes.push(handler);
      return {dispose() { const index = changes.indexOf(handler); if (index >= 0) changes.splice(index, 1); }};
    },
    async applyEdit(edit) {
      editCount++;
      const target = docs.get(edit.uri.toString());
      target.value = target.value.slice(0, edit.range.start) + edit.value + target.value.slice(edit.range.end);
      for (const handler of [...changes]) handler({document: target});
      return true;
    }
  }
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'vscode') return vscode;
  return originalLoad.call(this, request, parent, isMain);
};
const {activate} = require('../vscode/extension');
activate({subscriptions: []});
Module._load = originalLoad;

function createPanel() {
  const panel = {
    active: false, sent: [],
    onDidDispose(handler) { panel.disposeHandler = handler; return disposable; },
    webview: {
      cspSource: 'vscode-resource:', html: '',
      asWebviewUri: uri => ({toString: () => `vscode-webview://${path.basename(uri.fsPath)}`}),
      postMessage(message) { panel.sent.push(message); },
      onDidReceiveMessage(handler) { panel.messageHandler = handler; return disposable; }
    }
  };
  return panel;
}
const tick = () => new Promise(resolve => setImmediate(resolve));

assert.equal(customEditor.viewType, 'mdhtml.editor');
assert.deepEqual(customEditor.options, {webviewOptions: {retainContextWhenHidden: true}});
assert.ok(commands.has('mdhtml.openPreview'));
assert.ok(commands.has('mdhtml.exportHtml'));

// 打开 .md 时直接以 mdhtml 自定义编辑器接管标签页。
const firstPanel = createPanel();
customEditor.provider.resolveCustomTextEditor(first, firstPanel);
assert.equal(firstPanel.webview.options.enableScripts, true);
assert.match(firstPanel.webview.html, /window.mdhtmlDocumentUri = "file:\/\/\/tmp\/first.md"/);
assert.match(firstPanel.webview.html, /window\.mdhtmlResourceBase = "vscode-webview:\/\/tmp\/";/);
assert.match(firstPanel.webview.html, /id="drawio-viewer"/);
assert.notEqual(firstPanel.webview.html, fs.readFileSync('vscode/template.html', 'utf8'));

first.value = '# Changed\n';
for (const handler of changes) handler({document: first});
assert.deepEqual(firstPanel.sent.at(-1), {
  type: 'setContent', markdown: '# Changed\n', documentUri: 'file:///tmp/first.md',
  resourceBase: 'vscode-webview://tmp/'
});
const beforeSaveSets = firstPanel.sent.filter(message => message.type === 'setContent').length;
firstPanel.messageHandler({type: 'save', documentUri: first.uri.toString(),
  markdown: '# Changed\n\n<!-- note -->\n', baseMarkdown: '# Changed\n', id: 1});
setImmediate(async () => {
  assert.equal(first.value, '# Changed\n\n<!-- note -->\n');
  assert.equal(editCount, 1);
  // applyEdit 只改编辑器缓冲区；保存批注必须同时写回磁盘。
  assert.equal(first.saveCount, 1);
  assert.equal(first.savedValue, '# Changed\n\n<!-- note -->\n');
  assert.deepEqual(firstPanel.sent.at(-1), {type: 'saveResult', id: 1, ok: true});
  // 保存引起的文档变更不再回传 webview。
  assert.equal(firstPanel.sent.filter(message => message.type === 'setContent').length, beforeSaveSets);

  firstPanel.messageHandler({type: 'save', documentUri: first.uri.toString(), markdown: '# Stale\n',
    baseMarkdown: '# Changed\n', id: 2});
  await tick();
  assert.equal(first.value, '# Changed\n\n<!-- note -->\n');
  assert.equal(editCount, 1);
  assert.equal(first.saveCount, 1);
  assert.equal(firstPanel.sent.at(-1).ok, false);

  // 保存之后的外部编辑仍然回传，回声标记只影响保存自身引起的那次变化。
  first.value = '# External\n';
  for (const handler of changes) handler({document: first});
  assert.deepEqual(firstPanel.sent.at(-1), {type: 'setContent', markdown: '# External\n',
    documentUri: 'file:///tmp/first.md', resourceBase: 'vscode-webview://tmp/'});

  // 删除确认走宿主弹窗，因为 webview 不执行 window.confirm。
  warningChoice = '删除';
  firstPanel.messageHandler({type: 'confirm', id: 7, message: '删除整条批注？'});
  await tick();
  assert.equal(warningMessages.at(-1), '删除整条批注？');
  assert.deepEqual(firstPanel.sent.at(-1), {type: 'confirmResult', id: 7, confirmed: true});
  warningChoice = undefined;
  firstPanel.messageHandler({type: 'confirm', id: 8, message: '删除整条批注？'});
  await tick();
  assert.deepEqual(firstPanel.sent.at(-1), {type: 'confirmResult', id: 8, confirmed: false});

  // mdhtml 界面的导出按钮：把最新 Markdown 交给扩展写盘。
  lastWrite = undefined;
  firstPanel.messageHandler({type: 'exportHtml', markdown: '# Export\n', documentUri: first.uri.toString()});
  await tick();
  assert.equal(lastWrite.uri.fsPath, '/tmp/first.md.html');
  assert.match(lastWrite.data.toString('utf8'), /<title>Export<\/title>/);
  assert.deepEqual(firstPanel.sent.at(-1), {type: 'exportHtmlResult', ok: true, path: '/tmp/first.md.html'});

  // 编辑器标题栏导出：mdhtml 自定义编辑器激活时也能找到文档。
  firstPanel.active = true;
  vscode.window.activeTextEditor = undefined;
  lastWrite = undefined;
  await commands.get('mdhtml.exportHtml')();
  assert.equal(lastWrite.uri.fsPath, '/tmp/first.md.html');
  assert.match(lastWrite.data.toString('utf8'), /<title>External<\/title>/);

  // “用 mdhtml 打开”把文本编辑器的当前标签页替换为 mdhtml。
  firstPanel.active = false;
  vscode.window.activeTextEditor = {document: second};
  const callsBefore = executeCalls.length;
  await commands.get('mdhtml.openPreview')();
  assert.deepEqual(executeCalls.at(-1), ['vscode.openWith', second.uri, 'mdhtml.editor']);
  assert.equal(executeCalls.length, callsBefore + 1);

  // 每个文档有独立的 webview；切换文档互不影响，关闭后停止接收更新。
  vscode.window.activeTextEditor = undefined;
  const secondPanel = createPanel();
  customEditor.provider.resolveCustomTextEditor(second, secondPanel);
  assert.match(secondPanel.webview.html, /window.mdhtmlDocumentUri = "file:\/\/\/tmp\/second.md"/);
  const firstSent = firstPanel.sent.length;
  second.value = '# Second changed\n';
  for (const handler of changes) handler({document: second});
  assert.equal(firstPanel.sent.length, firstSent);
  assert.equal(secondPanel.sent.at(-1).markdown, '# Second changed\n');
  secondPanel.disposeHandler();
  const secondSent = secondPanel.sent.length;
  second.value = '# Second again\n';
  for (const handler of changes) handler({document: second});
  assert.equal(secondPanel.sent.length, secondSent);

  // 导出时把本地 .drawio 图片引用展开为代码块并内联 viewer。
  const diagram = document('diagram.md', '# Diagram\n\n![](media/a.drawio)\n');
  files.set('/tmp/media/a.drawio', Buffer.from('<mxGraphModel/>\n'));
  vscode.window.activeTextEditor = {document: diagram};
  const warningCount = warningMessages.length;
  lastWrite = undefined;
  await commands.get('mdhtml.exportHtml')();
  assert.equal(lastWrite.uri.fsPath, '/tmp/diagram.md.html');
  const diagramHtml = lastWrite.data.toString('utf8');
  assert.match(diagramHtml, /<script id="drawio-viewer">/);
  const diagramSource = diagramHtml.match(/<script id="md-source" type="text\/markdown">([\s\S]*?)<\/script>/)[1]
    .replace(/<\\\/script/gi, '</script').replace(/\\\\/g, '\\');
  assert.match(diagramSource, /```drawio\n<mxGraphModel\/>\n```/);
  assert.equal(warningMessages.length, warningCount);

  // 缺失的 drawio 文件保留原引用并给出警告，导出仍继续。
  const broken = document('broken.md', '# Broken\n\n![](missing.drawio)\n');
  vscode.window.activeTextEditor = {document: broken};
  lastWrite = undefined;
  await commands.get('mdhtml.exportHtml')();
  assert.equal(lastWrite.uri.fsPath, '/tmp/broken.md.html');
  assert.equal(warningMessages.at(-1), 'drawio 文件不存在：missing.drawio');
  const brokenSource = lastWrite.data.toString('utf8').match(/<script id="md-source" type="text\/markdown">([\s\S]*?)<\/script>/)[1]
    .replace(/<\\\/script/gi, '</script').replace(/\\\\/g, '\\');
  assert.match(brokenSource, /!\[\]\(missing\.drawio\)/);

  assert.equal(errorMessages.length, 0);
  assert.equal(infoMessages.at(-1), '已导出 broken.md.html');
  console.log('VSCode custom editor: OK');
});
