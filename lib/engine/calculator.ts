// =====================================
// Discount Calculator
// All calculations in cents (integers)
// =====================================

import type { Offer, CartItem, MenuItem } from '@/lib/types'

export interface CalculationResult {
  discount: number          // Total discount in cents
  affectedItems: {
    itemId: string
    sku: string
    name: string
    originalPrice: number   // In cents
    discountedPrice: number // In cents
    savings: number         // In cents
    quantity: number
  }[]
}

/**
 * Calculate discount for an offer on a cart
 */
export function calculateDiscount(
  offer: Offer,
  cart: CartItem[],
  menuItems: MenuItem[]
): CalculationResult {
  switch (offer.type) {
    case 'percentage':
      return calculatePercentage(offer, cart)
    case 'flat':
      return calculateFlat(offer, cart)
    case 'bundle':
      return calculateBundle(offer, cart, menuItems)
    case 'bogo':
      return calculateBogo(offer, cart, menuItems)
    case 'free_delivery':
      // Delivery fees are not part of the menu cart, so the offer is represented
      // in the Ordrz delivery scope and calculated by the checkout simulator.
      return { discount: 0, affectedItems: [] }
    default:
      return { discount: 0, affectedItems: [] }
  }
}

/**
 * Calculate percentage discount
 */
function calculatePercentage(offer: Offer, cart: CartItem[]): CalculationResult {
  const subtotal = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0)
  const percentage = offer.discountValue
  
  // Apply only to the selected items/categories when restrictions are specified.
  const includedItems = offer.rules.includedItems || []
  const includedCategories = offer.rules.includedCategories || []
  const hasItemRestriction = includedItems.length > 0
  const hasCategoryRestriction = includedCategories.length > 0
  const isEligible = (item: CartItem) =>
    (!hasItemRestriction || includedItems.includes(item.menuItem.sku)) &&
    (!hasCategoryRestriction || includedCategories.includes(item.menuItem.category))
  let eligibleTotal = 0
  let affectedItems: CalculationResult['affectedItems'] = []

  cart.forEach(item => {
    if (isEligible(item)) {
      const lineTotal = item.menuItem.price * item.quantity
      eligibleTotal += lineTotal
      const itemDiscount = roundToNearestCent(lineTotal * (percentage / 100))
      affectedItems.push({
        itemId: item.menuItem.id,
        sku: item.menuItem.sku,
        name: item.menuItem.name,
        originalPrice: lineTotal,
        discountedPrice: lineTotal - itemDiscount,
        savings: itemDiscount,
        quantity: item.quantity
      })
    }
  })

  let discount = roundToNearestCent(eligibleTotal * (percentage / 100))

  // Apply max discount cap
  if (offer.rules.maxDiscount !== undefined) {
    discount = Math.min(discount, offer.rules.maxDiscount)
  }

  // Never discount more than the subtotal
  discount = Math.min(discount, subtotal)

  return { discount, affectedItems }
}

/**
 * Calculate flat discount
 */
function calculateFlat(offer: Offer, cart: CartItem[]): CalculationResult {
  const includedItems = offer.rules.includedItems || []
  const includedCategories = offer.rules.includedCategories || []
  const eligible = cart.filter(item =>
    (!includedItems.length || includedItems.includes(item.menuItem.sku)) &&
    (!includedCategories.length || includedCategories.includes(item.menuItem.category))
  )
  const eligibleTotal = eligible.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0)
  const discount = Math.min(Math.max(0, offer.discountValue), eligibleTotal)
  let allocated = 0
  const affectedItems = eligible.map((item, index) => {
    const originalPrice = item.menuItem.price * item.quantity
    const savings = index === eligible.length - 1
      ? discount - allocated
      : eligibleTotal > 0 ? Math.floor(discount * originalPrice / eligibleTotal) : 0
    allocated += savings
    return {
      itemId: item.menuItem.id,
      sku: item.menuItem.sku,
      name: item.menuItem.name,
      originalPrice,
      discountedPrice: originalPrice - savings,
      savings,
      quantity: item.quantity,
    }
  })

  return { discount, affectedItems }
}

/**
 * Calculate bundle discount
 * Bundle price replaces the sum of individual item prices
 */
function calculateBundle(
  offer: Offer,
  cart: CartItem[],
  menuItems: MenuItem[]
): CalculationResult {
  if (!offer.bundleItems || !offer.bundlePrice) {
    return { discount: 0, affectedItems: [] }
  }

  // Calculate the original price of bundle items
  const bundleSkuCount = new Map<string, number>()
  offer.bundleItems.forEach(sku => {
    bundleSkuCount.set(sku, (bundleSkuCount.get(sku) || 0) + 1)
  })

  let originalBundleTotal = 0
  const affectedItems: CalculationResult['affectedItems'] = []

  for (const [sku, qty] of bundleSkuCount) {
    const menuItem = menuItems.find(m => m.sku === sku)
    if (menuItem) {
      const itemTotal = menuItem.price * qty
      originalBundleTotal += itemTotal
      affectedItems.push({
        itemId: menuItem.id,
        sku: menuItem.sku,
        name: menuItem.name,
        originalPrice: itemTotal,
        discountedPrice: 0, // Will be calculated proportionally
        savings: 0,
        quantity: qty
      })
    }
  }

  const discount = Math.max(0, originalBundleTotal - offer.bundlePrice)

  // Distribute savings proportionally
  if (discount > 0 && originalBundleTotal > 0) {
    const savingsRatio = discount / originalBundleTotal
    affectedItems.forEach(item => {
      item.savings = roundToNearestCent(item.originalPrice * savingsRatio)
      item.discountedPrice = item.originalPrice - item.savings
    })
  }

  return { discount, affectedItems }
}

/**
 * Calculate BOGO discount
 * Buy X items, get Y items at a discount
 */
function calculateBogo(
  offer: Offer,
  cart: CartItem[],
  menuItems: MenuItem[]
): CalculationResult {
  const buyQty = offer.buyQuantity || 0
  const getQty = offer.getQuantity || 0
  const getDiscount = offer.getItemDiscount || 100 // Default to 100% (free)

  if (buyQty <= 0 || getQty <= 0) {
    return { discount: 0, affectedItems: [] }
  }

  // Buy items trigger the promotion. Reward items are selected separately when configured.
  const buyItems = offer.bogoItems && offer.bogoItems.length > 0
    ? cart.filter(item => offer.bogoItems!.includes(item.menuItem.sku))
    : cart

  const rewardItems = offer.bogoRewardItems && offer.bogoRewardItems.length > 0
    ? cart.filter(item => offer.bogoRewardItems!.includes(item.menuItem.sku))
    : buyItems

  const buyUnits: { menuItem: MenuItem; price: number }[] = []
  buyItems.forEach(item => {
    for (let i = 0; i < item.quantity; i++) {
      buyUnits.push({ menuItem: item.menuItem, price: item.menuItem.price })
    }
  })

  const rewardUnits: { menuItem: MenuItem; price: number }[] = []
  rewardItems.forEach(item => {
    for (let i = 0; i < item.quantity; i++) {
      rewardUnits.push({ menuItem: item.menuItem, price: item.menuItem.price })
    }
  })
  rewardUnits.sort((a, b) => a.price - b.price)

  // Calculate how many "sets" of Buy X Get Y we can apply
  const buySets = Math.floor(buyUnits.length / buyQty)
  const rewardSets = Math.floor(rewardUnits.length / getQty)
  const sets = Math.min(buySets, rewardSets)
  
  if (sets === 0) {
    return { discount: 0, affectedItems: [] }
  }

  // Apply limit per transaction
  const maxSets = offer.limits.maxPerTransaction || Infinity
  const appliedSets = Math.min(sets, maxSets)

  // Calculate discount: cheapest getQty items per set get discounted
  let totalDiscount = 0
  const affectedItems: CalculationResult['affectedItems'] = []

  for (let set = 0; set < appliedSets; set++) {
    const startIdx = set * getQty
    // The cheapest reward items in each set receive the configured discount.
    for (let i = 0; i < getQty; i++) {
      const item = rewardUnits[startIdx + i]
      const itemDiscount = roundToNearestCent(item.price * (getDiscount / 100))
      totalDiscount += itemDiscount

      // Track affected items (simplified - one entry per discounted item)
      affectedItems.push({
        itemId: item.menuItem.id,
        sku: item.menuItem.sku,
        name: item.menuItem.name,
        originalPrice: item.price,
        discountedPrice: item.price - itemDiscount,
        savings: itemDiscount,
        quantity: 1
      })
    }
  }

  return { discount: totalDiscount, affectedItems }
}

/**
 * Round to nearest cent (standard rounding)
 */
export function roundToNearestCent(amount: number): number {
  return Math.round(amount)
}

/**
 * Format cents to dollars string
 */
export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
