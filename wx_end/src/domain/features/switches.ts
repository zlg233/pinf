/**
 * 功能开关的可见性判定（纯函数，便于单测）。
 *
 * 个人主体小程序不开放视频类目，视频属于审核敏感能力：
 * - 只有「开关已从后端加载完成」且「后端明确返回开启」时才允许展示；
 * - 加载失败、未加载完成、后端返回关闭，一律视为关闭（fail-closed）。
 */

export interface FeatureFlags {
  ai_qa: boolean;
  classroom_video: boolean;
  classroom_article: boolean;
}

/** 视频入口（课堂视频 tab、首页视频入口）是否可见。 */
export const isVideoEntryEnabled = (features: FeatureFlags, loaded: boolean): boolean =>
  loaded && features.classroom_video === true;

/** 视频详情页是否必须拦截：防止绕过入口用历史路径直接进入播放。 */
export const isVideoDetailBlocked = (features: FeatureFlags, loaded: boolean): boolean =>
  !isVideoEntryEnabled(features, loaded);

/** 课堂页是否需要退回首页：文章与视频都被后端关闭且开关已加载。 */
export const shouldLeaveClassroom = (features: FeatureFlags, loaded: boolean): boolean =>
  loaded && !features.classroom_article && features.classroom_video !== true;
