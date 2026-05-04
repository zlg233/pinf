import React, { useState, useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore } from '@/store';
import { updateProfile } from '@/services/api/auth';
import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { OrganicCard } from '@/components/ui/OrganicCard';
import { OrganicButton } from '@/components/ui/OrganicButton';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { confirm } from '@/utils/feedback';
import './index.scss';

export default function Profile() {
  const { user, setUser, logout } = useAuthStore();
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nickname, setNickname] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  const displayName = useMemo(() => {
    const name = user?.name?.trim();
    return name && name.length > 0 ? name : '未设置昵称';
  }, [user?.name]);

  const phoneText = useMemo(() => {
    if (!user?.phone) return '未绑定手机号';
    if (user.phone.length < 7) return user.phone;
    return `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}`;
  }, [user?.phone]);

  const avatarLetter = useMemo(() => {
    const name = user?.name?.trim();
    return name && name.length > 0 ? name[0].toUpperCase() : '👤';
  }, [user?.name]);

  const handleOpenNicknameEdit = () => {
    setNickname(user?.name || '');
    setShowNicknameModal(true);
  };

  const handleSaveNickname = async () => {
    const nextName = nickname.trim();
    if (!nextName) return;
    if (!user) return;

    setIsSaving(true);
    try {
      const response = await updateProfile(nextName);
      setUser({ ...user, ...response.data.user });
      setShowNicknameModal(false);
    } catch {
      // 静默处理错误，用户可重试
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = await confirm('确定要退出当前账号吗？', '退出登录');
    if (!confirmed) return;
    await logout();
    Taro.reLaunch({ url: '/pages/login/index' });
  };

  const handleChangePassword = () => {
    Taro.navigateTo({ url: '/pages/set-password/index' });
  };

  const handleAbout = () => {
    setShowAboutModal(true);
  };

  return (
    <OrganicBackground variant="morning">
      <View className="page-profile">
        <OrganicCard shadow>
          <View className="profile-top">
            <View className="avatar-wrap">
              <Text className="avatar-text">{avatarLetter}</Text>
            </View>
            <View className="profile-text">
              <View className="nickname-row" onClick={handleOpenNicknameEdit}>
                <Text className="nickname">{displayName}</Text>
                <Text className="edit-icon">✎</Text>
              </View>
              <Text className="phone">{phoneText}</Text>
            </View>
          </View>
        </OrganicCard>

        <OrganicCard shadow>
          <View className="menu-item" onClick={handleChangePassword}>
            <View className="menu-left">
              <View className="menu-icon">🔒</View>
              <Text className="menu-text">修改密码</Text>
            </View>
            <Text className="menu-arrow">›</Text>
          </View>
          <View className="menu-item" onClick={handleAbout}>
            <View className="menu-left">
              <View className="menu-icon">ℹ️</View>
              <Text className="menu-text">关于我们</Text>
            </View>
            <Text className="menu-arrow">›</Text>
          </View>
          <View className="menu-item" onClick={handleLogout}>
            <View className="menu-left">
              <View className="menu-icon">🚪</View>
              <Text className="menu-text menu-text--danger">退出登录</Text>
            </View>
            <Text className="menu-arrow">›</Text>
          </View>
        </OrganicCard>
      </View>

      <Modal
        visible={showNicknameModal}
        onClose={() => setShowNicknameModal(false)}
        title="修改昵称"
      >
        <View className="edit-modal-content">
          <View className="edit-modal-input">
            <Input
              value={nickname}
              onInput={(e: { detail: { value: string } }) => setNickname(e.detail.value)}
              placeholder="请输入您的昵称"
              maxlength={20}
            />
          </View>
          <OrganicButton
            title={isSaving ? '保存中...' : '保存'}
            onPress={handleSaveNickname}
            loading={isSaving}
            disabled={isSaving}
          />
        </View>
      </Modal>

      <Modal
        visible={showAboutModal}
        onClose={() => setShowAboutModal(false)}
        title="关于我们"
      >
        <View className="about-modal-content">
          <View className="about-logo">👶</View>
          <Text className="about-name">早护通</Text>
          <Text className="about-version">版本 1.0.0</Text>
          <Text className="about-desc">
            早护通是一款专为新生儿及早产儿家庭设计的健康管理应用，提供成长记录、健康监测、喂养管理等功能，助力宝宝健康成长。
          </Text>
        </View>
      </Modal>
    </OrganicBackground>
  );
}
