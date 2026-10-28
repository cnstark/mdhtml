'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const manifest = require('../vscode/package.json');

assert.deepEqual(manifest.activationEvents, ['onCommand:mdhtml.openPreview', 'onCommand:mdhtml.exportHtml', 'onLanguage:markdown']);
assert.equal(manifest.contributes.customEditors, undefined);
assert.deepEqual(manifest.contributes.commands, [{
  command: 'mdhtml.openPreview', title: 'mdhtml 预览', icon: '$(open-preview)'
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
  const doc = {uri, value, getText() { return this.value; }, positionAt(offset) { return offset; }};
  docs.set(uri.toString(), doc);
  return doc;
}
const first = document('first.md', '# First\n');
const second = document('second.md', '# Second\n');
const textFile = document('other.txt', 'text');
const listeners = {};
const sent = [];
const commands = new Map();
const infoMessages = [];
const warningMessages = [];
let lastWrite;
let panel;
let editCount = 0;
const disposable = {dispose() {}};
const vscode = {
  ViewColumn: {Beside: 2},
  Uri: {
    joinPath(uri, ...segments) {
      const fsPath = path.posix.normalize(segments.reduce((base, segment) => path.posix.join(base, segment), uri.fsPath));
      return {scheme: uri.scheme, fsPath, toString() { return `${uri.scheme}://${fsPath}`; }};
    },
    file(fsPath) { return {scheme: 'file', fsPath, toString() { return `file://${fsPath}`; }}; }
  },
  Range: class { constructor(start, end) { this.start = start; this.end = end; } },
  WorkspaceEdit: class { replace(uri, range, value) { this.uri = uri; this.range = range; this.value = value; } },
  commands: {registerCommand(name, handler) { commands.set(name, handler); return disposable; }},
  window: {
    activeTextEditor: {document: first},
    onDidChangeActiveTextEditor(handler) { listeners.active = handler; return disposable; },
    async showSaveDialog(options) {
      return vscode.Uri.file(options.defaultUri?.fsPath || '/tmp/document.md.html');
    },
    showInformationMessage(message) { infoMessages.push(message); },
    showWarningMessage(message) { warningMessages.push(message); },
    showErrorMessage() {},
    createWebviewPanel(viewType, title, column, options) {
      panel = {viewType, title, column, options, reveal(column, preserveFocus) { this.revealed = [column, preserveFocus]; },
        onDidDispose(handler) { listeners.dispose = handler; return disposable; },
        webview: {cspSource: 'vscode-resource:', asWebviewUri: uri => ({toString: () => `vscode-webview://${path.basename(uri.fsPath)}/`}),
          postMessage(message) { sent.push(message); }, onDidReceiveMessage(handler) { listeners.message = handler; return disposable; }}};
      return panel;
    }
  },
  workspace: {
    fs: {
      async readFile(uri) {
        if (!files.has(uri.fsPath)) throw new Error('ENOENT');
        return files.get(uri.fsPath);
      },
      async writeFile(uri, data) { lastWrite = {uri, data}; }
    },
    onDidChangeTextDocument(handler) { listeners.change = handler; return disposable; },
    async applyEdit(edit) {
      editCount++;
      const target = docs.get(edit.uri.toString());
      target.value = target.value.slice(0, edit.range.start) + edit.value + target.value.slice(edit.range.end);
      listeners.change({document: target});
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
assert.ok(commands.has('mdhtml.openPreview'));
assert.ok(commands.has('mdhtml.exportHtml'));
commands.get('mdhtml.openPreview')();
assert.equal(panel.viewType, 'mdhtml.preview');
assert.equal(panel.column, vscode.ViewColumn.Beside);
assert.equal(panel.options.retainContextWhenHidden, true);
assert.match(panel.webview.html, /window.mdhtmlDocumentUri = "file:\/\/\/tmp\/first.md"/);
assert.match(panel.webview.html, /id="drawio-viewer"/);
assert.notEqual(panel.webview.html, fs.readFileSync('vscode/template.html', 'utf8'));
commands.get('mdhtml.openPreview')();
assert.deepEqual(panel.revealed, [vscode.ViewColumn.Beside, true]);
listeners.active({document: textFile});
assert.equal(sent.length, 0);
listeners.active({document: second});
assert.equal(sent.at(-1).type, 'setContent');
assert.equal(sent.at(-1).markdown, '# Second\n');
listeners.message({type: 'contentApplied', documentUri: second.uri.toString()});
assert.match(panel.title, /second.md/);
second.value = '# Changed\n';
listeners.change({document: second});
assert.equal(sent.at(-1).markdown, '# Changed\n');
listeners.message({type: 'save', documentUri: second.uri.toString(), markdown: '# Changed\n\n<!-- note -->\n', baseMarkdown: '# Changed\n', id: 1});
setImmediate(async () => {
  assert.equal(second.value, '# Changed\n\n<!-- note -->\n');
  assert.equal(editCount, 1);
  assert.deepEqual(sent.at(-1), {type: 'saveResult', id: 1, ok: true});
  listeners.message({type: 'save', documentUri: second.uri.toString(), markdown: '# Stale\n',
    baseMarkdown: '# Changed\n', id: 2});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(second.value, '# Changed\n\n<!-- note -->\n');
  assert.equal(editCount, 1);
  assert.equal(sent.at(-1).ok, false);

  // 编辑器标题栏命令导出：默认文件名为 xxx.md.html，内容是独立 HTML。
  lastWrite = undefined;
  await commands.get('mdhtml.exportHtml')();
  assert.equal(lastWrite.uri.fsPath, '/tmp/first.md.html');
  const commandHtml = lastWrite.data.toString('utf8');
  assert.match(commandHtml, /<title>First<\/title>/);
  assert.doesNotMatch(commandHtml, /Content-Security-Policy/);
  assert.doesNotMatch(commandHtml, /@@VIEWER@@/);
  const commandSource = commandHtml.match(/<script id="md-source" type="text\/markdown">([\s\S]*?)<\/script>/)[1];
  assert.equal(commandSource.replace(/<\\\/script/gi, '</script').replace(/\\\\/g, '\\'), '# First\n');
  assert.equal(infoMessages.at(-1), '已导出 first.md.html');

  // 预览面板按钮导出：把最新 Markdown 交给扩展写盘，并回传结果。
  lastWrite = undefined;
  listeners.message({type: 'exportHtml', markdown: '# Export\n', documentUri: second.uri.toString()});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(lastWrite.uri.fsPath, '/tmp/second.md.html');
  assert.match(lastWrite.data.toString('utf8'), /<title>Export<\/title>/);
  assert.deepEqual(sent.at(-1), {type: 'exportHtmlResult', ok: true, path: '/tmp/second.md.html'});

  // 导出时把本地 .drawio 图片引用展开为代码块并内联 viewer。
  const diagram = document('diagram.md', '# Diagram\n\n![](media/a.drawio)\n');
  files.set('/tmp/media/a.drawio', Buffer.from('<mxGraphModel/>\n'));
  vscode.window.activeTextEditor = {document: diagram};
  lastWrite = undefined;
  await commands.get('mdhtml.exportHtml')();
  assert.equal(lastWrite.uri.fsPath, '/tmp/diagram.md.html');
  const diagramHtml = lastWrite.data.toString('utf8');
  assert.match(diagramHtml, /<script id="drawio-viewer">/);
  const diagramSource = diagramHtml.match(/<script id="md-source" type="text\/markdown">([\s\S]*?)<\/script>/)[1]
    .replace(/<\\\/script/gi, '</script').replace(/\\\\/g, '\\');
  assert.match(diagramSource, /```drawio\n<mxGraphModel\/>\n```/);
  assert.equal(warningMessages.length, 0);

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

  listeners.dispose();
  console.log('VSCode preview panel: OK');
});
