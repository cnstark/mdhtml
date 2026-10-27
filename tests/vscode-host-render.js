'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {buildWebviewHtml} = require('../vscode/extension');

const template = fs.readFileSync(path.join(__dirname, '..', 'template.html'), 'utf8');
const app = template.match(/<script id="mdhtml-app">\n([\s\S]*?)<\/script>/)[1];
const markedLibrary = template.match(/<script id="marked-library">([\s\S]*?)<\/script>/)[1];
const base = 'vscode-webview://test/document/';
const calls = [];
let processed = 0;

function node(name, attrs = {}) {
  return {
    name, attrs, className: '', dataset: attrs['data-drawio-index'] === undefined ? {} : {drawioIndex: attrs['data-drawio-index']},
    getAttribute(key) { return this.attrs[key] ?? null; },
    setAttribute(key, value) { this.attrs[key] = value; },
    replaceWith(replacement) {
      const index = this.parent.nodes.indexOf(this);
      replacement.parent = this.parent;
      this.parent.nodes.splice(index, 1, replacement);
    }
  };
}
function target() {
  return {
    nodes: [],
    set innerHTML(html) {
      this.html = html;
      this.nodes = [];
      for (const match of html.matchAll(/<img\b[^>]*src="([^"]*)"[^>]*>/g)) {
        const img = node('img', {src: match[1]});
        img.parent = this;
        this.nodes.push(img);
      }
      for (const match of html.matchAll(/<div class="drawio-slot" data-drawio-index="(\d+)"/g)) {
        const slot = node('div', {'data-drawio-index': match[1]});
        slot.className = 'drawio-slot';
        slot.parent = this;
        this.nodes.push(slot);
      }
    },
    querySelectorAll(selector) {
      if (selector === 'img[src]') return this.nodes.filter(item => item.name === 'img' && item.attrs.src);
      if (selector === '.drawio-slot[data-drawio-index]') return this.nodes.filter(item => item.className === 'drawio-slot' && item.dataset.drawioIndex !== undefined);
      return [];
    },
    contains(item) { return this.nodes.includes(item); }
  };
}

const viewer = target();
const preview = target();
const context = {
  window: {mdhtmlResourceBase: base, GraphViewer: true},
  document: {createElement: name => node(name)},
  DOMPurify: {sanitize: html => html},
  viewer, viewerScript: {},
  hljs: {highlightElement() {}},
  GraphViewer: {processElements() { processed++; }},
  fetch(url) {
    calls.push(url);
    return Promise.resolve({ok: true, text: () => Promise.resolve('<mxGraphModel/>')});
  }
};
vm.createContext(context);
vm.runInContext(markedLibrary, context);
vm.runInContext(app.slice(app.indexOf('function renderMarkdown('), app.indexOf('function buildOutline(')), context);

const markdown = '# 原文\n\n![图](<./images/中文 图.png>)\n\n![](./x.drawio)\n\n![远端](https://example.org/a.png)\n\n![内嵌](data:image/png;base64,AA==)\n';
async function run() {
  context.renderMarkdown(markdown, viewer);
  context.renderMarkdown(markdown, preview);
  await new Promise(resolve => setImmediate(resolve));
  for (const pane of [viewer, preview]) {
    assert.equal(pane.nodes[0].getAttribute('src'), base + './images/%E4%B8%AD%E6%96%87%20%E5%9B%BE.png');
    assert.equal(pane.nodes[1].className, 'mxgraph');
    assert.equal(JSON.parse(pane.nodes[1].getAttribute('data-mxgraph')).xml, '<mxGraphModel/>');
    assert.equal(pane.nodes[2].getAttribute('src'), 'https://example.org/a.png');
    assert.equal(pane.nodes[3].getAttribute('src'), 'data:image/png;base64,AA==');
  }
  assert.deepEqual(calls, [base + './x.drawio', base + './x.drawio']);
  assert.equal(processed, 2);
  assert.equal(context.hostResourceUrl('/absolute.png'), null);
  assert.equal(context.hostResourceUrl('blob:abc'), null);
  assert.equal(context.hostResourceUrl('http://example.org/a.png'), null);
  const blockView = target();
  context.renderMarkdown('```drawio\n<mxGraphModel/>\n```', blockView);
  assert.equal(blockView.nodes[0].className, 'mxgraph');
  assert.equal(JSON.parse(blockView.nodes[0].getAttribute('data-mxgraph')).xml, '<mxGraphModel/>');

  // 非 host 环境不改写渲染结果，也不读取外部图文件。
  context.window.mdhtmlResourceBase = undefined;
  const browserView = target();
  context.renderMarkdown('![图](./images/a.png)', browserView);
  assert.equal(browserView.nodes[0].getAttribute('src'), './images/a.png');
  assert.equal(calls.length, 2);

  const html = buildWebviewHtml(template, markdown, {resourceBase: base, cspSource: 'vscode-resource:'});
  const encoded = html.match(/<script id="md-source" type="text\/markdown">([\s\S]*?)<\/script>/)[1];
  assert.equal(encoded.replace(/<\\\/script/gi, '</script').replace(/\\\\/g, '\\'), markdown);

  const messages = [];
  const saveContext = {
    markdown, sourceEditor: {value: markdown},
    document: {body: {classList: {contains: () => true}}},
    vscodeHost: {postMessage: message => messages.push(message)},
    pendingHostSaves: new Map(), hostSaveId: 0
  };
  vm.createContext(saveContext);
  vm.runInContext(app.slice(app.indexOf('function currentMarkdown('), app.indexOf('function updateSaveState(')) + '\n' +
    app.slice(app.indexOf('async function persistHtml('), app.indexOf('async function saveDocument(')), saveContext);
  const pending = saveContext.persistHtml('', true);
  assert.equal(messages[0].markdown, markdown);
  assert.equal(messages[0].saveToDisk, true);
  saveContext.pendingHostSaves.get(messages[0].id).resolve(true);
  assert.equal(await pending, true);
  console.log('VSCode host render and save roundtrip: OK');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
