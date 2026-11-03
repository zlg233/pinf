"""把公众号 HTML 归一化成三端（小程序 / App / web）都能直接渲染的版本。

背景：公众号文章由编辑器生成，图片带固定像素宽高、段落层层套 `<section>`
并写死字号字距，直接丢给小程序的 rich-text 会溢出屏幕、排版失真。
这里在**入库前**统一清洗一次，客户端只做兜底。

规则（保守）：
- 图片：`data-src` → `src`，去掉 width/height 属性与内联宽高，强制 `width:100%;height:auto`
- 排版：只保留 `text-align` 与 `color`，其余内联样式剥掉
- 表格：改成 `width:100%;table-layout:fixed;word-break:break-all`
- 安全：删除 script/style/iframe/video/object/embed，去掉 `class`、`id`、`data-*`
- 幂等：同一份 HTML 反复归一化结果不变
"""

import html
import re

DANGEROUS_TAGS = ("script", "style", "iframe", "video", "object", "embed", "noscript", "svg")
ALLOWED_STYLE_PROPS = {"text-align", "color"}
DROP_ATTR_PREFIXES = ("data-", "on")
DROP_ATTRS = {"class", "id", "width", "height", "style", "visibility", "loading", "data-src"}

IMG_STYLE = "display:block;width:100%;height:auto;border-radius:8px;margin:8px 0"
TABLE_REQUIRED = {
    "width": "100%",
    "table-layout": "fixed",
    "word-break": "break-all",
}
VOID_TAGS = {"img", "br", "hr", "input", "source"}

TAG_RE = re.compile(r"<(/?)([a-zA-Z][\w:-]*)((?:[^<>\"']|\"[^\"]*\"|'[^']*')*?)(/?)>", re.S)
ATTR_RE = re.compile(r"([\w:.-]+)(?:\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^\s\"'>]+)))?", re.S)
DANGEROUS_BLOCK_RE = re.compile(
    r"<(%s)\b[^>]*>.*?</\1\s*>" % "|".join(DANGEROUS_TAGS), re.I | re.S
)
DANGEROUS_VOID_RE = re.compile(r"<(%s)\b[^>]*/?>" % "|".join(DANGEROUS_TAGS), re.I | re.S)


def _parse_attrs(raw):
    attrs = []
    for match in ATTR_RE.finditer(raw or ""):
        name = match.group(1).lower()
        value = match.group(2)
        if value is None:
            value = match.group(3)
        if value is None:
            value = match.group(4)
        attrs.append((name, "" if value is None else html.unescape(value)))
    return attrs


def _parse_style(value):
    props = {}
    for chunk in (value or "").split(";"):
        if ":" not in chunk:
            continue
        key, _, val = chunk.partition(":")
        key = key.strip().lower()
        val = val.strip()
        if key and val:
            props[key] = val
    return props


def _compose_style(keep_props, required=None):
    parts = [f"{key}:{value}" for key, value in keep_props.items()]
    for key, value in (required or {}).items():
        parts.append(f"{key}:{value}")
    return ";".join(parts)


def _render_tag(name, attrs, self_closing):
    rendered = "".join(
        ' {0}="{1}"'.format(key, value.replace('"', "&quot;")) for key, value in attrs
    )
    closing = " /" if self_closing and name not in VOID_TAGS else ""
    return f"<{name}{rendered}{closing}>"


def _clean_tag(name, attrs, self_closing):
    kept = []
    style_props = {}
    image_src = None
    image_alt = ""

    for key, value in attrs:
        if key == "style":
            style_props = {
                prop: val
                for prop, val in _parse_style(value).items()
                if prop in ALLOWED_STYLE_PROPS
            }
            continue
        if key == "data-src":
            image_src = value
            continue
        if key == "src" and name == "img":
            image_src = image_src or value
            continue
        if key in DROP_ATTRS or key.startswith(DROP_ATTR_PREFIXES):
            continue
        if name == "img" and key == "alt":
            image_alt = value
            continue
        kept.append((key, value))

    if name == "img":
        if not image_src:
            return ""
        rendered = [("alt", image_alt)] if image_alt else []
        rendered.insert(0, ("src", image_src))
        rendered.append(("style", IMG_STYLE))
        return _render_tag("img", rendered, True)

    if name == "table":
        for key, value in TABLE_REQUIRED.items():
            style_props[key] = value

    if style_props:
        kept.append(("style", _compose_style(style_props)))

    return _render_tag(name, kept, self_closing)


def normalize_article_html(content):
    """返回归一化后的 HTML；None/空串返回空串。"""
    if not content or not content.strip():
        return ""

    text = DANGEROUS_BLOCK_RE.sub("", content)
    text = DANGEROUS_VOID_RE.sub("", text)

    def replace(match):
        closing, name, raw_attrs, self_closing = match.groups()
        name = name.lower()
        if closing:
            return f"</{name}>"
        return _clean_tag(name, _parse_attrs(raw_attrs), bool(self_closing))

    return TAG_RE.sub(replace, text)
