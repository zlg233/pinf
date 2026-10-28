"""一次性运维脚本：把指定手机号账号设为管理员（或降回普通用户）。

用法（在 backend 目录、容器内执行）：
    python -m utils.set_admin_role --phone 13425082508
    python -m utils.set_admin_role --phone 13425082508 --role user   # 撤销

前置：该手机号必须已经在小程序登录过，否则库里没有对应账号。
脚本会打印改前/改后角色，可重复执行（幂等）。
"""

import argparse
import sys


def main(argv=None):
    parser = argparse.ArgumentParser(description="设置账号角色")
    parser.add_argument("--phone", required=True, help="账号手机号")
    parser.add_argument("--role", default="admin", choices=["admin", "user"], help="目标角色")
    args = parser.parse_args(argv)

    from app import create_app
    from models import db
    from models.user import User

    app = create_app()
    with app.app_context():
        user = User.query.filter_by(phone=args.phone).first()
        if not user:
            print(f"未找到手机号 {args.phone} 的账号，请先在小程序登录一次", file=sys.stderr)
            return 2

        before = user.role
        if before == args.role:
            print(f"{args.phone} 当前已是 {args.role}，无需修改")
            return 0

        user.role = args.role
        db.session.commit()
        print(f"{args.phone}：{before} -> {user.role}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
