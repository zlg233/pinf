/**
 * 图标映射表：将语义化图标名称映射到显示字符
 * 当前阶段使用 emoji/unicode 字符作为降级方案
 * 后续可接入 iconfont 字体 @font-face 加载后替换为对应 unicode 码点
 *
 * 与 app_end/components/ui/icon-symbol-map.ts 同步维护，确保所有图标名称均有映射
 */

export const ICON_MAP = {
  // === 导航图标 ===
  'house.fill': '🏠',
  'message.fill': '💬',
  'play.circle.fill': '▶️',
  'paperplane.fill': '✈️',

  // === 宝宝相关 ===
  'figure.child': '👶',

  // === 操作图标 ===
  'plus.circle.fill': '➕',
  'plus': '✚',
  'close': '✕',
  'xmark.circle.fill': '✕',
  'checkmark': '✓',
  'checkmark.circle.fill': '✓',
  'chevron.right': '›',
  'chevron.left': '‹',
  'chevron.up': '︿',
  'chevron.down': '﹀',
  'chevron.left.forwardslash.chevron.right': '⚡',
  'arrow.right': '→',
  'arrow.left': '←',
  'arrow.clockwise': '🔄',
  'arrow.triangle.2.circlepath': '🔄',

  // === 功能图标 ===
  'calendar': '📅',
  'clock': '⏰',
  'bell': '🔔',
  'bell.fill': '🔔',
  'chart': '📊',
  'chart.bar': '📊',
  'chart.bar.fill': '📊',
  'chart.line.uptrend.xyaxis': '📈',
  'heart': '❤️',
  'heart.fill': '❤️',
  'home': '🏠',
  'person': '👤',
  'person.fill': '👤',
  'person.circle.fill': '👤',
  'person.crop.circle': '👤',
  'gearshape': '⚙️',
  'gearshape.fill': '⚙️',
  'magnifyingglass': '🔍',
  'bookmark': '🔖',
  'bookmark.fill': '🔖',
  'folder.fill': '📁',
  'rectangle.stack.fill': '📚',
  'iphone': '📱',
  'key.fill': '🔑',
  'lock': '🔒',
  'lock.fill': '🔒',
  'wrench.and.screwdriver': '🔧',

  // === 内容图标 ===
  'play': '▶️',
  'camera': '📷',
  'photo': '🖼️',
  'location': '📍',
  'phone': '📞',
  'envelope': '📧',

  // === 状态图标 ===
  'star': '☆',
  'star.fill': '★',
  'info.circle': 'ℹ️',
  'info.circle.fill': 'ℹ️',
  'exclamationmark.triangle': '⚠️',
  'exclamationmark.triangle.fill': '⚠️',
  'questionmark.circle': '❓',

  // === 天气图标 ===
  'sun.max': '☀️',
  'sun': '☀️',
  'sun.max.fill': '☀️',
  'cloud.sun': '⛅',
  'moon.stars': '🌙',
  'moon.fill': '🌙',

  // === 手势图标 ===
  'hand.wave.fill': '👋',

  // === 更多图标 ===
  'pencil': '✎',
  'trash': '🗑️',
  'square.and.arrow.up': '↗️',
  'doc': '📄',
  'video': '🎬',
  'list.bullet': '☰',
  'ellipsis': '⋯',
  'wifi': '📶',
  'battery.100': '🔋',

  // === 医疗相关 ===
  'cross.case.fill': '🏥',
  'stethoscope': '🩺',
  'bandage': '🩹',
  'pills': '💊',

  // === 早护通特有 ===
  'calendar.badge.plus': '📅',
} as const;

export type IconName = keyof typeof ICON_MAP;
