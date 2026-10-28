"""管理员内容管理接口：查看列表、修改文章/视频的出院状态分类。

范围刻意收窄：
- 只允许改 category，请求里其它字段一律忽略；
- 只走 admin_required，不复用普通用户接口的宽口径；
- 列表支持 search / category / uncategorized，方便补存量资源。
"""

from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from models import db
from models.content import Article
from models.video import Video
from utils.auth import admin_required
from utils.content_categories import CONTENT_CATEGORIES, normalize_category

admin_content_bp = Blueprint("admin_content", __name__)

MAX_PER_PAGE = 50


def _page_args():
    try:
        page = max(1, int(request.args.get("page", 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = int(request.args.get("per_page", 10))
    except (TypeError, ValueError):
        per_page = 10
    per_page = min(max(1, per_page), MAX_PER_PAGE)
    search = (request.args.get("search") or "").strip()
    category = (request.args.get("category") or "").strip()
    uncategorized = (request.args.get("uncategorized") or "") in ("1", "true", "yes")
    return page, per_page, search, category, uncategorized


def _paginate(query, page, per_page):
    pager = query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "items": [item.to_dict() for item in pager.items],
        "pagination": {
            "page": page,
            "perPage": per_page,
            "total": pager.total,
            "pages": pager.pages,
            "hasNext": pager.has_next,
            "hasPrev": pager.has_prev,
        },
    }


def _apply_filters(query, model, search, category, uncategorized):
    if uncategorized:
        query = query.filter(or_(model.category.is_(None), model.category == ""))
    elif category:
        query = query.filter(model.category == category)
    if search and model is Article:
        query = query.filter(
            or_(Article.title.ilike(f"%{search}%"), Article.content.ilike(f"%{search}%"))
        )
    if search and model is Video:
        query = query.filter(
            or_(Video.title.ilike(f"%{search}%"), Video.description.ilike(f"%{search}%"))
        )
    return query


@admin_content_bp.route("/admin/content/articles", methods=["GET"])
@admin_required
def list_admin_articles(current_user):
    page, per_page, search, category, uncategorized = _page_args()
    query = _apply_filters(Article.query, Article, search, category, uncategorized)
    query = query.order_by(Article.publish_date.desc(), Article.id.desc())
    result = _paginate(query, page, per_page)
    return jsonify(
        {
            "status": "success",
            "data": result["items"],
            "pagination": result["pagination"],
            "categories": list(CONTENT_CATEGORIES),
        }
    )


@admin_content_bp.route("/admin/content/videos", methods=["GET"])
@admin_required
def list_admin_videos(current_user):
    page, per_page, search, category, uncategorized = _page_args()
    query = _apply_filters(Video.query, Video, search, category, uncategorized)
    query = query.order_by(Video.created_at.desc(), Video.id.desc())
    result = _paginate(query, page, per_page)
    return jsonify(
        {
            "status": "success",
            "data": result["items"],
            "pagination": result["pagination"],
            "categories": list(CONTENT_CATEGORIES),
        }
    )


def _update_category(model, item_id):
    item = model.query.get(item_id)
    if not item:
        return jsonify({"status": "error", "message": "内容不存在"}), 404

    data = request.get_json(silent=True) or {}
    # 只认 category，其它字段一律忽略
    category, error = normalize_category(data.get("category"))
    if error:
        return jsonify({"status": "error", "message": error}), 400

    item.category = category or None
    db.session.commit()
    return jsonify({"status": "success", "data": item.to_dict()})


@admin_content_bp.route("/admin/content/articles/<int:article_id>", methods=["PATCH"])
@admin_required
def update_article_category(current_user, article_id):
    return _update_category(Article, article_id)


@admin_content_bp.route("/admin/content/videos/<int:video_id>", methods=["PATCH"])
@admin_required
def update_video_category(current_user, video_id):
    return _update_category(Video, video_id)
