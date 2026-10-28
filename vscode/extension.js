'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const drawioBlock = /^\s*```drawio(?:\s+[^\n]*)?\n[\s\S]*?^\s*```\s*$/im;
const drawioImage = /!\[[^\]\n]*\]\(\s*(?:<[^>\n]+\.drawio(?:[?#][^>\n]*)?>|[^\s)]+\.drawio(?:[?#][^\s)]*)?)(?:\s+["'][^"']*["'])?\s*\)/i;
const imageRef = /(!\[[^\]\n]*\]\(\s*)(<[^>\n]+>|[^\s)]+)([^\n)]*\))/g;
const fenceMark = /^ {0,3}(`{3,}|~{3,})/;

function escapeMarkdown(value) {
  return value.replace(/\\/g, '\\\\').replace(/<[/]script/gi, '<\\/script');
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildWebviewHtml(template, markdown, {fileName = 'Markdown 文档', viewerCode = '', cspSource = '', resourceBase = '', documentUri = '', alwaysViewer = false} = {}) {
  const heading = markdown.match(/^#\s+(.+)$/m);
  const title = heading ? heading[1].trim() : fileName.replace(/\.md$/i, '');
  const viewer = alwaysViewer || drawioBlock.test(markdown) || drawioImage.test(markdown) ? `<script id="drawio-viewer">${viewerCode}</script>` : '';
  const resourceScript = resourceBase || documentUri ? `<script>window.mdhtmlResourceBase = ${JSON.stringify(resourceBase.replace(/\/?$/, '/')).replace(/</g, '\\u003c')};window.mdhtmlDocumentUri = ${JSON.stringify(documentUri).replace(/</g, '\\u003c')};</script>\n` : '';
  // 本地预览承载模板内联库、drawio viewer 的 eval 和样式；data: 用于内嵌图片。
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: ${cspSource}; connect-src ${cspSource}; font-src data:;">`;
  return template.replace('<head>', `<head>\n${csp}`)
    .replace('@@TITLE@@', () => escapeHtml(title))
    .replace('<script id="md-source"', () => `${resourceScript}<script id="md-source"`)
    .replace('@@MD@@', () => escapeMarkdown(markdown))
    .replace('@@TEMPLATE_BASE64@@', Buffer.from(template, 'utf8').toString('base64'))
    .replace('<!--@@VIEWER@@-->', () => viewer);
}

// 把正文里的本地 .drawio 图片引用展开为 drawio 代码块；文件缺失时保留引用并返回警告。
// readFile(relativePath) 返回文件内容，读不到时返回 null。末尾批注 JSON 不参与替换。
async function expandDrawioImages(markdown, readFile) {
  const marker = markdown.match(/(^|\n)<!-- mdhtml-annotations\r?\n/);
  const start = marker ? marker.index + marker[1].length : -1;
  const body = start < 0 ? markdown : markdown.slice(0, start);
  const tail = start < 0 ? '' : markdown.slice(start);
  const warnings = new Set();
  const lines = body.match(/[^\n]*\n|[^\n]+$/g) || [];
  let fence = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const fenceLine = line.match(fenceMark);
    if (fenceLine) {
      const run = fenceLine[1];
      if (fence === null) fence = run;
      else if (run[0] === fence[0] && run.length >= fence.length && !line.slice(fenceLine[0].length).trim()) fence = null;
    }
    if (fence !== null || fenceLine) continue;

    let output = '';
    let last = 0;
    for (const match of line.matchAll(imageRef)) {
      output += line.slice(last, match.index);
      last = match.index + match[0].length;
      const raw = match[2];
      const destination = raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1) : raw;
      const pathPart = destination.split(/[?#]/)[0];
      if (!/\.drawio$/i.test(pathPart) || /^(?:[a-z][a-z\d+.-]*:|\/\/|#|\/)/i.test(destination)) {
        output += match[0];
        continue;
      }
      let relative;
      try {
        relative = decodeURIComponent(pathPart);
      } catch {
        output += match[0];
        continue;
      }
      const xml = await readFile(relative);
      if (xml === null) {
        warnings.add(pathPart);
        output += match[0];
        continue;
      }
      output += `\n\n\`\`\`drawio\n${xml.trim()}\n\`\`\`\n\n`;
    }
    lines[index] = output + line.slice(last);
  }
  return {markdown: lines.join('') + tail, warnings: [...warnings]};
}

// 导出独立 .md.html：与 CLI build 相同，注入模板和可选的 drawio viewer，不包含 webview 专用 CSP。
function buildStandaloneHtml(template, markdown, {fileName = 'Markdown 文档', viewerCode = ''} = {}) {
  const heading = markdown.match(/^#\s+(.+)$/m);
  const title = heading ? heading[1].trim() : fileName.replace(/\.md$/i, '');
  const viewer = drawioBlock.test(markdown) ? `<script id="drawio-viewer">${viewerCode}</script>` : '';
  return template.replace('@@TITLE@@', () => escapeHtml(title))
    .replace('@@MD@@', () => escapeMarkdown(markdown))
    .replace('@@TEMPLATE_BASE64@@', Buffer.from(template, 'utf8').toString('base64'))
    .replace('<!--@@VIEWER@@-->', () => viewer);
}

function activate(context) {
  const vscode = require('vscode');
  const resource = (parentPath, localName) => {
    const developmentPath = path.join(root, parentPath);
    return fs.readFileSync(fs.existsSync(developmentPath) ? developmentPath : path.join(__dirname, localName), 'utf8');
  };
  const template = resource('template.html', 'template.html');
  const viewerCode = resource('vendor/viewer-static.min.js', 'viewer-static.min.js');
  let panel = null;
  let panelDocument = null;
  let pendingDocument = null;
  let saveQueue = Promise.resolve();

  const isMarkdownEditor = editor => editor && editor.document.uri.fsPath.toLowerCase().endsWith('.md');
  const resourceBase = (webview, document) =>
    webview.asWebviewUri(vscode.Uri.joinPath(document.uri, '..')).toString();
  const sendDocument = document => {
    if (!panel || !document) return;
    if (document.uri.toString() === panelDocument?.uri.toString()) {
      if (pendingDocument) {
        pendingDocument = null;
        panel.webview.postMessage({type: 'setContent', markdown: document.getText(),
          documentUri: document.uri.toString(), resourceBase: resourceBase(panel.webview, document)});
      }
      return;
    }
    pendingDocument = document;
    panel.webview.postMessage({type: 'setContent', markdown: document.getText(),
      documentUri: document.uri.toString(), resourceBase: resourceBase(panel.webview, document)});
  };

  const exportMarkdown = async (document, markdown) => {
    const fileName = document.isUntitled ? 'document.md' : path.basename(document.uri.fsPath);
    const defaultUri = document.isUntitled ? undefined
      : vscode.Uri.file(path.join(path.dirname(document.uri.fsPath), `${fileName}.html`));
    const target = await vscode.window.showSaveDialog({
      defaultUri, saveLabel: '导出',
      filters: {'HTML 文件': ['html']}
    });
    if (!target) return {ok: false, canceled: true};
    try {
      let source = markdown;
      if (!document.isUntitled) {
        const readDrawio = async relativePath => {
          try {
            const file = vscode.Uri.joinPath(document.uri, '..', ...relativePath.replace(/\\/g, '/').split('/'));
            return Buffer.from(await vscode.workspace.fs.readFile(file)).toString('utf8');
          } catch {
            return null;
          }
        };
        const expanded = await expandDrawioImages(markdown, readDrawio);
        source = expanded.markdown;
        for (const missing of expanded.warnings) {
          vscode.window.showWarningMessage(`drawio 文件不存在：${missing}`);
        }
      }
      const html = buildStandaloneHtml(template, source, {fileName, viewerCode});
      await vscode.workspace.fs.writeFile(target, Buffer.from(html, 'utf8'));
      vscode.window.showInformationMessage(`已导出 ${path.basename(target.fsPath)}`);
      return {ok: true, path: target.fsPath};
    } catch (error) {
      const message = String(error.message || error);
      vscode.window.showErrorMessage(`导出失败：${message}`);
      return {ok: false, error: message};
    }
  };

  const openPreview = () => {
    const editor = vscode.window.activeTextEditor;
    if (!isMarkdownEditor(editor)) return;
    const document = editor.document;
    if (panel) {
      sendDocument(document);
      panel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }
    panel = vscode.window.createWebviewPanel('mdhtml.preview', `mdhtml 预览：${path.basename(document.uri.fsPath)}`, vscode.ViewColumn.Beside,
      {enableScripts: true, retainContextWhenHidden: true});
    panelDocument = document;
    const webview = panel.webview;
    webview.html = buildWebviewHtml(template, document.getText(), {
      fileName: path.basename(document.uri.fsPath), viewerCode, alwaysViewer: true,
      cspSource: webview.cspSource, resourceBase: resourceBase(webview, document),
      documentUri: document.uri.toString()
    });
    const messageListener = webview.onDidReceiveMessage(message => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'contentApplied' && pendingDocument?.uri.toString() === message.documentUri) {
        panelDocument = pendingDocument;
        pendingDocument = null;
        panel.title = `mdhtml 预览：${path.basename(panelDocument.uri.fsPath)}`;
        webview.postMessage({type: 'setContent', markdown: panelDocument.getText(),
          documentUri: panelDocument.uri.toString()});
        return;
      }
      if (message.type === 'contentReady' && pendingDocument) {
        sendDocument(pendingDocument);
        return;
      }
      if (message.type === 'exportHtml') {
        if (typeof message.markdown !== 'string' || message.documentUri !== panelDocument?.uri.toString()) {
          webview.postMessage({type: 'exportHtmlResult', ok: false, error: '文档已切换，请重试'});
          return;
        }
        const target = panelDocument;
        exportMarkdown(target, message.markdown).then(result => webview.postMessage({type: 'exportHtmlResult', ...result}));
        return;
      }
      if (message.type !== 'save' || typeof message.markdown !== 'string' ||
          message.documentUri !== panelDocument?.uri.toString()) return;
      const target = panelDocument;
      saveQueue = saveQueue.catch(() => {}).then(async () => {
        try {
          const before = target.getText();
          if (before !== message.markdown) {
            if (before !== message.baseMarkdown) throw new Error('文档已更新，请检查批注后重试保存');
            let start = 0;
            while (start < before.length && start < message.markdown.length &&
              before[start] === message.markdown[start]) start++;
            let end = 0;
            while (end < before.length - start && end < message.markdown.length - start &&
              before[before.length - 1 - end] === message.markdown[message.markdown.length - 1 - end]) end++;
            const edit = new vscode.WorkspaceEdit();
            edit.replace(target.uri, new vscode.Range(target.positionAt(start), target.positionAt(before.length - end)),
              message.markdown.slice(start, message.markdown.length - end));
            if (!await vscode.workspace.applyEdit(edit)) throw new Error('WorkspaceEdit 未能更新文档');
          }
          webview.postMessage({type: 'saveResult', id: message.id, ok: true});
        } catch (error) {
          webview.postMessage({type: 'saveResult', id: message.id, ok: false, error: String(error.message || error)});
        }
      });
    });
    panel.onDidDispose(() => {
      messageListener.dispose();
      panel = null;
      panelDocument = null;
      pendingDocument = null;
    });
  };

  context.subscriptions.push(vscode.commands.registerCommand('mdhtml.openPreview', openPreview));
  context.subscriptions.push(vscode.commands.registerCommand('mdhtml.exportHtml', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!isMarkdownEditor(editor)) {
      vscode.window.showWarningMessage('请先打开一个 Markdown 文件');
      return;
    }
    await exportMarkdown(editor.document, editor.document.getText());
  }));
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
    if (panel && isMarkdownEditor(editor)) sendDocument(editor.document);
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
    if (panel && !pendingDocument && panelDocument && event.document.uri.toString() === panelDocument.uri.toString()) {
      panel.webview.postMessage({type: 'setContent', markdown: event.document.getText(),
        documentUri: panelDocument.uri.toString()});
    }
  }));
}

function deactivate() {}

module.exports = {activate, deactivate, buildWebviewHtml, buildStandaloneHtml, expandDrawioImages, escapeMarkdown};
