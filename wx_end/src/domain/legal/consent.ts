/**
 * 同意门禁（纯函数）。
 *
 * 审核要求：未勾选同意前，不得发送验证码、不得发起登录请求、
 * 不得触发微信手机号授权组件。所有入口共用同一段提示文案。
 */

export const CONSENT_REQUIRED_MESSAGE = '请先阅读并同意《用户服务协议》和《隐私政策》';

/** 返回 null 表示可以继续，否则返回需要展示的提示文案。 */
export const ensureConsent = (agreed: boolean): string | null =>
  agreed ? null : CONSENT_REQUIRED_MESSAGE;
