import { create } from 'zustand'

const KEY = 'rustguac_api_key'

export const useAuthStore = create<{
  apiKey: string | null
  setApiKey: (k: string | null) => void
}>((set) => ({
  apiKey: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(KEY) : null,
  setApiKey: (k) => {
    if (k) sessionStorage.setItem(KEY, k)
    else sessionStorage.removeItem(KEY)
    set({ apiKey: k })
  },
}))
