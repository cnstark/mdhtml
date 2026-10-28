# mdhtml 位置批注演示

> 打开这份文档后：左侧圆点代表已经存在的批注；把鼠标移到任意段落左侧，会出现「＋」，点击即可在块首添加一条位置批注。

这是一份用来演示 **段落位置批注** 和 **全文批注** 的样例文档。它的目的不是讲功能清单，而是让你直接上手点一点。

## 为什么需要位置批注

划词批注适合「这句话写得不对」，但很多意见其实不针对句子：

- 我想在某个段落开头写「这里需要补一个例子」
- 我想在整篇文档开头写「这是初稿，重点看第三节」
- 我想把几条批注按顺序排好，直接当大纲用

这些意见没有可以划选的原文，或者划选反而会把意思切碎。位置批注就是为这种场景准备的。

## 三种典型用法

1. **段落待办**：在段落开头写下这里要补什么、删什么。
2. **全局指示**：在文档开头写整体要求，比如读者是谁、重点看哪里。
3. **批注式大纲**：给每一节的开头各写一句，侧栏按文档顺序排列，就是一份可执行的目录。

## 操作方式

| 动作 | 桌面端 | 触屏 |
| --- | --- | --- |
| 给段落加位置批注 | 悬停段落，点左侧「＋」 | 长按段落 500ms，再点「＋」 |
| 加全文批注 | 侧栏标题右侧「＋ 全文」 | 同左 |
| 查看已有批注 | 点正文左侧圆点 | 同左 |
| 划词批注 | 选中文字，点「批注」 | 同左 |

位置批注落在块的第一个字符上，块可以是段落、标题、列表项、引用、代码块或表格。

## 数据格式

位置批注仍然是 W3C Web Annotation，只是在选择器里多了一个 `x-mdhtml-anchor`：

```json
{"type": "x-mdhtml-anchor", "kind": "point", "label": "段落开头"}
```

`TextQuoteSelector.exact` 保存块首前 120 个可见字符作为指纹；文档被编辑后，运行时靠这个指纹重新找回位置。

## 已知边界

- 渲染后的 HTML 没有「行」，换行是自动折行的，所以锚定粒度是块而不是行。
- 同一段落里被软换行拆开的多行会被合并成一个块，只能挂一条位置批注。
- 块首文字被大改后，指纹匹配不到，批注会进入「失锚」区，等待重新挂载或删除。
- 无文字块（分隔线、图片）只能用字符偏移兜底，编辑后可能漂移。

---

把鼠标移到上面任意一段的左侧，试试「＋」。

<!-- mdhtml-annotations
[
  {
    "id": "urn:uuid:f78babe4-49f1-40bf-9b1c-0981c483419b",
    "type": "Annotation",
    "created": "2026-10-28T03:00:44.096Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "这份样例故意留了几处空位，正式发布前请补一张截图。",
        "format": "text/markdown",
        "created": "2026-10-28T03:00:44.096Z"
      }
    ],
    "target": {
      "selector": [
        {
          "type": "x-mdhtml-anchor",
          "kind": "document",
          "label": "全文"
        },
        {
          "type": "TextPositionSelector",
          "start": 0,
          "end": 0
        }
      ]
    }
  },
  {
    "id": "urn:uuid:2e87d52c-a8bb-47d3-a2a7-b07b10d2012d",
    "type": "Annotation",
    "created": "2026-10-28T03:00:44.149Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "这一节需要补一个真实案例。",
        "format": "text/markdown",
        "created": "2026-10-28T03:00:44.149Z"
      }
    ],
    "target": {
      "selector": [
        {
          "type": "x-mdhtml-anchor",
          "kind": "point",
          "label": "标题开头"
        },
        {
          "type": "TextQuoteSelector",
          "exact": "为什么需要位置批注",
          "prefix": " 的样例文档。它的目的不是讲功能清单，而是让你直接上手点一点。\n",
          "suffix": "\n划词批注适合「这句话写得不对」，但很多意见其实不针对句子：\n\n"
        },
        {
          "type": "TextPositionSelector",
          "start": 128,
          "end": 128
        }
      ]
    }
  },
  {
    "id": "urn:uuid:eaa31e4d-9090-4b6e-988f-3be1008572d7",
    "type": "Annotation",
    "created": "2026-10-28T03:00:44.176Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "这就是我想把批注当大纲用的场景。",
        "format": "text/markdown",
        "created": "2026-10-28T03:00:44.176Z"
      }
    ],
    "target": {
      "selector": [
        {
          "type": "x-mdhtml-anchor",
          "kind": "point",
          "label": "列表项开头"
        },
        {
          "type": "TextQuoteSelector",
          "exact": "我想把几条批注按顺序排好，直接当大纲用",
          "prefix": "要补一个例子」\n我想在整篇文档开头写「这是初稿，重点看第三节」\n",
          "suffix": "\n\n这些意见没有可以划选的原文，或者划选反而会把意思切碎。位置批"
        },
        {
          "type": "TextPositionSelector",
          "start": 215,
          "end": 215
        }
      ]
    }
  },
  {
    "id": "urn:uuid:c75df6ac-a7bc-4c8e-ac48-431bc3450966",
    "type": "Annotation",
    "created": "2026-10-28T03:00:44.203Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "表格可以再加一列「快捷键」。",
        "format": "text/markdown",
        "created": "2026-10-28T03:00:44.203Z"
      }
    ],
    "target": {
      "selector": [
        {
          "type": "x-mdhtml-anchor",
          "kind": "point",
          "label": "表格开头"
        },
        {
          "type": "TextQuoteSelector",
          "exact": "动作\n桌面端\n触屏\n\n\n\n给段落加位置批注\n悬停段落，点左侧「＋」\n长按段落 500ms，再点「＋」\n\n\n加全文批注\n侧栏标题右侧「＋ 全文」\n同左\n\n\n查看已有批注\n点正文左侧圆点\n同左\n\n\n划词批注\n选中文字，点「批注」\n同左\n\n",
          "prefix": "，侧栏按文档顺序排列，就是一份可执行的目录。\n\n操作方式\n\n\n\n",
          "suffix": "\n位置批注落在块的第一个字符上，块可以是段落、标题、列表项、引用"
        },
        {
          "type": "TextPositionSelector",
          "start": 390,
          "end": 390
        }
      ]
    }
  },
  {
    "id": "urn:uuid:53f0ec49-6087-4189-9b72-b366c599cdfc",
    "type": "Annotation",
    "created": "2026-10-28T03:00:44.234Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "示例只保留一个选择器就够了，减少干扰。",
        "format": "text/markdown",
        "created": "2026-10-28T03:00:44.234Z"
      }
    ],
    "target": {
      "selector": [
        {
          "type": "x-mdhtml-anchor",
          "kind": "point",
          "label": "代码块开头"
        },
        {
          "type": "TextQuoteSelector",
          "exact": "{\"type\": \"x-mdhtml-anchor\", \"kind\": \"point\", \"label\": \"段落开头\"}",
          "prefix": "on，只是在选择器里多了一个 x-mdhtml-anchor：\n",
          "suffix": "TextQuoteSelector.exact 保存块首前 12"
        },
        {
          "type": "TextPositionSelector",
          "start": 609,
          "end": 609
        }
      ]
    }
  },
  {
    "id": "urn:uuid:66cb16b5-6e2b-4bfa-91db-7c111ae4b053",
    "type": "Annotation",
    "created": "2026-10-28T03:00:44.260Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "发布前确认这段和实际行为一致。",
        "format": "text/markdown",
        "created": "2026-10-28T03:00:44.260Z"
      }
    ],
    "target": {
      "selector": [
        {
          "type": "x-mdhtml-anchor",
          "kind": "point",
          "label": "标题开头"
        },
        {
          "type": "TextQuoteSelector",
          "exact": "已知边界",
          "prefix": "可见字符作为指纹；文档被编辑后，运行时靠这个指纹重新找回位置。\n",
          "suffix": "\n\n渲染后的 HTML 没有「行」，换行是自动折行的，所以锚定粒"
        },
        {
          "type": "TextPositionSelector",
          "start": 737,
          "end": 737
        }
      ]
    }
  },
  {
    "id": "urn:uuid:cce9d338-3309-4d3c-b0e9-1b4205e83496",
    "type": "Annotation",
    "created": "2026-10-28T03:00:44.285Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "划词批注保留黄色高亮，和蓝色的位置批注区分开。",
        "format": "text/markdown",
        "created": "2026-10-28T03:00:44.285Z"
      }
    ],
    "target": {
      "selector": [
        {
          "type": "TextQuoteSelector",
          "exact": "划选反而会把意思切碎",
          "prefix": "批注按顺序排好，直接当大纲用\n\n这些意见没有可以划选的原文，或者",
          "suffix": "。位置批注就是为这种场景准备的。\n三种典型用法\n\n段落待办：在段"
        },
        {
          "type": "TextPositionSelector",
          "start": 252,
          "end": 262
        }
      ]
    }
  }
]
-->
