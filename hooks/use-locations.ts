'use client'

import { useCallback } from 'react'
import { useLocalStorage } from './use-local-storage'
import type { Location } from '@/lib/types'
import { STORAGE_KEYS } from '@/lib/constants'
import { SAMPLE_LOCATIONS } from '@/lib/sample-data'

export function useLocations() {
  const [locations, setLocations, isLoaded] = useLocalStorage<Location[]>(STORAGE_KEYS.LOCATIONS, SAMPLE_LOCATIONS)

  const addLocation = useCallback((location: Omit<Location, 'id'>) => {
    const newLocation: Location = {
      ...location,
      id: Math.random().toString(36).substring(2, 15)
    }
    setLocations(prev => [...prev, newLocation])
    return newLocation
  }, [setLocations])

  const updateLocation = useCallback((id: string, updates: Partial<Location>) => {
    setLocations(prev => prev.map(loc => 
      loc.id === id ? { ...loc, ...updates } : loc
    ))
  }, [setLocations])

  const deleteLocation = useCallback((id: string) => {
    setLocations(prev => prev.filter(loc => loc.id !== id))
  }, [setLocations])

  const getActiveLocations = useCallback(() => {
    return locations.filter(loc => loc.active)
  }, [locations])

  return {
    locations,
    isLoaded,
    addLocation,
    updateLocation,
    deleteLocation,
    getActiveLocations,
    setLocations
  }
}
