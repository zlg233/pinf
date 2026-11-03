"""文章 HTML 归一化的测试（用真实公众号片段做 fixture）。

归一化不是"删样式"，而是把公众号版式**翻译**成我们自己的排版：
字号档位、引用块、卡片块、图注、列表、分割线。
"""

from utils.article_normalizer import normalize_article_html

MESSY = (
    '<section style="font-size:16px;letter-spacing:1px;margin-top:15px;color:rgb(0,0,0);text-align:center">'
    '<p style="line-height:2;margin:0 0 12px">正文段落</p>'
    '<img alt="图片" class="rich_pages wxw-img" data-src="https://mmbiz.qpic.cn/a/640?wx_fmt=png&amp;from=appmsg"'
    ' data-w="1080" width="1080" style="vertical-align:middle;width:1080px;visibility:visible !important">'
    '<strong>重点</strong>'
    '<table width="900"><tr><td>单元格</td></tr></table>'
    "</section>"
    "<script>alert('x')</script>"
    '<iframe src="https://evil"></iframe>'
)

TITLE = '<section style="font-size:24px;font-weight:700">大标题</section>'
SUBTITLE = '<section style="font-size:19px">小标题</section>'
BODY = '<section style="font-size:15px">正文文字</section>'
CAPTION = '<p style="font-size:12px;text-align:center">图 1 早产儿随访流程</p>'
QUOTE = '<section style="background-color:#F2F2F2;font-size:15px">这是引用的一段话</section>'
CARD = '<section style="display:flex;border:1px solid #ddd;border-radius:8px;font-size:14px">卡片内容</section>'


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
        assert "font-size:20px" in html
        assert "font-weight:600" in html
        assert "font-size:24px" not in html

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

    def test_颜色统一为调色板(self):
        html = normalize_article_html(BODY)
        assert "rgb(0,0,0)" not in html
        assert "color:#4A4A4A" in html


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


class TestTable:
    def test_表格改为自适应宽度(self):
        html = normalize_article_html(MESSY)
        assert "table-layout:fixed" in html
        assert 'width="900"' not in html


class TestEdgeCases:
    def test_空内容安全返回(self):
        assert normalize_article_html(None) == ""
        assert normalize_article_html("") == ""
        assert normalize_article_html("   ") == ""

    def test_纯文本原样保留(self):
        assert "早产儿护理" in normalize_article_html("早产儿护理")

    def test_整体幂等(self):
        for sample in (MESSY, TITLE, SUBTITLE, BODY, CAPTION, QUOTE, CARD):
            once = normalize_article_html(sample)
            assert normalize_article_html(once) == once, sample


PORT = '<h1><span style="font-size:22.0pt;font-family:微软雅黑">Word 导出的标题</span></h1>'
WORD_BODY = '<p style="margin-top:0.0pt;line-height:0.0pt"><span style="font-size:10.5pt">Word 正文</span></p>'
WORD_EMPTY = '<p><span style="font-size:1.0pt"><o:p><span>&nbsp;</span></o:p></span></p>'
SPAN_TITLE = '<p><span style="font-size:20px">行内大字号标题</span></p>'


class TestWordExport:
    def test_pt字号能映射到标题(self):
        html = normalize_article_html(PORT)
        assert "font-size:20px" in html
        assert "22.0pt" not in html

    def test_h1标题自带档位(self):
        html = normalize_article_html("<h1>标题文字</h1>")
        assert "font-size:20px" in html
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
        assert "font-size:20px" in html


class TestOfficeArtifacts:
    def test_去掉o_page等Office命名空间标签(self):
        html = normalize_article_html("<p>正文<o:page></o:page></p><p>下一段</p>")
        assert "o:page" not in html
        assert "正文" in html
        assert "下一段" in html
