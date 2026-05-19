import axios, { type AxiosError } from 'axios'
import { useAuthStore } from '../stores/authStore'

export const api = axios.create({
  baseURL: '',
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const key = useAuthStore.getState().apiKey
  if (key) {
    config.headers.Authorization = `Bearer ${key}`
  }
  return config
})

export function getErrorMessage(err: unknown): string {
  const e = err as AxiosError<{ error?: string }>
  if (e.response?.data && typeof e.response.data === 'object') {
    const d = e.response.data as { error?: string }
    if (d.error) return d.error
  }
  if (typeof e.response?.data === 'string') return e.response.data
  if (e.message) return e.message
  return 'Request failed'
}
