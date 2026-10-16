'use client'

import { useCallback, useMemo } from 'react'
import { useLocalStorage } from './use-local-storage'
import type { CartItem, MenuItem } from '@/lib/types'
import { STORAGE_KEYS } from '@/lib/constants'

export function useCart() {
  const [cart, setCart, isLoaded] = useLocalStorage<CartItem[]>(STORAGE_KEYS.CART, [])

  const addToCart = useCallback((menuItem: MenuItem, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.menuItem.id === menuItem.id)
      if (existing) {
        return prev.map(item => 
          item.menuItem.id === menuItem.id 
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [...prev, { menuItem, quantity }]
    })
  }, [setCart])

  const removeFromCart = useCallback((menuItemId: string) => {
    setCart(prev => prev.filter(item => item.menuItem.id !== menuItemId))
  }, [setCart])

  const updateQuantity = useCallback((menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(menuItemId)
      return
    }
    setCart(prev => prev.map(item => 
      item.menuItem.id === menuItemId 
        ? { ...item, quantity }
        : item
    ))
  }, [setCart, removeFromCart])

  const clearCart = useCallback(() => {
    setCart([])
  }, [setCart])

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0)
  }, [cart])

  const itemCount = useMemo(() => {
    return cart.reduce((count, item) => count + item.quantity, 0)
  }, [cart])

  return {
    cart,
    isLoaded,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    subtotal,
    itemCount,
    setCart
  }
}
