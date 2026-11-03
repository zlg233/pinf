"""把公众号 HTML 归一化成三端（小程序 / App / web）都能直接渲染的版本。

公众号原文其实有很强的版式（字号、背景块、flex 卡片），但直接搬进小程序
的 rich-text 会字号失控、卡片溢出。所以这里做的是**翻译**而不是删除：

- 字号 → 我们的档位（标题 20 / 小标题 17 / 正文 15 / 图注 12）
- 带背景的块 → 引用块（浅底 + 左侧竖线）
- 带边框或圆角的块 → 卡片块（圆角 + 内边距）
- 图片 → 宽度自适应，去掉固定像素宽高
- 颜色统一到 Organic 调色板，避免和 App 风格打架

规则纯函数、幂等；原文保存在 articles.content，本结果存 content_normalized。
"""

import html
import re

DANGEROUS_TAGS = ("script", "style", "iframe", "video", "object", "embed", "noscript", "svg")
DROP_ATTR_PREFIXES = ("data-", "on")
DROP_ATTRS = {
    "class",
    "id",
    "width",
    "height",
    "style",
    "visibility",
    "loading",
    "leaf",
    "nodeleaf",
}
VOID_TAGS = {"img", "br", "hr", "input", "source"}
BLOCK_TAGS = {"p", "section", "div", "li", "ul", "ol", "td", "th", "blockquote"}
HEADING_LEVELS = {"h1": "title", "h2": "subtitle", "h3": "subtitle", "h4": "body", "h5": "body", "h6": "body"}
WORD_WRAPPER_TAGS = {"o:p"}
OFFICE_PREFIXES = ("o:", "w:", "v:")
INLINE_TAGS = {"span", "font"}

IMG_STYLE = "display:block;width:100%;height:auto;border-radius:8px;margin:8px 0"

PALETTE = {
    "title": "font-size:22px;font-weight:600;color:#2F2F2F;line-height:1.5;margin:24px 0 12px",
    "subtitle": "font-size:18px;font-weight:600;color:#2F2F2F;line-height:1.6;margin:20px 0 10px",
    "body": "font-size:15px;color:#4A4A4A;line-height:1.8;margin:0 0 12px",
    "caption": "font-size:12px;color:#999999;line-height:1.6;text-align:center;margin:8px 0 16px",
    "quote": (
        "font-size:15px;color:#5A5A5A;line-height:1.8;background:#FFF9F5;"
        "border-left:3px solid #5B9A8B;padding:12px 14px;margin:16px 0"
    ),
    "card": (
        "font-size:14px;color:#4A4A4A;line-height:1.7;background:#FFFFFF;"
        "border:1px solid #EADFD5;border-radius:12px;padding:16px;margin:16px 0"
    ),
    "strong": "font-weight:600;color:#2F2F2F",
    "list": "padding-left:20px;margin:0 0 12px;color:#4A4A4A;line-height:1.8",
    "hr": "border:none;border-top:1px solid #EADFD5;margin:20px 0",
    "table": "width:100%;table-layout:fixed;word-break:break-all;border-collapse:collapse",
}

TAG_RE = re.compile(r"<(/?)([a-zA-Z][\w:-]*)((?:[^<>\"']|\"[^\"]*\"|'[^']*')*?)(/?)>", re.S)
ATTR_RE = re.compile(r"([\w:.-]+)(?:\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^\s\"'>]+)))?", re.S)
DANGEROUS_BLOCK_RE = re.compile(
    r"<(%s)\b[^>]*>.*?</\1\s*>" % "|".join(DANGEROUS_TAGS), re.I | re.S
)
DANGEROUS_VOID_RE = re.compile(r"<(%s)\b[^>]*/?>" % "|".join(DANGEROUS_TAGS), re.I | re.S)
PX_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(px|pt|em|rem)", re.I)
EMPTY_BLOCK_RE = re.compile(r"<p\b[^>]*>(?:\s|<[^>]+>|&nbsp;)*</p>", re.I)


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


UNIT_TO_PX = {"px": 1.0, "pt": 4.0 / 3.0, "em": 16.0, "rem": 16.0}


def _font_px(props):
    """把 px / pt / em / rem 统一换算成逻辑像素。"""
    for key in ("font-size", "font_size"):
        raw = props.get(key)
        if raw:
            match = PX_RE.search(raw)
            if match:
                return float(match.group(1)) * UNIT_TO_PX.get(match.group(2).lower(), 1.0)
    return None


def _level_of(props):
    """字号档位。阈值和我们输出的档位对齐，保证二次归一化结果不变。"""
    size = _font_px(props)
    if size is None:
        return "body"
    if size >= 22:
        return "title"
    if size >= 18:
        return "subtitle"
    if size >= 13:
        return "body"
    if "center" in (props.get("text-align") or ""):
        return "caption"
    return "body"


def _block_kind(props, tag):
    """引用块 / 卡片块的识别；只对 section、div 生效，避免误伤行内元素。"""
    if tag not in ("section", "div"):
        return None
    # 先判卡片：卡片自带白底，若先判背景会被误认成引用块（破坏幂等）
    if props.get("border") or props.get("border-radius") or props.get("box-shadow"):
        return "card"
    if props.get("background") or props.get("background-color"):
        return "quote"
    return None


def _render_tag(name, attrs, self_closing):
    rendered = "".join(
        ' {0}="{1}"'.format(key, value.replace('"', "&quot;")) for key, value in attrs
    )
    closing = " /" if self_closing and name not in VOID_TAGS else ""
    return f"<{name}{rendered}{closing}>"


def _clean_tag(name, attrs, self_closing):
    props = {}
    kept = []
    image_src = None
    image_alt = ""

    for key, value in attrs:
        if key == "style":
            props = _parse_style(value)
            continue
        if key == "data-src":
            image_src = value
            continue
        if key == "src" and name == "img":
            image_src = image_src or value
            continue
        if name == "img" and key == "alt":
            image_alt = value
            continue
        if key in DROP_ATTRS or key.startswith(DROP_ATTR_PREFIXES):
            continue
        kept.append((key, value))

    if name == "img":
        if not image_src:
            return ""
        rendered = [("src", image_src)]
        if image_alt:
            rendered.append(("alt", image_alt))
        rendered.append(("style", IMG_STYLE))
        return _render_tag("img", rendered, True)

    if name in ("strong", "b"):
        kept.append(("style", PALETTE["strong"]))
        return _render_tag(name, kept, self_closing)

    if name in ("ul", "ol"):
        kept.append(("style", PALETTE["list"]))
        return _render_tag(name, kept, self_closing)

    if name == "table":
        kept.append(("style", PALETTE["table"]))
        return _render_tag(name, kept, self_closing)

    if name == "hr":
        return '<hr style="%s">' % PALETTE["hr"]

    # Word 导出的 <o:p> / <o:page> 只是包裹层，直接去掉
    if name in WORD_WRAPPER_TAGS or name.startswith(OFFICE_PREFIXES):
        return ""

    if name in HEADING_LEVELS:
        kept.append(("style", PALETTE[HEADING_LEVELS[name]]))
        return _render_tag(name, kept, self_closing)

    # 行内 span/font 只在它本身是大字号时才带样式，避免盖住外层标题档位
    if name in INLINE_TAGS:
        size = _font_px(props)
        if size is not None and size >= 22:
            kept.append(("style", PALETTE["title"]))
        elif size is not None and size >= 18:
            kept.append(("style", PALETTE["subtitle"]))
        return _render_tag(name, kept, self_closing)

    if name in BLOCK_TAGS:
        kind = _block_kind(props, name)
        if kind:
            kept.append(("style", PALETTE[kind]))
            return _render_tag(name, kept, self_closing)

        level = _level_of(props)
        style = PALETTE[level]
        align = (props.get("text-align") or "").strip().lower()
        if align in ("center", "right") and level != "caption":
            style = f"{style};text-align:{align}"
        kept.append(("style", style))
        return _render_tag(name, kept, self_closing)

    align = (props.get("text-align") or "").strip().lower()
    if align in ("center", "right"):
        kept.append(("style", f"text-align:{align}"))

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
        if name in WORD_WRAPPER_TAGS or name.startswith(OFFICE_PREFIXES):
            return ""
        if closing:
            return f"</{name}>"
        return _clean_tag(name, _parse_attrs(raw_attrs), bool(self_closing))

    text = TAG_RE.sub(replace, text)
    # 清掉只剩空格的空段落（Word 导出常见）
    return EMPTY_BLOCK_RE.sub("", text)
