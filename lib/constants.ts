// =====================================
// Constants for the Incentives Engine
// =====================================

import type { OfferType, OfferStatus, Channel } from './types'
import { IMPORTED_MENU_ITEMS } from './imported-menu.ts'

// Offer Type Labels and Icons
export const OFFER_TYPE_CONFIG: Record<OfferType, { label: string; description: string; icon: string }> = {
  percentage: {
    label: 'Percentage Off',
    description: 'Discount a percentage of the cart total or specific items',
    icon: 'Percent'
  },
  flat: {
    label: 'Flat Discount',
    description: 'Subtract a fixed dollar amount from the cart',
    icon: 'DollarSign'
  },
  bundle: {
    label: 'Bundle Deal',
    description: 'Offer multiple items together at a fixed price',
    icon: 'Package'
  },
  bogo: {
    label: 'Buy X Get Y',
    description: 'Buy a quantity and get additional items free or discounted',
    icon: 'Gift'
  },
  free_delivery: {
    label: 'Free Shipping',
    description: 'Waive the delivery fee on eligible delivery orders',
    icon: 'Truck'
  }
}

// Status Config
export const STATUS_CONFIG: Record<OfferStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800' },
  paused: { label: 'Paused', color: 'bg-red-100 text-red-800' },
  scheduled: { label: 'Scheduled', color: 'bg-amber-100 text-amber-800' },
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-500' }
}

// Channel Labels
export const CHANNEL_CONFIG: Record<Channel, { label: string; description: string; icon: string }> = {
  web: { label: 'Web', description: 'Online ordering website', icon: 'Globe' },
  qr: { label: 'QR Code', description: 'Table-side QR ordering', icon: 'QrCode' },
  kiosk: { label: 'Kiosk', description: 'Self-service kiosks', icon: 'Monitor' },
  all: { label: 'All Channels', description: 'Available everywhere', icon: 'Layers' }
}

// Days of Week
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun', fullLabel: 'Sunday' },
  { value: 1, label: 'Mon', fullLabel: 'Monday' },
  { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, label: 'Fri', fullLabel: 'Friday' },
  { value: 6, label: 'Sat', fullLabel: 'Saturday' }
]

// Default Settings
export const DEFAULT_SETTINGS = {
  defaultMaxDiscount: 5000,       // $50.00
  defaultMaxRedemptions: 1000,
  roundingMode: 'nearest' as const,
  currency: 'USD',
  currencySymbol: '$'
}

// Local Storage Keys
export const STORAGE_KEYS = {
  OFFERS: 'incentives_engine_offers',
  MENU_ITEMS: 'incentives_engine_menu_items',
  LOCATIONS: 'incentives_engine_locations',
  CART: 'incentives_engine_cart',
  SETTINGS: 'incentives_engine_settings',
  ACTIVITY_LOG: 'incentives_engine_activity',
  INITIALIZED: 'incentives_engine_initialized'
}

// Menu categories from the supplied restaurant catalog.
export const MENU_CATEGORIES = Array.from(
  new Set(IMPORTED_MENU_ITEMS.map(item => item.category))
).sort()
