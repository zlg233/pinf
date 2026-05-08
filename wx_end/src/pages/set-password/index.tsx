import React, { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore } from '@/store';
import { setupPassword } from '@/services/api/auth';
import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { OrganicCard } from '@/components/ui/OrganicCard';
import { OrganicButton } from '@/components/ui/OrganicButton';
import { Input } from '@/components/ui/Input';
import { notify } from '@/utils/feedback';
import './index.scss';

export default function SetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const authStore = useAuthStore();
  const isForced = authStore.needSetPassword;

  // ---- Validation ----
  const validatePassword = (p: string): boolean =>
    /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,16}$/.test(p);

  // ---- Submit ----
  const handleSubmit = async () => {
    if (!password) {
      setFormError('请输入密码');
      return;
    }
    if (!validatePassword(password)) {
      setFormError('密码需8-16位，包含字母和数字');
      return;
    }
    if (!confirmPassword) {
      setFormError('请确认密码');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('两次输入的密码不一致');
      return;
    }

    setFormError('');
    setIsLoading(true);
    try {
      await setupPassword(password);
      authStore.setNeedSetPassword(false);
      await Taro.switchTab({ url: '/pages/index/index' });
      notify('密码设置成功');
    } catch (err: any) {
      const msg = err?.response?.data?.message || '密码设置失败，请重试';
      setFormError(msg);
      notify(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Exit (when not forced) ----
  const handleExit = async () => {
    await Taro.switchTab({ url: '/pages/index/index' });
  };

  // ---- Event Handlers ----
  const handlePasswordInput = (e: any) => {
    setPassword(e.detail.value);
    setFormError('');
  };

  const handleConfirmInput = (e: any) => {
    setConfirmPassword(e.detail.value);
    setFormError('');
  };

  // ---- Render ----
  return (
    <OrganicBackground variant="morning">
      <View className="set-password">
        <View className="set-password__scroll-content">
          {/* ---- Logo Area ---- */}
          <View className="set-password__logo-area">
            <Text className="set-password__app-name">设置密码</Text>
            <Text className="set-password__slogan">
              请设置您的登录密码，用于后续快捷登录
            </Text>
          </View>

          {/* ---- Set Password Card ---- */}
          <OrganicCard>
            <View className="set-password__card-content">
              <Text className="set-password__card-title">创建密码</Text>

              {/* ---- Password Input ---- */}
              <View className="set-password__field">
                <Input
                  type="text"
                  password
                  maxlength={16}
                  placeholder="请输入密码（8-16位字母+数字）"
                  value={password}
                  onInput={handlePasswordInput}
                />
              </View>

              {/* ---- Confirm Password Input ---- */}
              <View className="set-password__field">
                <Input
                  type="text"
                  password
                  maxlength={16}
                  placeholder="请再次输入密码"
                  value={confirmPassword}
                  onInput={handleConfirmInput}
                />
              </View>

              {/* ---- Error Text ---- */}
              {formError && (
                <View className="set-password__error">
                  <Text className="set-password__error-text">{formError}</Text>
                </View>
              )}

              {/* ---- Submit Button ---- */}
              <View className="set-password__submit-btn">
                <OrganicButton
                  title="确认设置"
                  variant="primary"
                  size="large"
                  loading={isLoading}
                  disabled={isLoading}
                  onPress={handleSubmit}
                />
              </View>

              {/* ---- Exit Button (non-forced) ---- */}
              {!isForced && (
                <View className="set-password__exit-btn">
                  <OrganicButton
                    title="暂不设置"
                    variant="soft"
                    size="medium"
                    disabled={isLoading}
                    onPress={handleExit}
                  />
                </View>
              )}
            </View>
          </OrganicCard>
        </View>
      </View>
    </OrganicBackground>
  );
}
