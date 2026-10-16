'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from './use-local-storage'
import type { MenuItem } from '@/lib/types'
import { STORAGE_KEYS } from '@/lib/constants'
import { SAMPLE_MENU_ITEMS } from '@/lib/sample-data'
import { createOrdrzItem, fetchOrdrzMenu, ordrzApi, updateOrdrzItem, type OrdrzApiStatus } from '@/lib/ordrz-client'

export function useMenuItems() {
  const [items, setItems, isLoaded] = useLocalStorage<MenuItem[]>(STORAGE_KEYS.MENU_ITEMS, SAMPLE_MENU_ITEMS)
  const [apiCategories, setApiCategories] = useState<string[]>([])
  const [apiStatus, setApiStatus] = useState<OrdrzApiStatus | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [apiLoaded, setApiLoaded] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    let cancelled = false
    const load = async () => {
      try {
        const status = await ordrzApi<OrdrzApiStatus>('status')
        if (cancelled) return
        setApiStatus(status)

        if (!status.productsConfigured) {
          setApiLoaded(true)
          return
        }

        try {
          const data = await fetchOrdrzMenu()
          if (cancelled) return
          setItems(data.items)
          setApiCategories(data.categories)
          setApiError(null)
        } catch (error) {
          if (cancelled) return
          setItems([])
          setApiCategories([])
          setApiError(error instanceof Error ? error.message : 'Could not load Ordrz products')
        }
        setApiLoaded(true)
      } catch (error) {
        if (!cancelled) {
          setApiError(error instanceof Error ? error.message : 'Could not load Ordrz products')
          setApiLoaded(true)
        }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [isLoaded, setItems])

  // Migrate the imported restaurant menu into existing local workspaces once.
  // This preserves user-created items while making the supplied catalog available
  // to the offer builder and cart immediately.
  useEffect(() => {
    if (!isLoaded || !apiLoaded || apiStatus?.productsConfigured) return
    setItems(previous => {
      const legacyPrefixes = ['BURG-', 'FRIES-', 'DRINK-', 'PIZZA-', 'SALAD-', 'WINGS-', 'DESSERT-']
      const cleaned = previous.filter(item => !legacyPrefixes.some(prefix => item.sku.startsWith(prefix)))
      const knownIds = new Set(cleaned.map(item => item.id))
      const missing = SAMPLE_MENU_ITEMS.filter(item => !knownIds.has(item.id))
      return cleaned.length !== previous.length || missing.length ? [...cleaned, ...missing] : previous
    })
  }, [isLoaded, apiLoaded, apiStatus?.productsConfigured, setItems])

  const categories = useMemo(() => {
    const cats = new Set([...items.map(item => item.category), ...apiCategories])
    return Array.from(cats).sort()
  }, [items, apiCategories])

  const addItem = useCallback(async (item: Omit<MenuItem, 'id'>) => {
    if (apiStatus?.addItemConfigured) {
      const createdItem = await createOrdrzItem(item)
      setItems(prev => [...prev.filter(existing => existing.id !== createdItem.id), createdItem])
      return createdItem
    }
    const newItem: MenuItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 15)
    }
    setItems(prev => [...prev, newItem])
    return newItem
  }, [apiStatus, setItems])

  const updateItem = useCallback(async (id: string, updates: Partial<MenuItem>) => {
    if (apiStatus?.itemsConfigured) {
      const current = items.find(item => item.id === id)
      if (!current) return
      const updated = await updateOrdrzItem({ ...current, ...updates })
      setItems(prev => prev.map(item => item.id === id ? updated : item))
      return
    }
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ))
  }, [apiStatus, items, setItems])

  const deleteItem = useCallback(async (id: string) => {
    if (apiStatus?.itemsConfigured) {
      await ordrzApi(`items/${encodeURIComponent(id)}`, 'DELETE')
    }
    setItems(prev => prev.filter(item => item.id !== id))
  }, [apiStatus, setItems])

  const getItemBySku = useCallback((sku: string) => {
    return items.find(item => item.sku === sku)
  }, [items])

  const getItemsByCategory = useCallback((category: string) => {
    return items.filter(item => item.category === category)
  }, [items])

  const getItemsBySkus = useCallback((skus: string[]) => {
    return items.filter(item => skus.includes(item.sku))
  }, [items])

  return {
    items,
    categories,
    isLoaded,
    apiLoaded,
    apiStatus,
    apiError,
    addItem,
    updateItem,
    deleteItem,
    getItemBySku,
    getItemsByCategory,
    getItemsBySkus,
    setItems
  }
}
