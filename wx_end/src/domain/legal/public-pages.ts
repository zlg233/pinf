/**
 * 无需登录即可访问的页面路由。
 *
 * 审核要求：《用户服务协议》《隐私政策》必须能在未登录、未同意状态下阅读，
 * 因此 app 启动时的认证跳转需要跳过这些页面。
 */

export const PUBLIC_PAGE_ROUTES = ['pages/terms/index', 'pages/privacy/index'];
