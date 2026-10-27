# mdhtml 示例

这是一个离线 Markdown 文档示例，包含常见 GFM 内容与 drawio 图。

## 表格与任务

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 表格 | 完成 | 支持 GFM |
| 高亮 | 完成 | 自动识别代码语言 |

- [x] 查看文档
- [ ] 编辑后下载保存

这段文字含有~~删除线~~。

### 代码块

```python
def greet(name):
    return f"你好，{name}！"

print(greet("mdhtml"))
```

## 本地图片

下面的图片使用相对路径，构建时可以加 `--embed-images` 内联。

![示例图](./images/sample.svg)

## drawio 内嵌流程图

下图的 XML 直接写在 Markdown 代码块里。

```drawio
<mxfile host="app.diagrams.net"><diagram id="demo" name="Page-1"><mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="Markdown" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="80" y="80" width="120" height="60" as="geometry"/></mxCell><mxCell id="3" value="HTML" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1"><mxGeometry x="300" y="80" width="120" height="60" as="geometry"/></mxCell><mxCell id="4" style="endArrow=classic;html=1;rounded=0;" edge="1" parent="1" source="2" target="3"><mxGeometry relative="1" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>
```

## drawio 外部文件引用

下图在源 Markdown 中引用 `arch.drawio`，构建时会展开为内嵌代码块。



```drawio
<mxfile host="app.diagrams.net">
  <diagram id="arch" name="构建流程">
    <mxGraphModel dx="900" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="source" value="Markdown 文档" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="60" y="100" width="150" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="build" value="构建并内联图源" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1">
          <mxGeometry x="280" y="100" width="160" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="output" value="离线 HTML" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
          <mxGeometry x="510" y="100" width="150" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="edge1" style="endArrow=classic;html=1;rounded=0;" edge="1" parent="1" source="source" target="build">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge2" style="endArrow=classic;html=1;rounded=0;" edge="1" parent="1" source="build" target="output">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```



<!-- mdhtml-annotations
[
  {
    "id": "urn:uuid:790757b7-91a5-49aa-9715-aad13f32d7d1",
    "type": "Annotation",
    "created": "2026-10-27T14:56:36.587Z",
    "body": [
      {
        "type": "TextualBody",
        "value": "这是一条示例批注：支持 **Markdown** 语法，保存在文档末尾的注释块里。",
        "format": "text/markdown",
        "created": "2026-10-27T14:56:36.587Z"
      },
      {
        "type": "TextualBody",
        "value": "补充：现在可以在同一条批注下继续回复，讨论会随文档一起保存。",
        "format": "text/markdown",
        "created": "2026-10-27T15:02:00.000Z"
      }
    ],
    "target": {
      "selector": [
        {
          "type": "TextQuoteSelector",
          "exact": "离线 Markdown ",
          "prefix": "mdhtml 示例\n这是一个",
          "suffix": "文档示例，包含常见 GFM 内容与 drawio 图。\n表格与任"
        },
        {
          "type": "TextPositionSelector",
          "start": 14,
          "end": 26
        }
      ]
    }
  }
]
-->
