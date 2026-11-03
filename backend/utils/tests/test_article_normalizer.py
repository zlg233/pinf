"""文章 HTML 归一化的测试（用真实公众号 / Word 片段做 fixture）。

归一化不是"删样式"，而是把公众号版式**翻译**成我们自己的排版：
字号档位、引用块、卡片块、图注、列表、分割线、表格。
"""

from utils.article_normalizer import normalize_article_html

MESSY = (
    '<section style="font-size:16px;letter-spacing:1px;margin-top:15px;color:rgb(0,0,0);text-align:center">'
    '<p style="line-height:2;margin:0 0 12px">正文段落</p>'
    '<img alt="图片" class="rich_pages wxw-img" data-src="https://mmbiz.qpic.cn/a/640?wx_fmt=png&amp;from=appmsg"'
    ' data-w="1080" width="1080" style="vertical-align:middle;width:1080px;visibility:visible !important">'
    "<strong>重点</strong>"
    '<table width="900"><tr><td>单元格</td></tr></table>'
    "</section>"
    "<script>alert('x')</script>"
    '<iframe src="https://evil"></iframe>'
)

TITLE = '<section style="font-size:26px;font-weight:700">大标题</section>'
SUBTITLE = '<section style="font-size:19px">小标题</section>'
BODY = '<section style="font-size:15px">正文文字</section>'
CAPTION = '<p style="font-size:12px;text-align:center">图 1 早产儿随访流程</p>'
QUOTE = '<section style="background-color:#F2F2F2;font-size:15px">这是引用的一段话</section>'
CARD = '<section style="display:flex;border:1px solid #ddd;border-radius:8px;font-size:14px">卡片内容</section>'

TITLE_PT = '<h1><span style="font-size:24.0pt;font-family:微软雅黑">Word 导出的标题</span></h1>'
WORD_BODY = '<p style="margin-top:0.0pt;line-height:0.0pt"><span style="font-size:10.5pt">Word 正文</span></p>'
WORD_EMPTY = '<p><span style="font-size:1.0pt"><o:p><span>&nbsp;</span></o:p></span></p>'
SPAN_TITLE = '<p><span style="font-size:24px">行内大字号标题</span></p>'

BIG_BODY = (
    '<p><span style="font-size:21.5pt">这是正文一段很长的文字</span></p>'
    '<p><span style="font-size:21.5pt">这是正文第二段</span></p>'
    '<h2><span style="font-size:28.0pt">大标题</span></h2>'
)

TABLE_WITH_HEADER = (
    "<table><tbody><tr>"
    '<td style="background: rgb(253, 234, 218);border-width: 1pt">储存条件</td>'
    '<td style="border-width: 1pt">存放参考时间</td>'
    "</tr><tr><td>室温保存</td><td>4 小时</td></tr></tbody></table>"
)


class TestImageNormalization:
    def test_图片改用data_src并去掉固定宽高(self):
        html = normalize_article_html(MESSY)
        assert 'src="https://mmbiz.qpic.cn/a/640?wx_fmt=png&from=appmsg"' in html
        assert "1080" not in html
        assert "data-src" not in html
        assert "data-w" not in html

    def test_图片样式被强制为自适应(self):
        html = normalize_article_html(MESSY)
        assert "width:100%" in html
        assert "height:auto" in html
        assert "display:block" in html

    def test_图片已自适应时再次归一化不改变(self):
        once = normalize_article_html(MESSY)
        assert normalize_article_html(once) == once


class TestFontSizeMapping:
    def test_大字号映射为标题(self):
        html = normalize_article_html(TITLE)
        assert "font-size:22px" in html
        assert "font-weight:600" in html
        assert "font-size:26px" not in html

    def test_中字号映射为小标题(self):
        html = normalize_article_html(SUBTITLE)
        assert "font-size:18px" in html
        assert "font-weight:600" in html

    def test_正文字号归一(self):
        html = normalize_article_html(BODY)
        assert "font-size:15px" in html
        assert "line-height:1.8" in html

    def test_小字号居中映射为图注(self):
        html = normalize_article_html(CAPTION)
        assert "font-size:12px" in html
        assert "color:#999999" in html
        assert "text-align:center" in html

    def test_剥掉字距与原边距(self):
        html = normalize_article_html(MESSY)
        assert "letter-spacing" not in html
        assert "margin-top:15px" not in html


class TestBlocks:
    def test_背景块映射为引用块(self):
        html = normalize_article_html(QUOTE)
        assert "border-left:3px solid" in html
        assert "padding:12px 14px" in html
        assert "#F2F2F2" not in html

    def test_flex卡片映射为卡片块(self):
        html = normalize_article_html(CARD)
        assert "border-radius:12px" in html
        assert "padding:16px" in html
        assert "display:flex" not in html

    def test_强调标签保留加粗(self):
        html = normalize_article_html("<p><strong>重点</strong></p>")
        assert "<strong" in html
        assert "font-weight:600" in html

    def test_列表保留缩进(self):
        html = normalize_article_html("<ul><li>条目一</li></ul>")
        assert "<ul" in html
        assert "padding-left:20px" in html

    def test_分割线保留(self):
        assert "<hr" in normalize_article_html("<p>上</p><hr><p>下</p>")


class TestSafety:
    def test_删除脚本与内嵌页面(self):
        html = normalize_article_html(MESSY)
        assert "<script" not in html.lower()
        assert "alert" not in html
        assert "<iframe" not in html.lower()
        assert "evil" not in html

    def test_去掉公众号专属属性(self):
        html = normalize_article_html(MESSY)
        assert "rich_pages" not in html
        assert "data-w" not in html


class TestTableRendering:
    def test_单元格保留边框(self):
        html = normalize_article_html(TABLE_WITH_HEADER)
        assert "border:1px solid" in html

    def test_表头背景保留(self):
        html = normalize_article_html(TABLE_WITH_HEADER)
        assert "rgb(253, 234, 218)" in html

    def test_表格布局自适应(self):
        html = normalize_article_html(TABLE_WITH_HEADER)
        assert "table-layout:auto" in html
        assert "table-layout:fixed" not in html

    def test_单元格内段落无外边距(self):
        html = normalize_article_html("<table><tr><td><p>单元格文字</p></td></tr></table>")
        cell = html[html.index("<td"):]
        assert "margin:0 0 12px" not in cell

    def test_去掉表格固定像素宽度属性(self):
        html = normalize_article_html(MESSY)
        assert 'width="900"' not in html


class TestWordExport:
    def test_pt字号能映射到标题(self):
        html = normalize_article_html(TITLE_PT)
        assert "font-size:22px" in html
        assert "24.0pt" not in html

    def test_h1标题自带档位(self):
        html = normalize_article_html("<h1>标题文字</h1>")
        assert "font-size:22px" in html
        assert "font-weight:600" in html

    def test_h3映射为小标题(self):
        html = normalize_article_html("<h3>小节</h3>")
        assert "font-size:18px" in html

    def test_pt正文字号归一(self):
        html = normalize_article_html(WORD_BODY)
        assert "font-size:15px" in html

    def test_去掉o_p标签(self):
        html = normalize_article_html(WORD_EMPTY)
        assert "o:p" not in html

    def test_纯空白段落被清理(self):
        html = normalize_article_html(WORD_EMPTY + "<p>有内容</p>")
        assert "&nbsp;" not in html
        assert "有内容" in html

    def test_行内大字号span保留标题档(self):
        html = normalize_article_html(SPAN_TITLE)
        assert "font-size:22px" in html


class TestOfficeArtifacts:
    def test_去掉o_page等Office命名空间标签(self):
        html = normalize_article_html("<p>正文<o:page></o:page></p><p>下一段</p>")
        assert "o:page" not in html
        assert "正文" in html
        assert "下一段" in html


class TestRelativeScaling:
    def test_主字号偏大的文档按相对比例分档(self):
        html = normalize_article_html(BIG_BODY)
        assert "font-size:22px" in html, "28pt 应判为标题"
        assert html.count("font-size:15px") >= 2, "21.5pt 正文应归一为正文档"

    def test_相同字号文档仍用绝对阈值(self):
        html = normalize_article_html('<p><span style="font-size:26px">唯一标题</span></p>')
        assert "font-size:22px" in html

    def test_相对分档后仍然幂等(self):
        once = normalize_article_html(BIG_BODY)
        assert normalize_article_html(once) == once


class TestEdgeCases:
    def test_空内容安全返回(self):
        assert normalize_article_html(None) == ""
        assert normalize_article_html("") == ""
        assert normalize_article_html("   ") == ""

    def test_纯文本原样保留(self):
        assert "早产儿护理" in normalize_article_html("早产儿护理")

    def test_整体幂等(self):
        for sample in (MESSY, TITLE, SUBTITLE, BODY, CAPTION, QUOTE, CARD, BIG_BODY, TABLE_WITH_HEADER):
            once = normalize_article_html(sample)
            assert normalize_article_html(once) == once, sample


REAL_TABLE_CELL = (
    "<table><tbody><tr>"
    '<td data-colwidth="161" width="161" valign="middle" '
    'style="background: rgb(253, 234, 218);border-width: 1pt;border-style: solid;'
    'border-color: rgb(191, 191, 191);padding: 0pt 2pt;height: 22.65pt;">'
    '<p style="margin-bottom:0.0pt;text-align:center;line-height:12.25pt;'
    'mso-line-height-rule:exactly;"><span style="font-size:10.5pt;'
    'mso-bidi-font-size:10.5pt;font-family:微软雅黑;color:#000000;font-weight:bold;">'
    '<span leaf="">储存条件</span></span></p></td>'
    '<td style="border-width: 1pt"><p style="margin-bottom:0.0pt">存放参考时间</p></td>'
    "</tr></tbody></table>"
)

TABLE_WITH_SPAN = (
    "<table><tr>"
    '<td colspan="2" style="border-width: 1pt">合并列</td>'
    "</tr><tr><td>左</td><td>右</td></tr></table>"
)


class TestRealArticleTable:
    def test_真实Word表格单元格保留边框与底色(self):
        html = normalize_article_html(REAL_TABLE_CELL)
        assert "border:1px solid" in html
        assert "rgb(253, 234, 218)" in html

    def test_真实Word表格不带mso属性(self):
        html = normalize_article_html(REAL_TABLE_CELL)
        assert "mso-" not in html
        assert "data-colwidth" not in html
        assert 'width="161"' not in html

    def test_单元格内居中保留(self):
        html = normalize_article_html(REAL_TABLE_CELL)
        cell = html[html.index("<td"):]
        assert "text-align:center" in cell

    def test_合并单元格colspan保留(self):
        html = normalize_article_html(TABLE_WITH_SPAN)
        assert 'colspan="2"' in html

    def test_表格整体幂等(self):
        once = normalize_article_html(REAL_TABLE_CELL)
        assert normalize_article_html(once) == once

