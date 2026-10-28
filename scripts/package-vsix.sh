#!/usr/bin/env bash
set -euo pipefail

# 把 vscode/ 打包成可安装的 .vsix。
# 用法：scripts/package-vsix.sh <版本号> <输出.vsix>
# 版本号以发布版本为准，不修改仓库里的 vscode/package.json。
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

if [[ $# -ne 2 || ! "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "用法：scripts/package-vsix.sh <版本号> <输出.vsix>（版本号例如 1.2.3）" >&2
  exit 1
fi
version="$1"

if ! command -v zip >/dev/null 2>&1; then
  echo "错误：打包 VSIX 需要 zip 命令。" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "错误：打包 VSIX 需要 node 命令。" >&2
  exit 1
fi

mkdir -p "$(dirname "$2")"
output="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/extension"

# extension.js 在已安装扩展里从自身目录读取模板和 viewer，必须一起打包。
cp vscode/extension.js vscode/README.md vscode/template.html vscode/viewer-static.min.js "$stage/extension/"

# VSIX 元数据：package.json 是唯一来源，只覆盖发布版本号。
node - "$version" "$stage" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [version, stage] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vscode/package.json'), 'utf8'));
pkg.version = version;
fs.writeFileSync(path.join(stage, 'extension/package.json'), JSON.stringify(pkg, null, 2) + '\n');

const esc = value => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const engine = pkg.engines?.vscode || '*';

const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${esc(pkg.name)}" Version="${esc(version)}" Publisher="${esc(pkg.publisher)}" />
    <DisplayName>${esc(pkg.displayName || pkg.name)}</DisplayName>
    <Description xml:space="preserve">${esc(pkg.description || '')}</Description>
    <Categories>Other</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${esc(engine)}" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="ui" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
  </Assets>
</PackageManifest>
`;
fs.writeFileSync(path.join(stage, 'extension.vsixmanifest'), manifest);

const contentTypes = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".js" ContentType="application/javascript" />
  <Default Extension=".json" ContentType="application/json" />
  <Default Extension=".html" ContentType="text/html" />
  <Default Extension=".md" ContentType="text/markdown" />
  <Default Extension=".vsixmanifest" ContentType="text/xml" />
</Types>
`;
fs.writeFileSync(path.join(stage, '[Content_Types].xml'), contentTypes);
NODE

rm -f "$output"
(cd "$stage" && zip -q -X -D -r "$output" .)

echo "产物：$output"
