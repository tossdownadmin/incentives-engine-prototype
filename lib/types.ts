// =====================================
// Restaurant Incentives Engine Types
// =====================================

// Offer Types
export type OfferType = 'percentage' | 'flat' | 'bundle' | 'bogo' | 'free_delivery'

// Offer Status
export type OfferStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'expired'
export type OfferApplicationMode = 'automatic' | 'code' | 'manual'

// Channel Types
export type Channel = 'web' | 'qr' | 'kiosk' | 'all'

// Time Window for scheduling
export interface TimeWindow {
  startTime: string  // "14:00" format
  endTime: string    // "17:00" format
}

// Offer Rules/Conditions
export interface OfferRules {
  minSpend?: number            // Minimum cart total in cents
  maxDiscount?: number         // Maximum discount cap in cents
  includedItems?: string[]     // SKU whitelist
  excludedItems?: string[]     // SKU blacklist
  includedCategories?: string[]
  excludedCategories?: string[]
  couponCode?: string
}

// Offer Schedule
export interface OfferSchedule {
  startDate: string           // ISO date string
  endDate?: string            // ISO date string (optional for ongoing)
  timeWindows?: TimeWindow[]  // Daily time windows
  daysOfWeek?: number[]       // 0-6 (Sun-Sat)
}

// Offer Targeting
export interface OfferTargeting {
  channels: Channel[]
  locations: string[]         // Location IDs
}

// Offer Limits
export interface OfferLimits {
  maxRedemptions?: number     // Total cap (undefined = unlimited)
  maxPerTransaction?: number  // Per-order cap
  currentRedemptions: number  // Tracking count
}

// Main Offer Interface
export interface Offer {
  id: string
  name: string
  description: string
  type: OfferType
  status: OfferStatus
  applicationMode?: OfferApplicationMode
  
  // Discount Configuration
  discountValue: number       // Percentage (0-100) or flat amount in cents
  
  // Bundle specific
  bundleItems?: string[]      // SKUs that make up the bundle
  bundlePrice?: number        // Fixed bundle price in cents
  
  // BOGO specific
  buyQuantity?: number        // Buy X
  getQuantity?: number        // Get Y
  getItemDiscount?: number    // Discount on Y (0-100%)
  bogoRewardMode?: 'percentage' | 'fixed_amount' | 'fixed_price'
  bogoRewardValue?: number    // Cents for fixed modes; percentage for percentage mode
  bogoItems?: string[]        // SKUs that qualify as the buy item (empty = any item)
  bogoRewardItems?: string[]  // SKUs that can be selected as the get/reward item (empty = any item)
  
  // Rules
  rules: OfferRules
  
  // Scheduling
  schedule: OfferSchedule
  
  // Targeting
  targeting: OfferTargeting
  
  // Safety Limits
  limits: OfferLimits
  
  // Priority for "best offer" selection (higher = more priority)
  priority: number
  // Whether this promotion can combine with other eligible discounts
  isStackable?: boolean
  
  // Metadata
  createdAt: string
  updatedAt: string
}

// Menu Item
export interface MenuItem {
  id: string
  sku: string
  name: string
  category: string
  price: number       // Price in cents
  available: boolean
  image?: string
}

// Cart Item
export interface CartItem {
  menuItem: MenuItem
  quantity: number
}

// Location
export interface Location {
  id: string
  name: string
  address?: string
  active: boolean
}

// Evaluation Context (for targeting/rules)
export interface EvaluationContext {
  channel: Channel
  locationId: string
  currentTime: Date
}

// Evaluated Offer Result
export interface EvaluatedOffer {
  offer: Offer
  eligible: boolean
  reason?: string
  discount: number        // Discount in cents
  affectedItems?: {
    itemId: string
    originalPrice: number
    discountedPrice: number
    savings: number
  }[]
}

// Engine Result
export interface EngineResult {
  subtotal: number
  eligibleOffers: EvaluatedOffer[]
  bestOffer: EvaluatedOffer | null
  discount: number
  finalTotal: number
  breakdown: PriceBreakdown
}

// Price Breakdown for display
export interface PriceBreakdown {
  items: {
    name: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }[]
  subtotal: number
  discountName?: string
  discountType?: OfferType
  discountAmount: number
  finalTotal: number
}

// System Settings
export interface SystemSettings {
  defaultMaxDiscount: number      // Default cap in cents
  defaultMaxRedemptions: number
  roundingMode: 'nearest' | 'floor' | 'ceil'
  currency: string
  currencySymbol: string
}

// Activity Log Entry
export interface ActivityLogEntry {
  id: string
  type: 'offer_created' | 'offer_updated' | 'offer_activated' | 'offer_paused' | 'offer_redeemed' | 'settings_changed'
  offerId?: string
  offerName?: string
  description: string
  timestamp: string
}

// Form Data for Create/Edit Offer
export interface OfferFormData {
  name: string
  description: string
  type: OfferType
  discountValue: number
  bundleItems: string[]
  bundlePrice: number
  buyQuantity: number
  getQuantity: number
  getItemDiscount: number
  bogoRewardMode?: 'percentage' | 'fixed_amount' | 'fixed_price'
  bogoRewardValue?: number
  bogoItems: string[]
  bogoRewardItems: string[]
  rules: OfferRules
  schedule: OfferSchedule
  targeting: OfferTargeting
  limits: {
    maxRedemptions?: number
    maxPerTransaction?: number
  }
  priority: number
}
