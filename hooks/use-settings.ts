'use client'

import { useCallback } from 'react'
import { useLocalStorage } from './use-local-storage'
import type { SystemSettings } from '@/lib/types'
import { STORAGE_KEYS } from '@/lib/constants'
import { SAMPLE_SETTINGS } from '@/lib/sample-data'

export function useSettings() {
  const [settings, setSettings, isLoaded] = useLocalStorage<SystemSettings>(STORAGE_KEYS.SETTINGS, SAMPLE_SETTINGS)

  const updateSettings = useCallback((updates: Partial<SystemSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [setSettings])

  const resetSettings = useCallback(() => {
    setSettings(SAMPLE_SETTINGS)
  }, [setSettings])

  return {
    settings,
    isLoaded,
    updateSettings,
    resetSettings,
    setSettings
  }
}
