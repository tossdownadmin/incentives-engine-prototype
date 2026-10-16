'use client'

import { useEffect, useState } from 'react'
import type { Location } from '@/lib/types'
import { responseList, simulatorApi, type SimulatorApiStatus } from '@/lib/simulator-api'

function normalizeLocation(value: any, index: number): Location | null {
  if (!value || typeof value !== 'object') return null
  const id = value.id ?? value.locationId ?? value._id
  if (id == null) return null

  const addressValue = value.address ?? value.formattedAddress ?? value.addressLine
  const address = typeof addressValue === 'string'
    ? addressValue
    : addressValue && typeof addressValue === 'object'
      ? [addressValue.line1, addressValue.line2, addressValue.city, addressValue.state, addressValue.postalCode]
        .filter(Boolean)
        .join(', ')
      : undefined

  return {
    id: String(id),
    name: String(value.name ?? value.title ?? value.locationName ?? `Location ${index + 1}`),
    address: address || undefined,
    active: Boolean(value.isActive ?? value.active ?? String(value.status ?? '').toUpperCase() !== 'INACTIVE'),
  }
}

export function useBusinessLocations(localLocations: Location[]) {
  const [businessLocations, setBusinessLocations] = useState<Location[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const status = await simulatorApi<SimulatorApiStatus>('status')
        if (!status.locationsConfigured) {
          if (!cancelled) setBusinessLocations([])
          return
        }

        try {
          const response = await simulatorApi<any>('locations')
        const normalizedLocations: (Location | null)[] = responseList(response, ['locations'])
          .map((value: unknown, index: number) => normalizeLocation(value, index))
        const locations = normalizedLocations.filter((location): location is Location => location !== null)
          if (!cancelled) setBusinessLocations(locations)
        } catch (cause) {
          if (!cancelled) {
            setBusinessLocations([])
            setError(cause instanceof Error ? cause.message : 'Could not load Ordrz business locations.')
          }
        }
      } catch {
        if (!cancelled) setBusinessLocations(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()

    return () => { cancelled = true }
  }, [])

  return {
    locations: businessLocations ?? localLocations,
    isBusinessSource: businessLocations !== null,
    isLoading,
    error,
  }
}
