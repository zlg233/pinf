import { create } from 'zustand'
import { api } from '../services/api/client'

interface Features {
  ai_qa: boolean
  classroom_video: boolean
  classroom_article: boolean
}

const defaultFeatures: Features = {
  ai_qa: true,
  classroom_video: true,
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
        set({ features: data.data, loaded: true })
      } else {
        set({ loaded: true })
      }
    } catch {
      // 失败时默认全部开启，避免误伤
      set({ loaded: true })
    }
  },
}))
