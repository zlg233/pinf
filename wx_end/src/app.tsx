import { Component, PropsWithChildren } from 'react';
import Taro from '@tarojs/taro';
import { useAuthStore } from './store';
import { useFeaturesStore } from './store/features';
import './app.scss';

class App extends Component<PropsWithChildren> {
  componentDidMount() {
    this.checkAuth();
    useFeaturesStore.getState().fetchFeatures();
  }

  async checkAuth() {
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
