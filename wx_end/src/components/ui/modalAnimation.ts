/**
 * modalAnimation 工具 (Taro/WeChat Mini-Program)
 * 从 React Native 迁移: Platform.OS check → constant true
 * Taro 小程序始终支持原生驱动等价物，简化布尔常量
 */

export const USE_NATIVE_DRIVER = true;

/** @deprecated 使用 USE_NATIVE_DRIVER 常量 */
export function getUseNativeDriver(): boolean {
  return USE_NATIVE_DRIVER;
}
