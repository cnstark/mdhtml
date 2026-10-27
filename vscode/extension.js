'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const drawioBlock = /^\s*```drawio(?:\s+[^\n]*)?\n[\s\S]*?^\s*```\s*$/im;
const drawioImage = /!\[[^\]\n]*\]\(\s*(?:<[^>\n]+\.drawio(?:[?#][^>\n]*)?>|[^\s)]+\.drawio(?:[?#][^\s)]*)?)(?:\s+["'][^"']*["'])?\s*\)/i;

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

module.exports = {activate, deactivate, buildWebviewHtml, escapeMarkdown};
