// =====================================
// Incentives Engine - Main Interface
// =====================================

import type { Offer, CartItem, EvaluationContext, EngineResult, PriceBreakdown, MenuItem } from '@/lib/types'
import { selectBestOffer, evaluateAllOffers } from './selector'
import { formatCurrency } from './calculator'

export { evaluateOffer, checkSchedule, checkTargeting, checkRules, checkLimits } from './evaluator'
export { calculateDiscount, formatCurrency, roundToNearestCent } from './calculator'
export { selectBestOffer, getEligibleOffers, evaluateAllOffers } from './selector'

/**
 * Process a cart through the incentives engine
 * Returns complete pricing information with best offer applied
 */
export function processCart(
  cart: CartItem[],
  offers: Offer[],
  context: EvaluationContext,
  menuItems: MenuItem[]
): EngineResult {
  // Calculate subtotal
  const subtotal = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0)

  // Get all evaluated offers
  const allEvaluated = evaluateAllOffers(offers, cart, context, menuItems)
  const eligibleOffers = allEvaluated.filter(eo => eo.eligible)

  // Select best offer
  const bestOffer = selectBestOffer(offers, cart, context, menuItems)

  // Calculate final total
  const discount = bestOffer?.discount || 0
  const finalTotal = Math.max(0, subtotal - discount)

  // Build price breakdown
  const breakdown: PriceBreakdown = {
    items: cart.map(item => ({
      name: item.menuItem.name,
      quantity: item.quantity,
      unitPrice: item.menuItem.price,
      lineTotal: item.menuItem.price * item.quantity
    })),
    subtotal,
    discountName: bestOffer?.offer.name,
    discountType: bestOffer?.offer.type,
    discountAmount: discount,
    finalTotal
  }

  return {
    subtotal,
    eligibleOffers,
    bestOffer,
    discount,
    finalTotal,
    breakdown
  }
}

/**
 * Create a default evaluation context
 */
export function createDefaultContext(
  channel: EvaluationContext['channel'] = 'web',
  locationId: string = ''
): EvaluationContext {
  return {
    channel,
    locationId,
    currentTime: new Date()
  }
}

/**
 * Format a price breakdown for display
 */
export function formatBreakdown(breakdown: PriceBreakdown): {
  items: { name: string; quantity: number; unitPrice: string; lineTotal: string }[]
  subtotal: string
  discountName?: string
  discountAmount: string
  finalTotal: string
  savings: string
} {
  return {
    items: breakdown.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: formatCurrency(item.unitPrice),
      lineTotal: formatCurrency(item.lineTotal)
    })),
    subtotal: formatCurrency(breakdown.subtotal),
    discountName: breakdown.discountName,
    discountAmount: breakdown.discountAmount > 0 ? `-${formatCurrency(breakdown.discountAmount)}` : formatCurrency(0),
    finalTotal: formatCurrency(breakdown.finalTotal),
    savings: formatCurrency(breakdown.discountAmount)
  }
}
