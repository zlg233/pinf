import Taro from '@tarojs/taro';

// 根据 NODE_ENV 切换 API 地址（由 config/dev.ts 和 config/prod.ts 注入）
export const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://backend.pinf.top/api'
  : 'http://localhost:5010/api';
// 注意：开发环境需要在微信开发者工具中
// 勾选"不校验合法域名"才能访问 localhost
const REQUEST_TIMEOUT = 15000;
const MAX_RETRIES = 2;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth.token',
  USER_PROFILE: 'user.profile',
  NEED_SET_PASSWORD: 'auth.need_set_password',
  CONTENT_CACHE: 'content.cache',
  PUSH_TOKEN: 'push.token',
};

let unauthorizedHandler: (() => Promise<void> | void) | null = null;

export const setUnauthorizedHandler = (handler: () => Promise<void> | void) => {
  unauthorizedHandler = handler;
};

function extractErrorMessage(error: any): string {
  if (error.response?.data) {
    const data = error.response.data;
    return data.message || data.error || data.detail || 'Request failed';
  }
  if (error.errMsg) {
    if (error.errMsg.indexOf('timeout') >= 0) {
      return '请求超时，请稍后重试';
    }
    if (error.errMsg.indexOf('fail') >= 0) {
      return '网络连接失败，请检查网络设置';
    }
  }
  return error.message || '未知错误';
}

async function request<T = any>(url: string, options: {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  params?: any;
} = {}) {
  let fullUrl = `${API_BASE_URL}${url}`;
  if (options.params) {
    const qs = Object.entries(options.params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) {
      fullUrl += `?${qs}`;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const tokenRes = await Taro.getStorage({ key: STORAGE_KEYS.AUTH_TOKEN });
    if (tokenRes.data) {
      headers['Authorization'] = `Bearer ${tokenRes.data}`;
    }
  } catch {}

  let retries = 0;

  const doRequest = async (): Promise<{
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
  }> => {
    let res: Taro.request.SuccessCallbackResult;
    try {
      res = await Taro.request({
        url: fullUrl,
        method: options.method || 'GET',
        data: options.data,
        header: headers,
        timeout: REQUEST_TIMEOUT,
      });
    } catch (err: any) {
      if (retries < MAX_RETRIES) {
        retries++;
        const delay = Math.pow(2, retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return doRequest();
      }
      console.error('API Error:', {
        message: extractErrorMessage(err),
        method: options.method,
        url: fullUrl,
      });
      throw err;
    }

    if (res.statusCode === 401) {
      try { await Taro.removeStorage({ key: STORAGE_KEYS.AUTH_TOKEN }); } catch {}
      try { await Taro.removeStorage({ key: STORAGE_KEYS.USER_PROFILE }); } catch {}
      if (unauthorizedHandler) {
        await unauthorizedHandler();
      }
      const err: any = new Error('Unauthorized');
      err.response = { data: res.data, status: res.statusCode, statusText: 'Unauthorized', headers: res.header };
      console.error('API Error:', { message: 'Unauthorized', status: 401 });
      throw err;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const err: any = new Error(`HTTP ${res.statusCode}`);
      err.response = { data: res.data, status: res.statusCode, statusText: 'Error', headers: res.header };
      console.error('API Error:', {
        message: extractErrorMessage(err),
        method: options.method,
        url: fullUrl,
        status: res.statusCode,
        response: res.data,
      });
      throw err;
    }

    return {
      data: res.data as T,
      status: res.statusCode,
      statusText: res.statusCode === 200 || res.statusCode === 201 ? 'OK' : 'Success',
      headers: res.header,
    };
  };

  return doRequest();
}

export const api = {
  get: <T = any>(url: string, params?: any) => request<T>(url, { method: 'GET', params }),
  post: <T = any>(url: string, data?: any) => request<T>(url, { method: 'POST', data }),
  put: <T = any>(url: string, data?: any) => request<T>(url, { method: 'PUT', data }),
  delete: <T = any>(url: string, params?: any) => request<T>(url, { method: 'DELETE', params }),
  patch: <T = any>(url: string, data?: any) => request<T>(url, { method: 'PATCH', data }),
};

export const tokenManager = {
  async setToken(token: string): Promise<void> {
    await Taro.setStorage({ key: STORAGE_KEYS.AUTH_TOKEN, data: token });
  },

  async getToken(): Promise<string | null> {
    try {
      const res = await Taro.getStorage({ key: STORAGE_KEYS.AUTH_TOKEN });
      return res.data;
    } catch {
      return null;
    }
  },

  async clearToken(): Promise<void> {
    await Taro.removeStorage({ key: STORAGE_KEYS.AUTH_TOKEN });
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  },
};
