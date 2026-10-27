'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const manifest = require('../vscode/package.json');

assert.deepEqual(manifest.activationEvents, ['onCommand:mdhtml.openPreview', 'onLanguage:markdown']);
assert.equal(manifest.contributes.customEditors, undefined);
assert.deepEqual(manifest.contributes.commands[0], {
  command: 'mdhtml.openPreview', title: 'mdhtml 预览', icon: '$(open-preview)'
});
assert.deepEqual(manifest.contributes.menus['editor/title'][0], {
  command: 'mdhtml.openPreview', when: 'resourceExtname == .md', group: 'navigation'
});

const docs = new Map();
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
let command;
let panel;
let editCount = 0;
const disposable = {dispose() {}};
const vscode = {
  ViewColumn: {Beside: 2},
  Uri: {joinPath(uri) { return uri; }},
  Range: class { constructor(start, end) { this.start = start; this.end = end; } },
  WorkspaceEdit: class { replace(uri, range, value) { this.uri = uri; this.range = range; this.value = value; } },
  commands: {registerCommand(name, handler) { command = {name, handler}; return disposable; }},
  window: {
    activeTextEditor: {document: first},
    onDidChangeActiveTextEditor(handler) { listeners.active = handler; return disposable; },
    createWebviewPanel(viewType, title, column, options) {
      panel = {viewType, title, column, options, reveal(column, preserveFocus) { this.revealed = [column, preserveFocus]; },
        onDidDispose(handler) { listeners.dispose = handler; return disposable; },
        webview: {cspSource: 'vscode-resource:', asWebviewUri: uri => ({toString: () => `vscode-webview://${path.basename(uri.fsPath)}/`}),
          postMessage(message) { sent.push(message); }, onDidReceiveMessage(handler) { listeners.message = handler; return disposable; }}};
      return panel;
    }
  },
  workspace: {
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
assert.equal(command.name, 'mdhtml.openPreview');
command.handler();
assert.equal(panel.viewType, 'mdhtml.preview');
assert.equal(panel.column, vscode.ViewColumn.Beside);
assert.equal(panel.options.retainContextWhenHidden, true);
assert.match(panel.webview.html, /window.mdhtmlDocumentUri = "file:\/\/\/tmp\/first.md"/);
assert.match(panel.webview.html, /id="drawio-viewer"/);
assert.notEqual(panel.webview.html, fs.readFileSync('vscode/template.html', 'utf8'));
command.handler();
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
  listeners.dispose();
  console.log('VSCode preview panel: OK');
});
