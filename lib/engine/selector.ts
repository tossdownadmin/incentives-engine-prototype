// =====================================
// Best Offer Selector
// Selects the single best offer from eligible offers
// =====================================

import type { Offer, CartItem, EvaluationContext, EvaluatedOffer, MenuItem } from '@/lib/types'
import { evaluateOffer } from './evaluator'
import { calculateDiscount } from './calculator'

/**
 * Evaluate all offers and return sorted by best value
 */
export function evaluateAllOffers(
  offers: Offer[],
  cart: CartItem[],
  context: EvaluationContext,
  menuItems: MenuItem[]
): EvaluatedOffer[] {
  // Only evaluate active offers to avoid noise
  const activeOffers = offers.filter(o => o.status === 'active' || o.status === 'scheduled')
  
  return activeOffers.map(offer => {
    const eligibility = evaluateOffer(offer, cart, context, menuItems)
    
    if (!eligibility.eligible) {
      return {
        offer,
        eligible: false,
        reason: eligibility.reason,
        discount: 0
      }
    }

    const calculation = calculateDiscount(offer, cart, menuItems)
    
    return {
      offer,
      eligible: true,
      discount: calculation.discount,
      affectedItems: calculation.affectedItems
    }
  })
}

/**
 * Select the best offer from all eligible offers
 * 
 * Selection criteria (in order):
 * 1. Highest discount value
 * 2. If tied, highest priority
 * 3. If still tied, most recently updated
 */
export function selectBestOffer(
  offers: Offer[],
  cart: CartItem[],
  context: EvaluationContext,
  menuItems: MenuItem[]
): EvaluatedOffer | null {
  // Early return if cart is empty
  if (cart.length === 0) {
    return null
  }

  const evaluatedOffers = evaluateAllOffers(offers, cart, context, menuItems)
  
  // Filter to only eligible offers with positive discount
  const eligibleOffers = evaluatedOffers.filter(eo => eo.eligible && eo.discount > 0)

  if (eligibleOffers.length === 0) {
    return null
  }

  // Sort by: discount (desc), priority (desc), updatedAt (desc)
  eligibleOffers.sort((a, b) => {
    // First by discount value
    if (b.discount !== a.discount) {
      return b.discount - a.discount
    }
    
    // Then by priority
    if (b.offer.priority !== a.offer.priority) {
      return b.offer.priority - a.offer.priority
    }
    
    // Finally by most recent update
    return new Date(b.offer.updatedAt).getTime() - new Date(a.offer.updatedAt).getTime()
  })

  return eligibleOffers[0]
}

/**
 * Get all eligible offers (not just the best one)
 * Useful for showing customers their options
 */
export function getEligibleOffers(
  offers: Offer[],
  cart: CartItem[],
  context: EvaluationContext,
  menuItems: MenuItem[]
): EvaluatedOffer[] {
  const evaluatedOffers = evaluateAllOffers(offers, cart, context, menuItems)
  return evaluatedOffers
    .filter(eo => eo.eligible)
    .sort((a, b) => b.discount - a.discount)
}
