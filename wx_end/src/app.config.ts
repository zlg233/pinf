export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/classroom/index',
    // 'pages/qa/index',  // AI问答页面已隐藏（微信审核要求）
    'pages/profile/index',
    'pages/login/index',
    'pages/set-password/index',
    'pages/appointments/index',
    'pages/article-detail/index',
    'pages/video-detail/index',
  ],
  subpackages: [
    {
      root: 'pages/growth',
      pages: ['index'],
    },
  ],
  preloadRule: {
    'pages/index/index': {
      network: 'all',
      packages: ['pages/growth'],
    },
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '早护通',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f5f5f5',
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#FFB5A7',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
      },
      {
        pagePath: 'pages/classroom/index',
        text: '课堂',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
      },
    ],
  },
});
