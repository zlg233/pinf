/**
 * modalLayout 工具 (Taro/WeChat Mini-Program)
 * 从 React Native 迁移: 纯逻辑函数，无 RN 特定类型
 */

export const modalScrollFlexStyle = { flex: 1 } as const;

/**
 * 根据是否自动高度返回合适的 ScrollView 样式
 * @param currentStyle 当前的样式对象（可为 undefined）
 * @param isAutoHeight 是否为自动高度模式
 * @returns 合并后的样式数组或原样式
 */
export function getModalScrollViewStyle(
  currentStyle: Record<string, unknown> | undefined,
  isAutoHeight: boolean
): Record<string, unknown> | Array<Record<string, unknown>> {
  if (isAutoHeight) {
    return currentStyle ?? [];
  }

  if (currentStyle === undefined) {
    return [modalScrollFlexStyle];
  }

  return [currentStyle, modalScrollFlexStyle];
}
