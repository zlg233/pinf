import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore } from '@/store';
import { sendPhoneCode, phoneLogin, passwordLogin } from '@/services/api/auth';
import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { OrganicCard } from '@/components/ui/OrganicCard';
import { OrganicButton } from '@/components/ui/OrganicButton';
import { Input } from '@/components/ui/Input';
import { notify } from '@/utils/feedback';
import './index.scss';

type LoginMode = 'code' | 'password';

export default function LoginPage() {
  // ---- Form State ----
  const [loginMode, setLoginMode] = useState<LoginMode>('code');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [debugCode, setDebugCode] = useState('');
  const [formError, setFormError] = useState('');

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authStore = useAuthStore();

  // ---- Cleanup on Unmount ----
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // ---- Countdown Timer ----
  const startCountdown = useCallback((seconds = 60) => {
    setCountdown(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ---- Validation Helpers ----
  const validatePhone = (p: string): boolean => /^1[3-9]\d{9}$/.test(p);
  const validatePassword = (p: string): boolean =>
    /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,16}$/.test(p);

  // ---- Send Verification Code ----
  const handleSendCode = async () => {
    if (!phone) {
      setFormError('请输入手机号');
      return;
    }
    if (!validatePhone(phone)) {
      setFormError('手机号格式不正确');
      return;
    }

    setFormError('');
    setIsSendingCode(true);
    try {
      const res = await sendPhoneCode(phone);
      const code = res?.data?.code;
      if (code) {
        setDebugCode(code);
      }
      startCountdown();
      notify('验证码已发送');
    } catch (err: any) {
      const msg = err?.response?.data?.message || '发送验证码失败';
      setFormError(msg);
      notify(msg);
    } finally {
      setIsSendingCode(false);
    }
  };

  // ---- Login ----
  const handleLogin = async () => {
    // Phone validation
    if (!phone) {
      setFormError('请输入手机号');
      return;
    }
    if (!validatePhone(phone)) {
      setFormError('手机号格式不正确');
      return;
    }

    // Code / Password validation
    if (loginMode === 'code') {
      if (!code) {
        setFormError('请输入验证码');
        return;
      }
      if (code.length !== 6) {
        setFormError('验证码为6位数字');
        return;
      }
    } else {
      if (!password) {
        setFormError('请输入密码');
        return;
      }
      if (!validatePassword(password)) {
        setFormError('密码需8-16位，包含字母和数字');
        return;
      }
    }

    setFormError('');
    setIsLoading(true);
    try {
      const res =
        loginMode === 'code'
          ? await phoneLogin(phone, code)
          : await passwordLogin(phone, password);

      const { token, user, need_set_password } = res.data;

      await authStore.login(user, token, need_set_password);

      if (need_set_password) {
        await Taro.redirectTo({ url: '/pages/set-password/index' });
      } else {
        await Taro.switchTab({ url: '/pages/index/index' });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || '登录失败，请重试';
      setFormError(msg);
      notify(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Event Handlers ----
  const handleModeChange = (mode: LoginMode) => {
    setLoginMode(mode);
    setFormError('');
  };

  const handlePhoneInput = (e: any) => {
    setPhone(e.detail.value);
    setFormError('');
  };

  const handleCodeInput = (e: any) => {
    setCode(e.detail.value);
    setFormError('');
  };

  const handlePasswordInput = (e: any) => {
    setPassword(e.detail.value);
    setFormError('');
  };

  const isSendCodeDisabled = countdown > 0 || isSendingCode;

  // ---- Render ----
  return (
    <OrganicBackground variant="morning">
      <View className="login">
        <View className="login__scroll-content">
          {/* ---- Logo Area ---- */}
          <View className="login__logo-area">
            <View className="login__logo-circle">
              <Text className="login__logo-text">早</Text>
            </View>
            <Text className="login__app-name">早护通</Text>
            <Text className="login__slogan">新生儿/早产儿健康管理</Text>
          </View>

          {/* ---- Login Card ---- */}
          <OrganicCard>
            <View className="login__card-content">
              <Text className="login__card-title">手机号登录</Text>

              {/* ---- Mode Switch ---- */}
              <View className="login__mode-switch">
                <View
                  className={`login__mode-btn${loginMode === 'code' ? ' login__mode-btn--active' : ''}`}
                  hoverClass="login__mode-btn--hover"
                  onClick={() => handleModeChange('code')}
                >
                  <Text
                    className={`login__mode-text${loginMode === 'code' ? ' login__mode-text--active' : ''}`}
                  >
                    验证码登录
                  </Text>
                </View>
                <View
                  className={`login__mode-btn${loginMode === 'password' ? ' login__mode-btn--active' : ''}`}
                  hoverClass="login__mode-btn--hover"
                  onClick={() => handleModeChange('password')}
                >
                  <Text
                    className={`login__mode-text${loginMode === 'password' ? ' login__mode-text--active' : ''}`}
                  >
                    密码登录
                  </Text>
                </View>
              </View>

              {/* ---- Phone Input ---- */}
              <View className="login__field">
                <Input
                  type="text"
                  maxlength={11}
                  placeholder="请输入手机号"
                  value={phone}
                  onInput={handlePhoneInput}
                />
              </View>

              {/* ---- Code Mode ---- */}
              {loginMode === 'code' && (
                <View className="login__field">
                  <View className="login__code-row">
                    <View className="login__code-input-wrap">
                      <Input
                        type="number"
                        maxlength={6}
                        placeholder="请输入验证码"
                        value={code}
                        onInput={handleCodeInput}
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </View>
                    <View
                      className={`login__send-code-btn${isSendCodeDisabled ? ' login__send-code-btn--disabled' : ''}`}
                      hoverClass="login__send-code-btn--hover"
                      onClick={isSendCodeDisabled ? undefined : handleSendCode}
                    >
                      <Text className="login__send-code-text">
                        {isSendingCode
                          ? '发送中...'
                          : countdown > 0
                            ? `${countdown}s`
                            : '获取验证码'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* ---- Password Mode ---- */}
              {loginMode === 'password' && (
                <View className="login__field">
                  <Input
                    type="text"
                    password
                    maxlength={16}
                    placeholder="请输入密码（8-16位字母+数字）"
                    value={password}
                    onInput={handlePasswordInput}
                  />
                </View>
              )}

              {/* ---- Debug Code Display ---- */}
              {debugCode && (
                <View className="login__debug-code">
                  <Text className="login__debug-code-text">
                    调试验证码: {debugCode}
                  </Text>
                </View>
              )}

              {/* ---- Error Text ---- */}
              {formError && (
                <View className="login__error">
                  <Text className="login__error-text">{formError}</Text>
                </View>
              )}

              {/* ---- Login Button ---- */}
              <View className="login__submit-btn">
                <OrganicButton
                  title="登录"
                  variant="primary"
                  size="large"
                  loading={isLoading}
                  disabled={isLoading}
                  onPress={handleLogin}
                />
              </View>

              {/* ---- Terms Hint ---- */}
              <Text className="login__hint">
                登录即表示同意《用户服务协议》和《隐私政策》
              </Text>
            </View>
          </OrganicCard>
        </View>
      </View>
    </OrganicBackground>
  );
}
