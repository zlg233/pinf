import React from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import './ContentStrip.scss';

interface ContentItem {
  id: string | number;
  title: string;
  tag?: string;
  imageUrl?: string;
}

interface ContentStripProps {
  title: string;
  items: ContentItem[];
  onPressItem?: (item: ContentItem) => void;
}

const ContentStrip: React.FC<ContentStripProps> = ({ title, items, onPressItem }) => {
  return (
    <View className="content-strip">
      <Text className="content-strip__title">{title}</Text>
      <ScrollView
        scrollX
        className="content-strip__scroll"
        enhanced
        showScrollbar={false}
      >
        {items.map((item) => (
          <View
            key={item.id}
            className="content-strip__card"
            onClick={() => onPressItem?.(item)}
          >
            <View className="content-strip__thumb">
              {item.imageUrl ? (
                <Image
                  className="content-strip__thumb-image"
                  src={item.imageUrl}
                  mode="aspectFill"
                  lazyLoad
                />
              ) : (
                <Text className="content-strip__thumb-placeholder">&#xe034;</Text>
              )}
            </View>
            {item.tag && <Text className="content-strip__tag">{item.tag}</Text>}
            <Text className="content-strip__card-title">{item.title}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default ContentStrip;
