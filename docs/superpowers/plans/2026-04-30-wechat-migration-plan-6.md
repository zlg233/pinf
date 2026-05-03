# 计划 6：后端适配 — 微信小程序登录 + 订阅消息（第 11-12 天）

> 时间：每天 3-4 小时（AI 修改 ~2h + 人工审核 ~1.5h）
> 目标：完成后端微信小程序登录认证、订阅消息模板注册和发送

---

## 第 11 天：微信小程序登录认证（4h）

### 11.1 分析现有微信登录流程（AI ~20min）

阅读并理解：
- `backend/routes/auth.py` 中 `/api/auth/wechat` 端点
- `backend/utils/wechat.py` 中 `get_wechat_user_info(code)` 函数
- `backend/models/user.py` 中 `wx_openid` 字段

**现状**：后端已有微信公众号登录（通过 code 获取公众号用户信息），但小程序登录流程不同。

**关键差异**：
```
公众号登录：code → 网页授权 access_token → 用户信息（含 openid）
小程序登录：code → session_key + openid（通过 wx.login 获取）
小程序需要额外步骤：前端获取 code → 后端调用 jscode2session → 获取 openid + session_key
```

### 11.2 新增小程序登录端点（AI ~1h）

**修改文件**：`backend/routes/auth.py`

新增路由：`POST /api/auth/wechat/miniprogram`

```python
@auth_bp.route('/wechat/miniprogram', methods=['POST'])
@validate_request_data({'code': {'type': 'string', 'required': True}})
def wechat_miniprogram_login():
    """
    微信小程序登录
    前端通过 wx.login() 获取 code，传给后端
    后端调用微信 jscode2session 接口获取 openid + session_key
    """
    code = request.json['code']

    # 调用微信 jscode2session 接口
    url = 'https://api.weixin.qq.com/sns/jscode2session'
    params = {
        'appid': current_app.config['WECHAT_MP_APPID'],
        'secret': current_app.config['WECHAT_MP_SECRET'],
        'js_code': code,
        'grant_type': 'authorization_code'
    }

    resp = requests.get(url, params=params, timeout=10)
    data = resp.json()

    if 'errcode' in data:
        return jsonify({'status': 'error', 'message': data.get('errmsg', '微信登录失败')}), 400

    openid = data['openid']
    session_key = data.get('session_key')

    # 查找或创建用户
    user = User.query.filter_by(wx_openid=openid).first()
    if not user:
        user = User(wx_openid=openid, name=f'微信用户{openid[-4:]}')
        db.session.add(user)
        db.session.commit()

    # 生成 JWT
    token = create_access_token(identity=user.id)

    return jsonify({
        'status': 'success',
        'data': {
            'user': user.to_dict(),
            'token': token,
            'is_new_user': user.phone is None
        }
    })
```

### 11.3 新增配置项（AI ~15min）

**修改文件**：`backend/config.py`

```python
# 微信小程序配置
WECHAT_MP_APPID = os.environ.get('WECHAT_MP_APPID', '')
WECHAT_MP_SECRET = os.environ.get('WECHAT_MP_SECRET', '')
```

**修改文件**：`backend/.env.example`

```env
# 微信小程序
WECHAT_MP_APPID=your_miniprogram_appid
WECHAT_MP_SECRET=your_miniprogram_secret
```

### 11.4 新增小程序登录 API 工具（AI ~30min）

**新建文件**：`backend/utils/wechat_mp.py`

```python
"""微信小程序 API 工具"""

import requests
from flask import current_app


def code2session(code: str) -> dict:
    """
    调用微信 jscode2session 接口
    返回: { openid, session_key, unionid? }
    """
    url = 'https://api.weixin.qq.com/sns/jscode2session'
    params = {
        'appid': current_app.config['WECHAT_MP_APPID'],
        'secret': current_app.config['WECHAT_MP_SECRET'],
        'js_code': code,
        'grant_type': 'authorization_code'
    }
    resp = requests.get(url, params=params, timeout=10)
    return resp.json()


def get_access_token() -> str:
    """
    获取小程序全局唯一后台接口调用凭据（access_token）
    缓存到 Redis 或内存
    """
    url = 'https://api.weixin.qq.com/cgi-bin/token'
    params = {
        'grant_type': 'client_credential',
        'appid': current_app.config['WECHAT_MP_APPID'],
        'secret': current_app.config['WECHAT_MP_SECRET']
    }
    resp = requests.get(url, params=params, timeout=10)
    data = resp.json()
    return data.get('access_token')
```

### 11.5 新增小程序手机号获取端点（AI ~40min）

微信小程序支持通过按钮获取用户手机号（需用户主动点击）。

**修改文件**：`backend/routes/auth.py`

新增路由：`POST /api/auth/wechat/miniprogram/phone`

```python
@auth_bp.route('/wechat/miniprogram/phone', methods=['POST'])
@validate_request_data({
    'code': {'type': 'string', 'required': True},
    'openid': {'type': 'string', 'required': True}
})
def wechat_miniprogram_bind_phone():
    """
    微信小程序绑定手机号
    前端通过 <button open-type="getPhoneNumber"> 获取 code
    后端调用微信接口解密手机号
    """
    code = request.json['code']
    openid = request.json['openid']

    # 获取 access_token
    access_token = get_mp_access_token()

    # 调用 getUserPhoneNumber 接口
    url = f'https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token={access_token}'
    resp = requests.post(url, json={'code': code}, timeout=10)
    data = resp.json()

    if data.get('errcode', 0) != 0:
        return jsonify({'status': 'error', 'message': '获取手机号失败'}), 400

    phone_info = data['phone_info']
    phone_number = phone_info['purePhoneNumber']

    # 更新用户手机号
    user = User.query.filter_by(wx_openid=openid).first()
    if user:
        user.phone = phone_number
        db.session.commit()

    return jsonify({
        'status': 'success',
        'data': {'user': user.to_dict()}
    })
```

### 11.6 前端小程序登录 API 适配（AI ~30min）

**修改文件**：`wx_end/src/services/api/auth.ts`

新增：
```typescript
// 微信小程序登录
export async function wxMiniprogramLogin() {
  const { code } = await Taro.login();
  return client.post('/auth/wechat/miniprogram', { code });
}

// 绑定手机号
export async function wxBindPhone(code: string, openid: string) {
  return client.post('/auth/wechat/miniprogram/phone', { code, openid });
}
```

**修改文件**：`wx_end/src/pages/login/index.tsx`

新增微信一键登录按钮：
```jsx
<Button openType="getPhoneNumber" onGetPhoneNumber={handleGetPhoneNumber}>
  微信一键登录
</Button>
```

### 11.7 数据库迁移（AI ~15min）

**修改文件**：`backend/utils/db_migrations.py`

新增迁移：确保 User 模型支持小程序登录场景（wx_openid 已存在，无需新增字段，但可能需要添加索引）。

### 11.8 人工审核（~1.5h）

- [ ] 使用 Postman 测试 `/api/auth/wechat/miniprogram` 端点
- [ ] 模拟 code 参数，验证返回 JWT token
- [ ] 新用户注册流程（无手机号 → 引导绑定）
- [ ] 老用户匹配流程（已有 openid → 直接登录）
- [ ] 手机号绑定端点测试
- [ ] 配置文件正确（WECHAT_MP_APPID/SECRET）
- [ ] 前端登录页微信一键登录按钮显示正确
- [ ] 完整登录流程：wx.login → 后端换 token → 存储跳转

---

## 第 12 天：订阅消息 + 通知系统适配（3.5h）

### 12.1 订阅消息模板设计（AI ~30min）

在微信公众平台注册订阅消息模板：

| 模板名称 | 触发场景 | 关键字段 |
|---------|---------|---------|
| 预约提醒 | 预约就诊前提醒 | 医院名称、科室、预约时间、备注 |
| 预约状态变更 | 预约完成/过期 | 状态、医院名称、时间 |
| 成长记录 | 新增成长记录 | 宝宝姓名、指标类型、数值、日期 |

### 12.2 订阅消息发送服务（AI ~1h）

**新建文件**：`backend/utils/wechat_mp_subscribe.py`

```python
"""微信小程序订阅消息发送"""

import requests
from flask import current_app


def send_subscribe_message(
    touser: str,
    template_id: str,
    page: str,
    data: dict
) -> dict:
    """
    发送订阅消息
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
```

### 12.3 通知路由适配（AI ~1h）

**修改文件**：`backend/routes/notifications.py`

新增小程序订阅消息相关端点：

```python
@notifications_bp.route('/subscribe/miniprogram', methods=['POST'])
@token_required
def miniprogram_subscribe():
    """
    小程序订阅消息授权
    前端通过 wx.requestSubscribeMessage 获取授权后，
    将授权结果传给后端记录
    """
    user = get_current_user()
    data = request.json

    subscription = NotificationSubscription(
        user_id=user.id,
        appointment_id=data.get('appointment_id'),
        channel='wechat_mp',
        token=data.get('openid'),
        remind_time=data.get('remind_time'),
        status='active'
    )
    db.session.add(subscription)
    db.session.commit()

    return jsonify({'status': 'success', 'data': subscription.to_dict()})


@notifications_bp.route('/send/miniprogram', methods=['POST'])
def send_miniprogram_notification():
    """
    发送小程序订阅消息（内部调用或定时任务触发）
    """
    subscription_id = request.json.get('subscription_id')
    subscription = NotificationSubscription.query.get(subscription_id)

    if not subscription or subscription.status != 'active':
        return jsonify({'status': 'error', 'message': '无效订阅'}), 400

    # 构建模板数据
    appointment = Appointment.query.get(subscription.appointment_id)
    template_data = {
        'thing1': {'value': appointment.clinic},
        'thing2': {'value': appointment.department},
        'time3': {'value': appointment.scheduled_at.strftime('%Y年%m月%d日 %H:%M')},
        'thing4': {'value': appointment.note or '无'}
    }

    result = send_subscribe_message(
        touser=subscription.token,
        template_id=current_app.config['WECHAT_MP_TEMPLATE_APPOINTMENT'],
        page=f'pages/appointments/index?id={appointment.id}',
        data=template_data
    )

    if result.get('errcode') == 0:
        subscription.status = 'sent'
        subscription.sent_at = datetime.utcnow()
        db.session.commit()

    return jsonify({'status': 'success' if result.get('errcode') == 0 else 'error', 'data': result})
```

### 12.4 NotificationSubscription 模型适配（AI ~20min）

**修改文件**：`backend/models/notification_subscription.py`

确保 `channel` 字段支持 `'wechat_mp'` 值（现有字段可能只支持 `'expo'`）。

**修改文件**：`backend/utils/db_migrations.py`

如需要，新增迁移确保 channel 字段支持新值。

### 12.5 前端订阅消息适配（AI ~30min）

**修改文件**：`wx_end/src/services/api/notifications.ts`

适配小程序订阅消息 API：

```typescript
// 请求用户授权订阅消息
export async function requestSubscribe(templateIds: string[]) {
  return Taro.requestSubscribeMessage({ tmplIds: templateIds });
}

// 授权后记录到后端
export async function subscribeMiniprogram(data: {
  appointment_id: number;
  openid: string;
  remind_time: string;
}) {
  return client.post('/notifications/subscribe/miniprogram', data);
}
```

**修改文件**：`wx_end/src/pages/appointments/index.tsx`

替换 expo-notifications 调用为小程序订阅消息。

### 12.6 配置更新（AI ~10min）

**修改文件**：`backend/config.py`

```python
# 订阅消息模板 ID
WECHAT_MP_TEMPLATE_APPOINTMENT = os.environ.get('WECHAT_MP_TEMPLATE_APPOINTMENT', '')
WECHAT_MP_TEMPLATE_GROWTH = os.environ.get('WECHAT_MP_TEMPLATE_GROWTH', '')
```

### 12.7 人工审核（~1h）

- [ ] 订阅消息模板 ID 在公众平台注册正确
- [ ] 发送订阅消息 API 调用成功（Postman 测试）
- [ ] NotificationSubscription 模型支持 'wechat_mp' channel
- [ ] 前端 `requestSubscribeMessage` 弹窗正常
- [ ] 授权后后端记录正确
- [ ] 定时任务触发发送正常
- [ ] 错误场景处理（用户拒绝授权、模板 ID 无效）

---

## 本单元交付物

- [x] 微信小程序登录端点（code → openid → JWT）
- [x] 手机号绑定端点
- [x] 后端配置项（WECHAT_MP_APPID/SECRET/TEMPLATE）
- [x] 订阅消息发送服务
- [x] 通知路由适配（miniprogram channel）
- [x] 前端登录页微信一键登录
- [x] 前端订阅消息授权流程
