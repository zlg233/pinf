"""微信小程序订阅消息发送"""

import requests
from flask import current_app

from utils.wechat_mp import get_mp_access_token


def send_subscribe_message(touser: str, template_id: str, page: str, data: dict) -> dict:
    """
    发送小程序订阅消息
    touser: 用户 openid
    template_id: 模板 ID
    page: 点击跳转页面路径
    data: 模板数据，如 { "thing1": {"value": "xxx"}, "time2": {"value": "xxx"} }
    """
    access_token = get_mp_access_token()
    url = f'https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token={access_token}'
    payload = {
        'touser': touser,
        'template_id': template_id,
        'page': page,
        'data': data
    }
    resp = requests.post(url, json=payload, timeout=10)
    return resp.json()
