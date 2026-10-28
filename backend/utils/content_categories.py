"""内容分类的单一来源。

小程序课堂与管理页共用这四个值；后端写入时以此校验，
避免前后端各写一份导致对不上。
"""

CONTENT_CATEGORIES = ("入院时", "住院期间", "出院当天", "出院后")

# 允许清空分类（空字符串或 None 都表示未分类）
def normalize_category(value):
    """返回 (规范化后的分类, 错误信息)。空值表示未分类。"""
    if value is None:
        return "", None
    if not isinstance(value, str):
        return None, "分类必须是字符串"
    text = value.strip()
    if not text:
        return "", None
    if text not in CONTENT_CATEGORIES:
        return None, "分类只能是：" + "、".join(CONTENT_CATEGORIES)
    return text, None
