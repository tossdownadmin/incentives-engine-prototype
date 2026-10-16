// =====================================
// Offer Eligibility Evaluator
// =====================================

import type { Offer, CartItem, EvaluationContext, MenuItem } from '@/lib/types'

export interface EligibilityResult {
  eligible: boolean
  reason?: string
}

/**
 * Evaluate if an offer is eligible for a given cart and context
 */
export function evaluateOffer(
  offer: Offer,
  cart: CartItem[],
  context: EvaluationContext,
  menuItems: MenuItem[]
): EligibilityResult {
  // Cart must have items
  if (cart.length === 0) {
    return { eligible: false, reason: 'Cart is empty' }
  }

  // Check if offer is active
  if (offer.status !== 'active') {
    return { eligible: false, reason: `Offer is ${offer.status}` }
  }

  // Check redemption limits
  const limitsResult = checkLimits(offer)
  if (!limitsResult.eligible) return limitsResult

  // Check schedule (dates, times, days)
  const scheduleResult = checkSchedule(offer, context.currentTime)
  if (!scheduleResult.eligible) return scheduleResult

  // Check targeting (channels, locations)
  const targetingResult = checkTargeting(offer, context)
  if (!targetingResult.eligible) return targetingResult

  // Check rules (min spend, items, categories)
  const rulesResult = checkRules(offer, cart, menuItems)
  if (!rulesResult.eligible) return rulesResult

  // Check offer-type specific requirements
  const typeResult = checkOfferTypeRequirements(offer, cart, menuItems)
  if (!typeResult.eligible) return typeResult

  return { eligible: true }
}

/**
 * Check if offer has reached its redemption limits
 */
export function checkLimits(offer: Offer): EligibilityResult {
  if (offer.limits.maxRedemptions !== undefined) {
    if (offer.limits.currentRedemptions >= offer.limits.maxRedemptions) {
      return { eligible: false, reason: 'Maximum redemptions reached' }
    }
  }
  return { eligible: true }
}

/**
 * Check if current time is within offer schedule
 */
export function checkSchedule(offer: Offer, currentTime: Date): EligibilityResult {
  const { schedule } = offer

  // Check start date
  const startDate = new Date(schedule.startDate)
  startDate.setHours(0, 0, 0, 0)
  if (currentTime < startDate) {
    return { eligible: false, reason: 'Offer has not started yet' }
  }

  // Check end date
  if (schedule.endDate) {
    const endDate = new Date(schedule.endDate)
    endDate.setHours(23, 59, 59, 999)
    if (currentTime > endDate) {
      return { eligible: false, reason: 'Offer has expired' }
    }
  }

  // Check days of week
  if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
    const currentDay = currentTime.getDay()
    if (!schedule.daysOfWeek.includes(currentDay)) {
      return { eligible: false, reason: 'Offer not available today' }
    }
  }

  // Check time windows
  if (schedule.timeWindows && schedule.timeWindows.length > 0) {
    const currentTimeStr = currentTime.toTimeString().slice(0, 5) // "HH:MM"
    const inWindow = schedule.timeWindows.some(window => {
      return currentTimeStr >= window.startTime && currentTimeStr <= window.endTime
    })
    if (!inWindow) {
      return { eligible: false, reason: 'Outside offer time window' }
    }
  }

  return { eligible: true }
}

/**
 * Check if offer targeting matches context
 */
export function checkTargeting(offer: Offer, context: EvaluationContext): EligibilityResult {
  const { targeting } = offer

  // Check channel
  if (!targeting.channels.includes('all') && !targeting.channels.includes(context.channel)) {
    return { eligible: false, reason: `Not available on ${context.channel} channel` }
  }

  // Check location
  if (targeting.locations.length > 0 && !targeting.locations.includes(context.locationId)) {
    return { eligible: false, reason: 'Not available at this location' }
  }

  return { eligible: true }
}

/**
 * Check if cart meets offer rules
 */
export function checkRules(
  offer: Offer,
  cart: CartItem[],
  menuItems: MenuItem[]
): EligibilityResult {
  const { rules } = offer
  
  // Calculate cart subtotal (in cents)
  const subtotal = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0)

  // Check minimum spend
  if (rules.minSpend !== undefined && subtotal < rules.minSpend) {
    const minSpendDollars = (rules.minSpend / 100).toFixed(2)
    return { eligible: false, reason: `Minimum spend of $${minSpendDollars} required` }
  }

  // Check included items and categories together so a selected item that is
  // outside the selected category cannot make the offer look eligible.
  if ((rules.includedItems && rules.includedItems.length > 0) || (rules.includedCategories && rules.includedCategories.length > 0)) {
    const hasIncluded = cart.some(item =>
      (!rules.includedItems?.length || rules.includedItems.includes(item.menuItem.sku)) &&
      (!rules.includedCategories?.length || rules.includedCategories.includes(item.menuItem.category))
    )
    if (!hasIncluded) {
      return { eligible: false, reason: 'Required item or category is not in the cart' }
    }
  }

  // Check excluded items (none should be in cart for this offer to apply)
  if (rules.excludedItems && rules.excludedItems.length > 0) {
    const cartSkus = cart.map(item => item.menuItem.sku)
    const hasExcluded = rules.excludedItems.some(sku => cartSkus.includes(sku))
    if (hasExcluded) {
      return { eligible: false, reason: 'Cart contains excluded items' }
    }
  }

  // Check excluded categories
  if (rules.excludedCategories && rules.excludedCategories.length > 0) {
    const cartCategories = cart.map(item => item.menuItem.category)
    const hasExcluded = rules.excludedCategories.some(cat => cartCategories.includes(cat))
    if (hasExcluded) {
      return { eligible: false, reason: 'Cart contains items from excluded categories' }
    }
  }

  return { eligible: true }
}

/**
 * Check offer-type specific requirements
 */
export function checkOfferTypeRequirements(
  offer: Offer,
  cart: CartItem[],
  menuItems: MenuItem[]
): EligibilityResult {
  switch (offer.type) {
    case 'bundle':
      return checkBundleRequirements(offer, cart)
    case 'bogo':
      return checkBogoRequirements(offer, cart)
    default:
      return { eligible: true }
  }
}

/**
 * Check if all bundle items are in cart
 */
function checkBundleRequirements(offer: Offer, cart: CartItem[]): EligibilityResult {
  if (!offer.bundleItems || offer.bundleItems.length === 0) {
    return { eligible: false, reason: 'Bundle has no items defined' }
  }

  const cartSkus = new Map<string, number>()
  cart.forEach(item => {
    cartSkus.set(item.menuItem.sku, (cartSkus.get(item.menuItem.sku) || 0) + item.quantity)
  })

  // Check if all bundle items are present
  const bundleSkuCount = new Map<string, number>()
  offer.bundleItems.forEach(sku => {
    bundleSkuCount.set(sku, (bundleSkuCount.get(sku) || 0) + 1)
  })

  for (const [sku, requiredQty] of bundleSkuCount) {
    const cartQty = cartSkus.get(sku) || 0
    if (cartQty < requiredQty) {
      return { eligible: false, reason: 'Not all bundle items in cart' }
    }
  }

  return { eligible: true }
}

/**
 * Check if BOGO requirements are met
 */
function checkBogoRequirements(offer: Offer, cart: CartItem[]): EligibilityResult {
  const buyQty = offer.buyQuantity || 0
  
  if (buyQty <= 0) {
    return { eligible: false, reason: 'Invalid BOGO configuration' }
  }

  // Buy items trigger the promotion. Reward items are checked separately when configured.
  const buyItems = offer.bogoItems && offer.bogoItems.length > 0
    ? cart.filter(item => offer.bogoItems!.includes(item.menuItem.sku))
    : cart

  const buyQtyInCart = buyItems.reduce((sum, item) => sum + item.quantity, 0)
  const possibleSets = Math.floor(buyQtyInCart / buyQty)
  if (offer.bogoRewardItems && offer.bogoRewardItems.length > 0) {
    const rewardItems = cart.filter(item => offer.bogoRewardItems!.includes(item.menuItem.sku))
    const rewardQtyInCart = rewardItems.reduce((sum, item) => sum + item.quantity, 0)
    if (rewardQtyInCart < possibleSets * (offer.getQuantity || 1)) {
      return { eligible: false, reason: `Add ${possibleSets * (offer.getQuantity || 1)} reward item(s) to complete this BOGO` }
    }
  }

  if (buyQtyInCart < buyQty) {
    return { eligible: false, reason: `Need to buy at least ${buyQty} eligible items` }
  }

  if (!offer.bogoRewardItems?.length) {
    const totalQty = buyItems.reduce((sum, item) => sum + item.quantity, 0)
    if (totalQty < buyQty + (offer.getQuantity || 1)) {
      return { eligible: false, reason: `Add ${offer.getQuantity || 1} reward item(s) to complete this BOGO` }
    }
  }

  return { eligible: true }
}
