---
name: mdhtml
description: "操作 mdhtml 单文件文档：批注与 drawio 的格式和编辑流程。"
version: 0.1.0
author: stark (cnstark), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Markdown, Annotation, Drawio, Quine]
    related_skills: [single-file-html-apps]
---

# mdhtml 文档操作

mdhtml 把 Markdown 转成自包含的 `.md.html`（应用代码 + md 源码内联，quine 模式）。本 skill 指导 agent 正确读写这类文件，重点是批注和 drawio。

## When to Use

- 需要读取/修改 `.md.html` 文档的内容、批注或 drawio 图
- 需要把 `.md` 与 `.md.html` 互转
- Don't use for: 用浏览器交互式查看文档（直接打开文件即可，无需本 skill）

## 核心规则：不要直接编辑 .md.html

产物文件含全部内联应用代码（含 drawio 时约 5MB）。**一切修改走 extract → 改 md → build**：

```bash
mdhtml extract 文档.md.html > 文档.md     # 提取（含批注注释块）
# ... 编辑 文档.md ...
mdhtml build 文档.md                      # 重新生成，含图片内联加 --embed-images
mdhtml check 文档.md.html                 # 校验
```

build 会覆盖同名 `.md.html`；模板升级（仓库里 template.html 变了）后旧文件重新 build 即完成升级。

## 批注

### 存储位置与格式

批注在 **md 源码末尾的 HTML 注释块**里（渲染不可见），W3C Web Annotation JSON 数组：

```
<!-- mdhtml-annotations
[
  {
    "id": "urn:uuid:...",
    "type": "Annotation",
    "created": "2026-10-27T14:56:36.587Z",
    "body": [
      {"type": "TextualBody", "value": "第一轮内容", "format": "text/markdown", "created": "..."},
      {"type": "TextualBody", "value": "第二轮回复", "format": "text/markdown", "created": "..."}
    ],
    "target": {"selector": [
      {"type": "TextQuoteSelector", "exact": "被批注的原文", "prefix": "前文32字", "suffix": "后文32字"},
      {"type": "TextPositionSelector", "start": 14, "end": 26}
    ]}
  }
]
-->
```

- `body` 是**数组 = 多轮线程**，追加一轮就往后加一个元素（带新 `created`）；删到最后一轮等于删整条批注
- `value` 支持 Markdown 语法
- 可选 `"archived": true` 表示已归档：仍然保存在注释块里，但正文不渲染高亮/标记；取消归档时删掉该字段（缺失或 false 即进行中）

### 位置型批注（不绑定原文）

除划词批注外，还有一种只锚定位置的**块首位置批注**（段落/标题/列表项等）。要给文档开头写整体批注，直接给第一个块加位置批注即可。它额外带一个自定义选择器，`exact` 仍是块首可见文字（无文字块为空），`TextPositionSelector` 的 `start === end`：

```json
"target": {"selector": [
  {"type": "x-mdhtml-anchor", "kind": "point", "label": "段落开头"},
  {"type": "TextQuoteSelector", "exact": "段落开头的文字", "prefix": "前文32字", "suffix": "后文32字"},
  {"type": "TextPositionSelector", "start": 14, "end": 14}
]}
```

`kind` 为 `point` 时按点锚解析，缺失或为其他值按普通范围批注解析。旧版的 `{"type":"x-mdhtml-anchor","kind":"document","label":"全文"}` 按文首位置批注兼容解析（`TextPositionSelector.start` 为 0），无需迁移。手写位置批注时同样保证 `exact` 是渲染后的纯文本。

### 锚点规则（改批注前必读）

- `exact` 匹配的是**渲染后的纯文本**，不是 md 源码——源码里的 `**加粗**` 在锚点里是 `加粗`
- `prefix`/`suffix` 各约 32 字符，用于多处匹配时消歧
- `TextPositionSelector` 是渲染纯文本的字符偏移，仅作兜底，手写时可以不准确但 quote 必须准确
- **编辑正文后批注会失锚**（exact 找不到）：修改被批注的文字时，同步更新该批注的 `exact`/`prefix`/`suffix`
- 新增批注：生成 `urn:uuid:` id，`exact` 从文档渲染文本抄录（先 `extract`，按去掉 md 语法后的文字推算）

### 转义

注释块属于 md 源码，写入 `<script type="text/markdown">` 数据块时 `</script` 一律转义为 `<\/script`。手写批注内容避免包含 `</script>`；build/check 会兜底校验，check 失败先查这里。

## drawio

两种写法（build 后都自包含，运行时浏览器内渲染）：

1. **内嵌代码块**（图源即在文档内，推荐）：

   ````
   ```drawio
   <mxfile><diagram name="流程"><mxGraphModel>...非压缩 XML...</mxGraphModel></diagram></mxfile>
   ```
   ````

2. **引用外部文件**：`![描述](./arch.drawio)` —— build 时读取并展开为内嵌代码块，产物不再依赖外部文件；extract 出来的是展开后的代码块，不会还原引用。

### 编辑既有 drawio 图

- extract → 找到 ```drawio 块 → 直接改 XML（图形就是 XML，可读可改）→ build
- 复杂修改：把 XML 存成 `.drawio` 用 drawio 桌面版编辑，再把内容贴回代码块重新 build

### 关键坑：viewer 条件注入

drawio viewer（约 4.7MB）只在 **build 时检测到 drawio 块**才内联。后果：

- 给没有 drawio 的文档新增 ```drawio 块，必须重新 build（浏览器内保存会提示，但 agent 应直接走 build 流程）
- 删掉所有 drawio 块后重新 build，产物会瘦回约 300KB

## Verification

改完后：

```bash
mdhtml check 文档.md.html                          # 数据块完整性
mdhtml extract 文档.md.html | diff - 文档.md        # 往返一致
```

浏览器端确认（`browser_exec`）：批注数 `document.querySelectorAll('.annotation-mark').length`，drawio 渲染数 `document.querySelectorAll('.mxgraph svg').length`。
