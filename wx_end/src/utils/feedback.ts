import Taro from '@tarojs/taro';

export function notify(message: string, title?: string) {
  Taro.showToast({ title: message, icon: 'none', duration: 2000 });
}

export async function confirm(message: string, title?: string): Promise<boolean> {
  return new Promise((resolve) => {
    Taro.showModal({
      title: title || '提示',
      content: message,
      success: (res) => { resolve(res.confirm); },
      fail: () => { resolve(false); },
    });
  });
}
