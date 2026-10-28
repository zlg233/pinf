/**
 * 协议正文视图（用户服务协议 / 隐私政策 共用）。
 *
 * 内容来自 src/domain/legal/documents.ts，页面只负责排版与返回；
 * 无需登录、无需同意即可阅读。
 */

import React from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { OrganicCard } from '@/components/ui/OrganicCard';
import type { LegalDocument } from '@/domain/legal/documents';

import './LegalDocumentView.scss';

interface LegalDocumentViewProps {
  document: LegalDocument;
}

export const LegalDocumentView: React.FC<LegalDocumentViewProps> = ({ document }) => {
  const handleBack = () => {
    // 直接打开协议页（扫码/分享进入）时没有上一页，回到登录页而不是卡死
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
    } else {
      Taro.reLaunch({ url: '/pages/login/index' });
    }
  };

  return (
    <OrganicBackground variant="morning">
      <ScrollView
        className="legal-doc__scroll"
        scrollY
        enhanced
        showScrollbar={false}
      >
        <View className="legal-doc__inner">
          <View className="legal-doc__header">
            <View
              className="legal-doc__back-btn"
              onClick={handleBack}
              hoverClass="legal-doc__back-btn--pressed"
            >
              <Text className="legal-doc__back-icon">{'\u2039'}</Text>
              <Text className="legal-doc__back-text">返回</Text>
            </View>
          </View>

          <OrganicCard shadow={false}>
            <View className="legal-doc__body">
              <Text className="legal-doc__title">{document.title}</Text>
              <Text className="legal-doc__updated">更新日期：{document.updatedAt}</Text>

              {document.sections.map((section) => (
                <View className="legal-doc__section" key={section.heading}>
                  <Text className="legal-doc__heading">{section.heading}</Text>
                  {(section.paragraphs ?? []).map((paragraph) => (
                    <Text className="legal-doc__paragraph" key={paragraph}>
                      {paragraph}
                    </Text>
                  ))}
                  {(section.bullets ?? []).length > 0 && (
                    <View className="legal-doc__bullets">
                      {(section.bullets ?? []).map((bullet) => (
                        <View className="legal-doc__bullet-row" key={bullet}>
                          <Text className="legal-doc__bullet-dot">{'\u2022'}</Text>
                          <Text className="legal-doc__bullet-text">{bullet}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}

              <View className="legal-doc__bottom-spacer" />
            </View>
          </OrganicCard>
        </View>
      </ScrollView>
    </OrganicBackground>
  );
};
