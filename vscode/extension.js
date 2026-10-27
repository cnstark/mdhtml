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

function buildWebviewHtml(template, markdown, {fileName = 'Markdown 文档', viewerCode = '', cspSource = '', resourceBase = ''} = {}) {
  const heading = markdown.match(/^#\s+(.+)$/m);
  const title = heading ? heading[1].trim() : fileName.replace(/\.md$/i, '');
  const viewer = drawioBlock.test(markdown) || drawioImage.test(markdown) ? `<script id="drawio-viewer">${viewerCode}</script>` : '';
  const resourceScript = resourceBase ? `<script>window.mdhtmlResourceBase = ${JSON.stringify(resourceBase.replace(/\/?$/, '/')).replace(/</g, '\\u003c')};</script>\n` : '';
  // 本地 Custom Editor 承载模板内联库、drawio viewer 的 eval 和样式；data: 用于内嵌图片。
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
  const provider = {
    async resolveCustomTextEditor(document, webviewPanel) {
      const webview = webviewPanel.webview;
      webview.options = {enableScripts: true, retainContextWhenHidden: true};
      webviewPanel.webview.html = buildWebviewHtml(template, document.getText(), {
        fileName: path.basename(document.uri.fsPath), viewerCode, cspSource: webview.cspSource,
        resourceBase: webview.asWebviewUri(vscode.Uri.joinPath(document.uri, '..')).toString()
      });

      let suppressContent = null;
      let saveQueue = Promise.resolve();
      const changeListener = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.uri.toString() !== document.uri.toString()) return;
        const markdown = event.document.getText();
        if (markdown === suppressContent) { suppressContent = null; return; }
        suppressContent = null;
        webview.postMessage({type: 'setContent', markdown});
      });
      const messageListener = webview.onDidReceiveMessage(message => {
        if (!message || message.type !== 'save' || typeof message.markdown !== 'string') return;
        saveQueue = saveQueue.catch(() => {}).then(async () => {
          try {
            if (document.getText() !== message.markdown) {
              const edit = new vscode.WorkspaceEdit();
              edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), message.markdown);
              suppressContent = message.markdown;
              const applied = await vscode.workspace.applyEdit(edit);
              if (!applied) throw new Error('WorkspaceEdit 未能更新文档');
            }
            if (message.saveToDisk && !await document.save()) throw new Error('无法将文档保存到磁盘');
            webview.postMessage({type: 'saveResult', id: message.id, ok: true});
          } catch (error) {
            suppressContent = null;
            webview.postMessage({type: 'saveResult', id: message.id, ok: false, error: String(error.message || error)});
          }
        });
      });
      webviewPanel.onDidDispose(() => {
        changeListener.dispose();
        messageListener.dispose();
      });
    }
  };
  context.subscriptions.push(vscode.window.registerCustomEditorProvider('mdhtml.editor', provider, {
    webviewOptions: {retainContextWhenHidden: true}
  }));
}

function deactivate() {}

module.exports = {activate, deactivate, buildWebviewHtml, escapeMarkdown};
