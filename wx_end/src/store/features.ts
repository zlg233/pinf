import { create } from 'zustand'
import { api } from '../services/api/client'

interface Features {
  ai_qa: boolean
  classroom_video: boolean
  classroom_article: boolean
}

// 视频对个人主体小程序属于敏感能力：默认关闭，只有后端明确开启才展示
// （审核期间通过 FEATURE_CLASSROOM_VIDEO=false 隐藏，改动后无需重新发版）
const defaultFeatures: Features = {
  ai_qa: true,
  classroom_video: false,
  classroom_article: true,
}

export const useFeaturesStore = create<{
  features: Features
  loaded: boolean
  fetchFeatures: () => Promise<void>
}>((set) => ({
  features: defaultFeatures,
  loaded: false,
  fetchFeatures: async () => {
    try {
      const res = await api.get('/settings/features')
      const data = res.data
      if (data.status === 'success') {
        // 逐字段兜底：后端少回字段时不要顺手把敏感能力打开
        set({
          features: {
            ai_qa: data.data?.ai_qa ?? defaultFeatures.ai_qa,
            classroom_video: data.data?.classroom_video ?? defaultFeatures.classroom_video,
            classroom_article: data.data?.classroom_article ?? defaultFeatures.classroom_article,
          },
          loaded: true,
        })
      } else {
        set({ loaded: true })
      }
    } catch {
      // 失败时保持当前 features（默认值本身已是视频关闭），只标记加载完成
      set({ loaded: true })
    }
  },
}))
