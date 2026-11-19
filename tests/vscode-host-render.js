'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {buildWebviewHtml, buildStandaloneHtml, expandDrawioImages} = require('../vscode/extension');

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
  escapeHtml: value => String(value),
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

  // 兼容其他 Markdown 阅读器：预览图和紧随其后的注释指令合并成一个插槽，
  // mdhtml 里不再显示图片，其他阅读器只看到图片、把注释当成普通注释。
  const pairView = target();
  context.renderMarkdown('## 图\n\n![预览](./archify/a.svg)\n\n<!-- mdhtml-archify: ./archify/a.html -->\n\n后续段落\n', pairView);
  assert.doesNotMatch(pairView.html, /<img/);
  assert.doesNotMatch(pairView.html, /mdhtml-archify/);
  assert.match(pairView.html, /<div class="archify-slot" data-archify-index="0"><\/div>/);
  assert.match(pairView.html, /后续段落/);
  // 图片主文件名或所在目录对不上时不配对，图片保持普通图片。
  const mismatchView = target();
  context.renderMarkdown('![别的图](./archify/b.svg)\n\n<!-- mdhtml-archify: ./archify/a.html -->\n', mismatchView);
  assert.match(mismatchView.html, /<img src="\.\/archify\/b\.svg"/);
  assert.match(mismatchView.html, /data-archify-index="0"/);
  // 只有指令（没有预览图）时仍然内嵌。
  const loneView = target();
  context.renderMarkdown('<!-- mdhtml-archify: ./archify/a.html -->\n', loneView);
  assert.match(loneView.html, /data-archify-index="0"/);
  assert.doesNotMatch(loneView.html, /mdhtml-archify/);
  // 代码围栏里的示例指令只是文字，不能被当成指令处理。
  const fencedView = target();
  context.renderMarkdown('```markdown\n![预览](./archify/a.svg)\n\n<!-- mdhtml-archify: ./archify/a.html -->\n```\n', fencedView);
  assert.doesNotMatch(fencedView.html, /archify-slot/);
  assert.match(fencedView.html, /mdhtml-archify/);
  // 带空格的中文路径用尖括号包裹也能配对。
  const spacedView = target();
  context.renderMarkdown('![预览](<./archify/图 1.svg>)\n\n<!-- mdhtml-archify: ./archify/图 1.html -->\n', spacedView);
  assert.doesNotMatch(spacedView.html, /<img/);
  assert.match(spacedView.html, /data-archify-index="0"/);
  // 图片路径里的百分号编码与指令里的原始路径等价。
  const encodedView = target();
  context.renderMarkdown('![预览](./archify/%E5%9B%BE%201.svg)\n\n<!-- mdhtml-archify: ./archify/图 1.html -->\n', encodedView);
  assert.doesNotMatch(encodedView.html, /<img/);
  assert.match(encodedView.html, /data-archify-index="0"/);
  // 预览图只接受 .svg / .png。
  const gifView = target();
  context.renderMarkdown('![预览](./archify/a.gif)\n\n<!-- mdhtml-archify: ./archify/a.html -->\n', gifView);
  assert.match(gifView.html, /<img/);
  // 两种写法共用一套索引，同一个文档里可以混用。
  const mixedView = target();
  context.renderMarkdown('![预览](./archify/a.svg)\n\n<!-- mdhtml-archify: ./archify/a.html -->\n\n```archify\n./archify/b.html\n```\n', mixedView);
  assert.match(mixedView.html, /data-archify-index="0"/);
  assert.match(mixedView.html, /data-archify-index="1"/);
  assert.doesNotMatch(mixedView.html, /<img/);

  // 非 host 环境不改写渲染结果，也不读取外部图文件。
  context.window.mdhtmlResourceBase = undefined;
  const browserView = target();
  context.renderMarkdown('![图](./images/a.png)', browserView);
  assert.equal(browserView.nodes[0].getAttribute('src'), './images/a.png');
  assert.equal(calls.length, 2);

  const html = buildWebviewHtml(template, markdown, {resourceBase: base, cspSource: 'vscode-resource:'});
  const encoded = html.match(/<script id="md-source" type="text\/markdown">([\s\S]*?)<\/script>/)[1];
  assert.equal(encoded.replace(/<\\\/script/gi, '</script').replace(/\\\\/g, '\\'), markdown);

  // 导出独立 .md.html：无 webview CSP / 资源基址，drawio 代码块内联 viewer。
  const drawioMarkdown = '# 原文\n\n```drawio\n<mxGraphModel/>\n```\n';
  const standalone = buildStandaloneHtml(template, drawioMarkdown, {fileName: 'x.md', viewerCode: 'VIEWER'});
  assert.match(standalone, /<title>原文<\/title>/);
  assert.match(standalone, /<script id="drawio-viewer">VIEWER<\/script>/);
  assert.doesNotMatch(standalone, /Content-Security-Policy/);
  assert.doesNotMatch(standalone, /window\.mdhtmlResourceBase = "/);
  const standaloneSource = standalone.match(/<script id="md-source" type="text\/markdown">([\s\S]*?)<\/script>/)[1];
  assert.equal(standaloneSource.replace(/<\\\/script/gi, '</script').replace(/\\\\/g, '\\'), drawioMarkdown);
  const standalonePlain = buildStandaloneHtml(template, '# 无图\n', {fileName: 'x.md', viewerCode: 'VIEWER'});
  assert.doesNotMatch(standalonePlain, /<script id="drawio-viewer">VIEWER<\/script>/);
  assert.doesNotMatch(standalonePlain, /<!--@@VIEWER@@-->/);

  // 导出前把本地 .drawio 图片引用展开为代码块；代码围栏和批注 JSON 不处理。
  const files = {'diagrams/a.drawio': '<mxGraphModel/>\n'};
  const readDrawio = async name => files[name] ?? null;
  const expanded = await expandDrawioImages('# T\n\n![](<diagrams/a.drawio>)\n', readDrawio);
  assert.equal(expanded.markdown, '# T\n\n\n\n```drawio\n<mxGraphModel/>\n```\n\n\n');
  assert.deepEqual(expanded.warnings, []);
  const fenced = await expandDrawioImages('```\n![](diagrams/a.drawio)\n```\n', readDrawio);
  assert.equal(fenced.markdown, '```\n![](diagrams/a.drawio)\n```\n');
  const annotated = await expandDrawioImages('![](diagrams/a.drawio)\n\n<!-- mdhtml-annotations\n[{"body":"![](missing.drawio)"}]\n-->\n', readDrawio);
  assert.match(annotated.markdown, /```drawio\n<mxGraphModel\/>\n```/);
  assert.match(annotated.markdown, /"body":"!\[\]\(missing\.drawio\)"/);
  assert.deepEqual(annotated.warnings, []);
  const missing = await expandDrawioImages('![](gone.drawio)', readDrawio);
  assert.equal(missing.markdown, '![](gone.drawio)');
  assert.deepEqual(missing.warnings, ['gone.drawio']);
  const remote = await expandDrawioImages('![](https://e/x.drawio) ![](/local/x.drawio)', readDrawio);
  assert.equal(remote.markdown, '![](https://e/x.drawio) ![](/local/x.drawio)');

  const messages = [];
  const saveContext = {
    markdown, sourceEditor: {value: markdown},
    document: {body: {classList: {contains: () => true}}},
    vscodeHost: {postMessage: message => messages.push(message)},
    pendingHostSaves: new Map(), hostSaveId: 0, savedMarkdown: markdown,
    hostDocumentUri: 'file:///test.md'
  };
  vm.createContext(saveContext);
  vm.runInContext(app.slice(app.indexOf('function currentMarkdown('), app.indexOf('function updateSaveState(')) + '\n' +
    app.slice(app.indexOf('async function persistHtml('), app.indexOf('async function saveDocument(')), saveContext);
  const pending = saveContext.persistHtml('');
  assert.equal(messages[0].markdown, markdown);
  assert.equal(messages[0].baseMarkdown, markdown);
  assert.equal(messages[0].documentUri, 'file:///test.md');
  assert.equal('saveToDisk' in messages[0], false);
  saveContext.pendingHostSaves.get(messages[0].id).resolve(true);
  assert.equal(await pending, true);

  const hostMessages = [];
  const timers = [];
  let messageHandler;
  let renders = 0;
  const pathParts = {prefix: {textContent: ''}, name: {textContent: ''}};
  const hostContext = {
    window: {addEventListener(type, handler) { if (type === 'message') messageHandler = handler; }},
    vscodeHost: {postMessage: value => hostMessages.push(value)},
    pendingHostSaves: new Map(),
    document: {body: {classList: {contains: () => false}}, getElementById: id =>
      id === 'path-prefix' ? pathParts.prefix : pathParts.name},
    documentPath: {title: ''}, sourceEditor: {value: markdown},
    markdown, savedMarkdown: markdown, hostDocumentUri: 'file:///old.md', hostRenderTimer: null,
    currentMarkdown: () => hostContext.markdown,
    syncAnnotationsFromMarkdown() {}, renderView() { renders++; },
    updateSaveState() {}, setStatus() {},
    clearTimeout() {}, setTimeout(fn, delay) { timers.push({fn, delay}); return timers.length; }
  };
  vm.createContext(hostContext);
  vm.runInContext(app.slice(app.indexOf('if (vscodeHost) window.addEventListener("message"'), app.indexOf('const outlineToggle =')), hostContext);
  messageHandler({data: {type:'setContent', markdown:'# New\n', documentUri:'file:///new.md', resourceBase:'vscode-webview://new'}});
  assert.equal(hostContext.markdown, '# New\n');
  // 宿主传来的目录基址可能没有尾斜杠，webview 要补齐，否则相对图片路径拼错。
  assert.equal(hostContext.window.mdhtmlResourceBase, 'vscode-webview://new/');
  assert.equal(pathParts.name.textContent, 'new.md');
  assert.equal(timers.at(-1).delay, 300);
  assert.equal(renders, 0);
  timers.at(-1).fn();
  assert.equal(renders, 1);
  assert.equal(hostMessages.at(-1).type, 'contentApplied');
  hostContext.markdown = '# Local note\n';
  messageHandler({data: {type:'setContent', markdown:'# External\n', documentUri:'file:///another.md'}});
  assert.equal(hostContext.markdown, '# Local note\n');
  assert.equal(hostMessages.at(-1).type, 'contentDeferred');

  // 宿主回传的内容与本地未保存改动一致时视为已同步，不报冲突。
  hostContext.markdown = '# Local note\n';
  hostContext.savedMarkdown = '# Old\n';
  const deferredCount = hostMessages.filter(message => message.type === 'contentDeferred').length;
  messageHandler({data: {type:'setContent', markdown:'# Local note\n', documentUri:'file:///old.md'}});
  assert.equal(hostContext.savedMarkdown, '# Local note\n');
  assert.equal(hostMessages.filter(message => message.type === 'contentDeferred').length, deferredCount);

  let confirmedValue;
  hostContext.pendingHostConfirms = new Map([[9, value => { confirmedValue = value; }]]);
  messageHandler({data: {type:'confirmResult', id:9, confirmed:true}});
  assert.equal(confirmedValue, true);
  assert.equal(hostContext.pendingHostConfirms.size, 0);

  const confirmMessages = [];
  const confirmContext = {
    vscodeHost: {postMessage: message => confirmMessages.push(message)},
    pendingHostConfirms: new Map(), hostConfirmId: 0, window: {confirm: () => true}
  };
  vm.createContext(confirmContext);
  vm.runInContext(app.slice(app.indexOf('function confirmAction('), app.indexOf('function cachedHandle(')), confirmContext);
  const confirmed = confirmContext.confirmAction('删除整条批注？');
  assert.equal(confirmMessages[0].type, 'confirm');
  assert.equal(confirmMessages[0].message, '删除整条批注？');
  confirmContext.pendingHostConfirms.get(confirmMessages[0].id)(true);
  assert.equal(await confirmed, true);
  confirmContext.vscodeHost = null;
  assert.equal(await confirmContext.confirmAction('浏览器确认'), true);

  const annotationTimers = [];
  const annotationContext = {
    invalidAnnotationBlock: false, annotations: [], markdown: '# Note\n',
    sourceEditor: {value: ''}, vscodeHost: {}, hostSaveFailed: true, hostSaveTimer: null,
    writeAnnotations: value => value + '<!-- note -->',
    updateSaveState() {}, clearTimeout() {},
    setTimeout(fn, delay) { annotationTimers.push({fn, delay}); return 1; },
    saveDocument() { annotationTimers.push({saved: true}); }
  };
  vm.createContext(annotationContext);
  vm.runInContext(app.slice(app.indexOf('function syncMarkdownFromAnnotations()'), app.indexOf('function serialize(')), annotationContext);
  assert.equal(annotationContext.syncMarkdownFromAnnotations(), true);
  assert.equal(annotationContext.sourceEditor.value, '# Note\n<!-- note -->');
  assert.equal(annotationTimers[0].delay, 100);
  annotationTimers[0].fn();
  assert.equal(annotationTimers[1].saved, true);
  console.log('VSCode host render and save roundtrip: OK');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
