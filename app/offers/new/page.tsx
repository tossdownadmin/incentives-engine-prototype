'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { OfferForm } from '@/components/offers/offer-form'
import { responseList, simulatorApi, type SimulatorApiStatus } from '@/lib/simulator-api'
import type { Offer } from '@/lib/types'

export default function NewOfferPage() {
  const [apiStatus, setApiStatus] = useState<SimulatorApiStatus | null>(null)
  const [statusChecked, setStatusChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    simulatorApi<SimulatorApiStatus>('status')
      .then(status => { if (!cancelled) setApiStatus(status) })
      .catch(() => { if (!cancelled) setApiStatus(null) })
      .finally(() => { if (!cancelled) setStatusChecked(true) })
    return () => { cancelled = true }
  }, [])

  const createRemoteOffer = async (offer: Offer) => {
    const [menuResponse, categoryResponse] = await Promise.all([
      simulatorApi<any>('menu'),
      offer.rules.includedCategories?.length ? simulatorApi<any>('categories').catch(() => null) : Promise.resolve(null),
    ])
    const menu = responseList(menuResponse, ['items', 'products'])
    const categories = responseList(categoryResponse, ['categories']).length
      ? responseList(categoryResponse, ['categories'])
      : responseList(menuResponse?.categories, ['categories'])
    const itemIdFor = (value: string) => {
      const item = menu.find((candidate: any) =>
        String(candidate.id ?? candidate._id ?? candidate.productId ?? candidate.itemId ?? '') === value ||
        String(candidate.sku ?? candidate.productCode ?? '').toUpperCase() === value.toUpperCase()
      )
      return String(item?.id ?? item?._id ?? item?.productId ?? item?.itemId ?? value)
    }
    const categoryIdFor = (value: string) => {
      const category = categories.find((candidate: any) =>
        String(candidate.id ?? candidate._id ?? candidate.categoryId ?? candidate.category_id ?? '') === value ||
        String(candidate.name ?? candidate.categoryName ?? candidate.title ?? candidate.label ?? '').trim().toLowerCase() === value.trim().toLowerCase()
      )
      const id = category?.id ?? category?._id ?? category?.categoryId ?? category?.category_id
      if (!id) throw new Error(`Could not find the Ordrz category ID for “${value}”. Refresh categories and try again.`)
      return String(id)
    }

    const type = ({ percentage: 'PERCENTAGE', flat: 'FIXED_AMOUNT', bundle: 'COMBO', bogo: 'BUY_X_GET_Y', free_delivery: 'FREE_DELIVERY' } as const)[offer.type]
    const rules: Record<string, any> = {}
    if (offer.rules.minSpend) rules.minSubtotal = offer.rules.minSpend / 100
    if (offer.rules.maxDiscount) rules.maxDiscount = offer.rules.maxDiscount / 100
    if (offer.rules.includedItems?.length) rules.itemIds = offer.rules.includedItems.map(itemIdFor)
    if (offer.rules.excludedItems?.length) rules.excludedItemIds = offer.rules.excludedItems.map(itemIdFor)
    if (offer.rules.includedCategories?.length) rules.categoryIds = offer.rules.includedCategories.map(categoryIdFor)
    if (offer.targeting.locations.length) rules.locationIds = offer.targeting.locations

    if (offer.type === 'bogo') {
      rules.buyQuantity = offer.buyQuantity || 1
      rules.getQuantity = offer.getQuantity || 1
      rules.buyItemIds = (offer.bogoItems || []).map(itemIdFor)
      rules.getItemIds = (offer.bogoRewardItems || []).map(itemIdFor)
      rules.getBenefit = offer.bogoRewardMode === 'fixed_amount'
        ? 'FIXED_AMOUNT'
        : offer.bogoRewardMode === 'fixed_price' ? 'FIXED_PRICE' : 'PERCENTAGE'
      rules.getValue = offer.bogoRewardMode === 'percentage'
        ? (offer.getItemDiscount ?? 100)
        : (offer.bogoRewardValue || 0) / 100
      rules.maxApplications = offer.limits.maxPerTransaction || 1
    }

    if (offer.type === 'bundle') {
      rules.bundlePrice = (offer.bundlePrice || 0) / 100
      rules.requiredItems = (offer.bundleItems || []).map(itemId => ({ itemId: itemIdFor(itemId), quantity: 1 }))
      rules.maxApplications = offer.limits.maxPerTransaction || 1
    }

    if (offer.schedule.timeWindows?.length) {
      rules.schedule = {
        timezone: 'Asia/Karachi',
        windows: offer.schedule.timeWindows.map(window => ({
          days: offer.schedule.daysOfWeek?.length ? offer.schedule.daysOfWeek : [0, 1, 2, 3, 4, 5, 6],
          start: window.startTime,
          end: window.endTime,
        })),
      }
    }

    const response = await simulatorApi<any>('discounts', 'POST', {
      name: offer.name,
      type,
      scope: offer.type === 'free_delivery'
        ? 'DELIVERY'
        : offer.type === 'bogo' || offer.type === 'bundle' || rules.itemIds?.length || rules.categoryIds?.length
          ? 'ITEM'
          : 'ORDER',
      value: offer.type === 'percentage' ? offer.discountValue : offer.type === 'flat' ? offer.discountValue / 100 : null,
      applicationModes: [String(offer.applicationMode || 'automatic').toUpperCase()],
      isActive: offer.status === 'active' || offer.status === 'scheduled',
      isStackable: offer.isStackable ?? false,
      priority: offer.priority,
      startAt: offer.schedule.startDate,
      endAt: offer.schedule.endDate || null,
      maxUses: offer.limits.maxRedemptions ?? null,
      usesPerCustomer: null,
      taxTreatment: null,
      rules,
    })
    if (offer.applicationMode === 'code') {
      const createdDiscount = response?.data?.discount ?? response?.discount ?? response?.data ?? response
      const discountId = String(createdDiscount?.id ?? '')
      if (!discountId) return 'Discount created, but Ordrz did not return its ID, so the coupon code could not be linked.'
      try {
        await simulatorApi('coupons', 'POST', {
          discountId,
          code: offer.rules.couponCode?.trim().toUpperCase(),
          isActive: true,
        })
      } catch (error) {
        return `Discount created, but its coupon code could not be saved: ${error instanceof Error ? error.message : 'unknown API error'}`
      }
    }
  }

  if (!statusChecked) {
    return (
      <AppShell title="Create New Offer" description="Connecting to Ordrz…">
        <div className="flex h-64 items-center justify-center text-muted-foreground">Checking offer API…</div>
      </AppShell>
    )
  }

  const isOrdrzConnected = Boolean(apiStatus?.discountsConfigured)
  return (
    <AppShell
      title="Create New Offer"
      description={isOrdrzConnected ? 'Configure a promotion that will be saved to Ordrz.' : 'Configure a new offer for this browser.'}
    >
      {!isOrdrzConnected && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Ordrz discount API is unavailable. Offers will be saved locally.
        </p>
      )}
      <OfferForm mode="create" onSave={isOrdrzConnected ? createRemoteOffer : undefined} />
    </AppShell>
  )
}
