import { Component, PropsWithChildren } from 'react';
import Taro from '@tarojs/taro';
import { useAuthStore } from './store';
import { useFeaturesStore } from './store/features';
import { PUBLIC_PAGE_ROUTES } from './domain/legal/public-pages';
import './app.scss';

class App extends Component<PropsWithChildren> {
  componentDidMount() {
    this.checkAuth();
    useFeaturesStore.getState().fetchFeatures();
  }

  async checkAuth() {
    // 协议页无需登录、无需同意即可阅读：启动时的认证跳转不能把它们踢回登录页
    const pages = Taro.getCurrentPages();
    const currentRoute = (pages[pages.length - 1] as any)?.route || '';
    const launchPath = (Taro.getLaunchOptionsSync?.() as any)?.path || '';
    if (
      PUBLIC_PAGE_ROUTES.indexOf(currentRoute) >= 0 ||
      PUBLIC_PAGE_ROUTES.indexOf(launchPath.replace(/^\//, '')) >= 0
    ) {
      return;
    }

    const { initialize } = useAuthStore.getState();
    await initialize();

    const { isAuthenticated, needSetPassword } = useAuthStore.getState();

    if (!isAuthenticated) {
      Taro.reLaunch({ url: '/pages/login/index' });
    } else if (needSetPassword) {
      Taro.reLaunch({ url: '/pages/set-password/index' });
    }
  }

  componentDidShow() {}

  componentDidHide() {}

  render() {
    return this.props.children;
  }
}

export default App;
