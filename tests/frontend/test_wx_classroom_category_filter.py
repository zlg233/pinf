"""微信小程序课堂文章分类筛选的源码回归测试。

作用：防止课堂页在后续修改中丢失四阶段分类、分类请求参数、分类缓存隔离，
以及现有 OrganicChipButton 的复用逻辑。

实现：读取 wx_end/src/pages/classroom/index.tsx 源码，通过 unittest 检查四个分类
文案、所有文章列表请求携带的 activeCategory、包含分类的页面缓存键，以及分类
按钮的映射渲染。项目目前没有可直接运行的 Taro 页面测试环境，因此使用仓库已有
的 Python 源码回归测试模式，并保持测试无额外依赖。
"""

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CLASSROOM_PAGE = ROOT / "wx_end" / "src" / "pages" / "classroom" / "index.tsx"


class WxClassroomCategoryFilterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.content = CLASSROOM_PAGE.read_text(encoding="utf-8")

    def test_declares_all_article_stages(self) -> None:
        for category in ("入院时", "住院期间", "出院当天", "出院后"):
            self.assertIn(f"'{category}'", self.content)

    def test_passes_active_category_to_every_article_list_request(self) -> None:
        self.assertGreaterEqual(
            self.content.count("category: activeCategory || undefined"),
            3,
        )

    def test_category_participates_in_page_cache_key(self) -> None:
        self.assertIn(
            "buildCacheKey(searchQuery, activeTab, activeCategory)",
            self.content,
        )

    def test_reuses_chip_button_for_article_category_options(self) -> None:
        self.assertIn("ARTICLE_CATEGORY_OPTIONS.map", self.content)
        self.assertIn("active={activeCategory === option.value}", self.content)


if __name__ == "__main__":
    unittest.main()
