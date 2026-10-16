// =====================================
// Sample Data for First-Time Initialization
// =====================================

import type { MenuItem, Location, Offer, SystemSettings } from './types'
import { DEFAULT_SETTINGS } from './constants'
import { IMPORTED_MENU_ITEMS } from './imported-menu.ts'

// Imported restaurant menu (prices in cents). The old demo burger/pizza catalog
// is intentionally not included in the local workspace.
export const SAMPLE_MENU_ITEMS: MenuItem[] = [
  ...IMPORTED_MENU_ITEMS.map(item => ({ ...item, available: true })),
]

// Sample Locations
export const SAMPLE_LOCATIONS: Location[] = [
  { id: 'loc-downtown', name: 'Downtown Main', address: '123 Main Street', active: true },
  { id: 'loc-westside', name: 'Westside Mall', address: '456 Shopping Center Blvd', active: true },
  { id: 'loc-airport', name: 'Airport Terminal', address: 'Terminal 2, Gate B', active: true },
]

// Offers are intentionally empty on first load. Promotions only appear after
// the user creates or imports them.
export const SAMPLE_OFFERS: Offer[] = []

// Default Settings
export const SAMPLE_SETTINGS: SystemSettings = {
  ...DEFAULT_SETTINGS
}
