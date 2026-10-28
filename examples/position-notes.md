# mdhtml 位置批注演示

> 打开这份文档后：左侧圆点代表已经存在的批注；把鼠标移到任意段落左侧，会出现「＋」，点击即可在块首添加一条位置批注。

这是一份用来演示 **段落位置批注** 的样例文档。它的目的不是讲功能清单，而是让你直接上手点一点。

## 为什么需要位置批注

划词批注适合「这句话写得不对」，但很多意见其实不针对句子：

- 我想在某个段落开头写「这里需要补一个例子」
- 我想在整篇文档开头写「这是初稿，重点看第三节」
- 我想把几条批注按顺序排好，直接当大纲用

这些意见没有可以划选的原文，或者划选反而会把意思切碎。位置批注就是为这种场景准备的。

## 三种典型用法

1. **段落待办**：在段落开头写下这里要补什么、删什么。
2. **全局指示**：给第一个块加位置批注，在文档开头写整体要求，比如读者是谁、重点看哪里。
3. **批注式大纲**：给每一节的开头各写一句，侧栏按文档顺序排列，就是一份可执行的目录。

## 操作方式

| 动作 | 桌面端 | 触屏 |
| --- | --- | --- |
| 给段落加位置批注 | 悬停段落，点左侧「＋」 | 长按段落 500ms，再点「＋」 |
| 查看已有批注 | 点正文左侧圆点 | 同左 |
| 划词批注 | 选中文字，点「批注」 | 同左 |
| 归档/删除批注 | 侧栏卡片底部 | 同左 |

位置批注落在块的第一个字符上，块可以是段落、标题、列表项、引用、代码块或表格。文档开头需要整体批注时，直接给第一个块加位置批注即可。

处理完的批注可以归档：正文里的标记会消失，侧栏顶部的「已归档」页签会保留这些批注，随时取消归档或删除。

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
    "id": "urn:uuid:0a3aa7e1-b7dd-4571-8720-09e46ade3980",
    "type": "Annotation",
    "created": "2026-10-28T05:20:57.599Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "这份样例故意留了几处空位，正式发布前请补一张截图。",
        "format": "text/markdown",
        "created": "2026-10-28T05:20:57.599Z"
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
          "exact": "mdhtml 位置批注演示",
          "prefix": "",
          "suffix": "\n\n打开这份文档后：左侧圆点代表已经存在的批注；把鼠标移到任意段"
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
    "id": "urn:uuid:0d045cb8-74d9-406c-aa16-3241f142af3f",
    "type": "Annotation",
    "created": "2026-10-28T05:20:57.649Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "这一节需要补一个真实案例。",
        "format": "text/markdown",
        "created": "2026-10-28T05:20:57.649Z"
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
          "start": 121,
          "end": 121
        }
      ]
    }
  },
  {
    "id": "urn:uuid:f1f4a0f0-74c2-410b-9f9e-fffbfb22da34",
    "type": "Annotation",
    "created": "2026-10-28T05:20:57.676Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "这就是我想把批注当大纲用的场景。",
        "format": "text/markdown",
        "created": "2026-10-28T05:20:57.676Z"
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
          "start": 208,
          "end": 208
        }
      ]
    }
  },
  {
    "id": "urn:uuid:432f359c-990d-4b50-84d5-4756c4e7f9cf",
    "type": "Annotation",
    "created": "2026-10-28T05:20:57.702Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "表格可以再加一列「快捷键」。",
        "format": "text/markdown",
        "created": "2026-10-28T05:20:57.702Z"
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
          "exact": "动作\n桌面端\n触屏\n\n\n\n给段落加位置批注\n悬停段落，点左侧「＋」\n长按段落 500ms，再点「＋」\n\n\n查看已有批注\n点正文左侧圆点\n同左\n\n\n划词批注\n选中文字，点「批注」\n同左\n\n\n归档/删除批注\n侧栏卡片底部\n同左\n\n",
          "prefix": "，侧栏按文档顺序排列，就是一份可执行的目录。\n\n操作方式\n\n\n\n",
          "suffix": "\n位置批注落在块的第一个字符上，块可以是段落、标题、列表项、引用"
        },
        {
          "type": "TextPositionSelector",
          "start": 394,
          "end": 394
        }
      ]
    }
  },
  {
    "id": "urn:uuid:2417b161-ed00-492d-b577-9c019577f433",
    "type": "Annotation",
    "created": "2026-10-28T05:20:57.732Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "示例只保留一个选择器就够了，减少干扰。",
        "format": "text/markdown",
        "created": "2026-10-28T05:20:57.732Z"
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
          "start": 688,
          "end": 688
        }
      ]
    }
  },
  {
    "id": "urn:uuid:fb75e97c-ee86-4211-8952-30db95e5b099",
    "type": "Annotation",
    "created": "2026-10-28T05:20:57.757Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "发布前确认这段和实际行为一致。",
        "format": "text/markdown",
        "created": "2026-10-28T05:20:57.757Z"
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
          "start": 816,
          "end": 816
        }
      ]
    }
  },
  {
    "id": "urn:uuid:67a01c3a-aa54-4d4e-aa91-490d18aa979c",
    "type": "Annotation",
    "created": "2026-10-28T05:20:57.783Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "划词批注保留黄色高亮，和蓝色的位置批注区分开。",
        "format": "text/markdown",
        "created": "2026-10-28T05:20:57.783Z"
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
          "start": 245,
          "end": 255
        }
      ]
    }
  },
  {
    "id": "urn:uuid:53419485-5d4f-4fb8-807c-a5cda1861b0f",
    "type": "Annotation",
    "created": "2026-10-28T05:20:57.812Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "这条批注已经处理完，归档后正文不再显示，可在右侧「已归档」里找回。",
        "format": "text/markdown",
        "created": "2026-10-28T05:20:57.812Z"
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
          "exact": "操作方式",
          "prefix": "节的开头各写一句，侧栏按文档顺序排列，就是一份可执行的目录。\n\n",
          "suffix": "\n\n\n\n动作\n桌面端\n触屏\n\n\n\n给段落加位置批注\n悬停段落，点"
        },
        {
          "type": "TextPositionSelector",
          "start": 386,
          "end": 386
        }
      ]
    },
    "archived": true
  }
]
-->
