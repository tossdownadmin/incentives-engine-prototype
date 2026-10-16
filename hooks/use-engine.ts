'use client'

import { useMemo } from 'react'
import type { CartItem, Offer, EvaluationContext, MenuItem } from '@/lib/types'
import { processCart, createDefaultContext } from '@/lib/engine'

interface UseEngineProps {
  cart: CartItem[]
  offers: Offer[]
  menuItems: MenuItem[]
  context?: Partial<EvaluationContext>
}

export function useEngine({ cart, offers, menuItems, context }: UseEngineProps) {
  const evaluationContext = useMemo(() => {
    return {
      ...createDefaultContext(),
      ...context
    }
  }, [context])

  const result = useMemo(() => {
    return processCart(cart, offers, evaluationContext, menuItems)
  }, [cart, offers, evaluationContext, menuItems])

  return {
    ...result,
    context: evaluationContext
  }
}
