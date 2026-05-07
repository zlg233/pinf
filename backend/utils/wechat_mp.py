"""微信小程序 API 工具"""

import requests
from flask import current_app


def code2session(code: str) -> dict:
    """调用微信 jscode2session 接口，返回 { openid, session_key, unionid? }"""
    url = 'https://api.weixin.qq.com/sns/jscode2session'
    params = {
        'appid': current_app.config['WECHAT_MP_APPID'],
        'secret': current_app.config['WECHAT_MP_SECRET'],
        'js_code': code,
        'grant_type': 'authorization_code'
    }
    resp = requests.get(url, params=params, timeout=10)
    return resp.json()


def get_mp_access_token() -> str:
    """获取小程序全局 access_token"""
    url = 'https://api.weixin.qq.com/cgi-bin/token'
    params = {
        'grant_type': 'client_credential',
        'appid': current_app.config['WECHAT_MP_APPID'],
        'secret': current_app.config['WECHAT_MP_SECRET']
    }
    resp = requests.get(url, params=params, timeout=10)
    data = resp.json()
    return data.get('access_token')
