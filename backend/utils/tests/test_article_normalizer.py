"""文章 HTML 归一化的测试（用真实公众号片段做 fixture）。"""

from utils.article_normalizer import normalize_article_html

MESSY = (
    '<section style="font-size:16px;letter-spacing:1px;margin-top:15px;color:rgb(0,0,0);text-align:center">'
    '<p style="line-height:2;margin:0 0 12px">正文段落</p>'
    '<img alt="图片" class="rich_pages wxw-img" data-src="https://mmbiz.qpic.cn/a/640?wx_fmt=png&amp;from=appmsg"'
    ' data-w="1080" width="1080" style="vertical-align:middle;width:1080px;visibility:visible !important">'
    '<strong>重点</strong>'
    '<table width="900"><tr><td>单元格</td></tr></table>'
    '</section>'
    "<script>alert('x')</script>"
    '<iframe src="https://evil"></iframe>'
)


class TestImageNormalization:
    def test_图片改用data_src并去掉固定宽高(self):
        html = normalize_article_html(MESSY)
        assert 'src="https://mmbiz.qpic.cn/a/640?wx_fmt=png&from=appmsg"' in html
        assert "1080" not in html
        assert 'data-src' not in html
        assert 'data-w' not in html
        assert "width:1080px" not in html

    def test_图片样式被强制为自适应(self):
        html = normalize_article_html(MESSY)
        assert "width:100%" in html
        assert "height:auto" in html
        assert "display:block" in html

    def test_图片已自适应时再次归一化不改变(self):
        once = normalize_article_html(MESSY)
        twice = normalize_article_html(once)
        assert once == twice


class TestStyleNormalization:
    def test_剥掉字号字距与边距但保留对齐和颜色(self):
        html = normalize_article_html(MESSY)
        assert "font-size" not in html
        assert "letter-spacing" not in html
        assert "line-height" not in html
        assert "margin-top" not in html
        assert "text-align:center" in html
        assert "color:rgb(0,0,0)" in html

    def test_保留结构标签(self):
        html = normalize_article_html(MESSY)
        assert "<strong>" in html
        assert "<p" in html


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
        assert "width:100%" in html
        assert "table-layout:fixed" in html
        assert 'width="900"' not in html


class TestEdgeCases:
    def test_空内容安全返回(self):
        assert normalize_article_html(None) == ""
        assert normalize_article_html("") == ""
        assert normalize_article_html("   ") == ""

    def test_纯文本原样保留(self):
        assert "早产儿护理" in normalize_article_html("早产儿护理")
