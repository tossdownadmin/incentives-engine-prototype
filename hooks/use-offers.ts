'use client'

import { useCallback, useEffect } from 'react'
import { useLocalStorage } from './use-local-storage'
import type { Offer, OfferStatus } from '@/lib/types'
import { STORAGE_KEYS } from '@/lib/constants'
import { SAMPLE_OFFERS } from '@/lib/sample-data'

export function useOffers() {
  const [offers, setOffers, isLoaded] = useLocalStorage<Offer[]>(STORAGE_KEYS.OFFERS, SAMPLE_OFFERS)

  // Remove the old built-in demo promotions from existing browser workspaces.
  useEffect(() => {
    if (!isLoaded) return
    const demoIds = new Set([
      'offer-happy-hour',
      'offer-burger-combo',
      'offer-pizza-bogo',
      'offer-new-customer',
      'offer-wings-weekend',
      'offer-test-draft',
    ])
    const cleaned = offers.filter(offer => !demoIds.has(offer.id))
    if (cleaned.length !== offers.length) setOffers(cleaned)
  }, [isLoaded, offers, setOffers])

  const addOffer = useCallback((offer: Omit<Offer, 'id' | 'createdAt' | 'updatedAt' | 'limits'> & { limits?: Partial<Offer['limits']> }) => {
    const newOffer: Offer = {
      ...offer,
      id: Math.random().toString(36).substring(2, 15),
      limits: {
        maxRedemptions: offer.limits?.maxRedemptions,
        maxPerTransaction: offer.limits?.maxPerTransaction,
        currentRedemptions: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setOffers(prev => [...prev, newOffer])
    return newOffer
  }, [setOffers])

  const updateOffer = useCallback((id: string, updates: Partial<Offer>) => {
    setOffers(prev => prev.map(offer => 
      offer.id === id 
        ? { ...offer, ...updates, updatedAt: new Date().toISOString() }
        : offer
    ))
  }, [setOffers])

  const deleteOffer = useCallback((id: string) => {
    setOffers(prev => prev.filter(offer => offer.id !== id))
  }, [setOffers])

  const duplicateOffer = useCallback((id: string) => {
    const offer = offers.find(o => o.id === id)
    if (!offer) return null
    
    const duplicated: Offer = {
      ...offer,
      id: Math.random().toString(36).substring(2, 15),
      name: `${offer.name} (Copy)`,
      status: 'draft' as OfferStatus,
      limits: {
        ...offer.limits,
        currentRedemptions: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setOffers(prev => [...prev, duplicated])
    return duplicated
  }, [offers, setOffers])

  const toggleStatus = useCallback((id: string) => {
    setOffers(prev => prev.map(offer => {
      if (offer.id !== id) return offer
      const newStatus: OfferStatus = offer.status === 'active' ? 'paused' : 
                                      offer.status === 'paused' ? 'active' :
                                      offer.status === 'draft' ? 'active' : offer.status
      return { ...offer, status: newStatus, updatedAt: new Date().toISOString() }
    }))
  }, [setOffers])

  const incrementRedemption = useCallback((id: string) => {
    setOffers(prev => prev.map(offer => 
      offer.id === id 
        ? { 
            ...offer, 
            limits: { 
              ...offer.limits, 
              currentRedemptions: offer.limits.currentRedemptions + 1 
            }
          }
        : offer
    ))
  }, [setOffers])

  const getOfferById = useCallback((id: string) => {
    return offers.find(o => o.id === id)
  }, [offers])

  const getActiveOffers = useCallback(() => {
    return offers.filter(o => o.status === 'active')
  }, [offers])

  return {
    offers,
    isLoaded,
    addOffer,
    updateOffer,
    deleteOffer,
    duplicateOffer,
    toggleStatus,
    incrementRedemption,
    getOfferById,
    getActiveOffers,
    setOffers
  }
}
