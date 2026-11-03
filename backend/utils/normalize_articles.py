"""把已有文章的正文重新归一化，写入 content_normalized。

用法（容器内）：
    docker exec -it pinf-backend-1 uv run python -m utils.normalize_articles --dry-run
    docker exec -it pinf-backend-1 uv run python -m utils.normalize_articles

幂等：只重算缺失或内容有变化的行；加 --force 可强制全量重刷（规则升级后使用）。
"""

import argparse
import sys


def main(argv=None):
    parser = argparse.ArgumentParser(description="归一化历史文章正文")
    parser.add_argument("--dry-run", action="store_true", help="只统计不写库")
    parser.add_argument("--force", action="store_true", help="忽略已有结果，全量重算")
    parser.add_argument("--id", type=int, action="append", help="只处理指定文章 id，可重复")
    args = parser.parse_args(argv)

    from app import create_app
    from models import db
    from models.content import Article
    from utils.article_normalizer import normalize_article_html

    app = create_app()
    with app.app_context():
        query = Article.query.order_by(Article.id)
        if args.id:
            query = query.filter(Article.id.in_(args.id))
        articles = query.all()

        changed = 0
        skipped = 0
        for article in articles:
            normalized = normalize_article_html(article.content)
            if not args.force and normalized == article.content_normalized:
                skipped += 1
                continue
            if article.content_normalized != normalized:
                changed += 1
                if not args.dry_run:
                    article.content_normalized = normalized

        if not args.dry_run and changed:
            db.session.commit()

        mode = "演练" if args.dry_run else "已写入"
        print(f"{mode}：共 {len(articles)} 篇，更新 {changed} 篇，跳过 {skipped} 篇")
        return 0


if __name__ == "__main__":
    sys.exit(main())
