#!/usr/bin/env bash
set -euo pipefail

# 从脚本位置定位仓库，允许在任意工作目录调用。
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

if [[ $# -ne 1 || ! "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "用法：scripts/release.sh <版本号>（例如 1.2.3）" >&2
  exit 1
fi

version="$1"
tag="v$version"
archive="dist/mdhtml-skill-$tag.tar.gz"
vsix="dist/mdhtml-vscode-$tag.vsix"

# 发布只接受干净的工作区，避免把未提交内容混进产物。
status="$(git status --porcelain=v1 --untracked-files=all)"
if [[ -n "$status" ]]; then
  echo "错误：工作区有未提交改动，请先清理后再发布。" >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "错误：tag $tag 已存在。" >&2
  exit 1
fi

# 所有 JavaScript 测试都必须通过，包括性能测试。
for test_file in tests/*.js; do
  echo "运行测试：$test_file"
  node "$test_file"
done

# 从当前 CLI 构建示例并检查产物，不依赖已有的 .md.html 文件。
check_dir="$(mktemp -d)"
trap 'rm -rf "$check_dir"' EXIT
for example in examples/*.md; do
  output="$check_dir/$(basename "$example").html"
  ./mdhtml build "$example" --embed-images -o "$output"
  ./mdhtml check "$output"
done

# 保持 CLI、模板和 vendor 同级；示例只打包源文件和所需资源。
# vscode/ 里的模板与 viewer 是根目录的副本，发布前先同步，防止漂移。
cp template.html vscode/template.html
cp vendor/viewer-static.min.js vscode/viewer-static.min.js
rm -rf dist/mdhtml
mkdir -p dist/mdhtml
cp skills/mdhtml/SKILL.md mdhtml template.html README.md dist/mdhtml/
cp -R vendor examples dist/mdhtml/
find dist/mdhtml/examples -type f -name '*.md.html' -delete

tar -czf "$archive" -C dist mdhtml

# VSCode 扩展单独打包成 .vsix，与 skill 一起作为发布产物。
scripts/package-vsix.sh "$version" "$vsix"
git tag "$tag"

echo "产物：$root/$archive"
echo "      $root/$vsix"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$archive" "$vsix"
else
  shasum -a 256 "$archive" "$vsix"
fi
echo "请确认产物后手动运行："
echo "  git push origin $tag"
echo "推送 tag 后 GitHub Actions 会自动重新构建并发布 Release。"
