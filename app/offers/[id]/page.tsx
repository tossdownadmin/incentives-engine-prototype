'use client'

import { use, useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { OfferForm } from '@/components/offers/offer-form'
import { useOffers } from '@/hooks/use-offers'
import { responseList, simulatorApi, type SimulatorApiStatus } from '@/lib/simulator-api'
import type { Offer, OfferType, OfferStatus } from '@/lib/types'

interface EditOfferPageProps {
  params: Promise<{ id: string }>
}

function mapOrdrzDiscount(
  discount: Record<string, any>,
  menu: Record<string, any>[] = [],
  categories: Record<string, any>[] = [],
): Offer {
  const apiType = String(discount.type || 'PERCENTAGE').toUpperCase()
  const type: OfferType = apiType === 'FREE_DELIVERY'
    ? 'free_delivery'
    : apiType === 'FIXED_AMOUNT' || apiType === 'FIXED_PRICE' || apiType === 'REDUCED_DELIVERY' || apiType === 'OPEN_AMOUNT'
    ? 'flat'
    : apiType === 'BUY_X_GET_Y' || apiType === 'FREE_ITEM'
      ? 'bogo'
      : apiType === 'COMBO'
        ? 'bundle'
        : 'percentage'
  const rules = discount.rules && typeof discount.rules === 'object' ? discount.rules : {}
  const createdAt = discount.createdAt || new Date().toISOString()
  const apiStatus: OfferStatus = !discount.isActive
    ? 'paused'
    : discount.endAt && new Date(discount.endAt).getTime() < Date.now()
      ? 'expired'
      : discount.startAt && new Date(discount.startAt).getTime() > Date.now()
        ? 'scheduled'
        : 'active'
  const appMode = discount.applicationModes?.includes('CODE') ? 'code' : discount.applicationModes?.includes('MANUAL') ? 'manual' : 'automatic'
  const skuForItem = (itemId: unknown) => {
    const id = String(itemId ?? '')
    const item = menu.find(candidate => String(candidate.id ?? candidate._id ?? candidate.productId ?? candidate.itemId ?? '') === id)
    return String(item?.sku ?? id).toUpperCase()
  }
  const categoryNameFor = (categoryId: unknown) => {
    const value = categoryId && typeof categoryId === 'object' ? categoryId as Record<string, any> : null
    const id = String(value?.id ?? value?._id ?? value?.categoryId ?? value?.category_id ?? categoryId ?? '')
    const category = categories.find(candidate => String(candidate.id ?? candidate._id ?? candidate.categoryId ?? candidate.category_id ?? '') === id)
    return String(category?.name ?? category?.categoryName ?? category?.title ?? category?.label ?? value?.name ?? value?.categoryName ?? value?.title ?? id)
  }

  return {
    id: String(discount.id),
    name: String(discount.name || ''),
    description: `Ordrz ${apiType} · ${String(discount.scope || 'ITEM').toLowerCase()} discount`,
    type,
    status: apiStatus,
    applicationMode: appMode,
    discountValue: type === 'percentage' ? Number(discount.value || 0) : type === 'free_delivery' ? 0 : Math.round(Number(discount.value || 0) * 100),
    bundleItems: rules.requiredItems?.map((item: any) => String(item.itemId || item.sku || '')).filter(Boolean) || [],
    bundlePrice: rules.bundlePrice == null ? 0 : Math.round(Number(rules.bundlePrice) * 100),
    buyQuantity: Number(rules.buyQuantity || 1),
    getQuantity: Number(rules.getQuantity || 1),
    getItemDiscount: Number(rules.getValue ?? 100),
    bogoRewardMode: rules.getBenefit === 'FIXED_AMOUNT' ? 'fixed_amount' : rules.getBenefit === 'FIXED_PRICE' ? 'fixed_price' : 'percentage',
    bogoRewardValue: Number(rules.getValue ?? 100),
    bogoItems: (rules.buyItemIds || []).map(skuForItem),
    bogoRewardItems: (rules.getItemIds || []).map(skuForItem),
    rules: {
      minSpend: rules.minSubtotal == null ? 0 : Math.round(Number(rules.minSubtotal) * 100),
      maxDiscount: rules.maxDiscount == null ? 0 : Math.round(Number(rules.maxDiscount) * 100),
      includedItems: rules.itemIds || [],
      excludedItems: rules.excludedItemIds || [],
      includedCategories: (rules.categoryIds || []).map(categoryNameFor),
      excludedCategories: (rules.excludedCategoryIds || []).map(categoryNameFor),
      couponCode: rules.couponCode || discount.codes?.find((code: any) => code.isActive !== false)?.code,
    },
    schedule: {
      startDate: discount.startAt || createdAt,
      endDate: discount.endAt || undefined,
      daysOfWeek: rules.schedule?.windows?.flatMap((window: any) => window.days || []) || [],
      timeWindows: rules.schedule?.windows?.map((window: any) => ({ startTime: window.start, endTime: window.end })) || [],
    },
    targeting: { channels: ['all'], locations: rules.locationIds || [] },
    limits: {
      maxRedemptions: discount.maxUses == null ? undefined : Number(discount.maxUses),
      maxPerTransaction: Number(rules.maxApplications || 1),
      currentRedemptions: 0,
    },
    priority: Number(discount.priority ?? 100),
    isStackable: Boolean(discount.isStackable),
    createdAt,
    updatedAt: discount.updatedAt || createdAt,
  }
}

export default function EditOfferPage({ params }: EditOfferPageProps) {
  const { id } = use(params)
  const { getOfferById, isLoaded } = useOffers()
  const localOffer = getOfferById(id)
  const [remoteDiscount, setRemoteDiscount] = useState<Record<string, any> | null>(null)
  const [remoteMenu, setRemoteMenu] = useState<Record<string, any>[]>([])
  const [remoteCategories, setRemoteCategories] = useState<Record<string, any>[]>([])
  const [remoteChecked, setRemoteChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const status = await simulatorApi<SimulatorApiStatus>('status')
        if (!status.discountsConfigured) return
        const [response, menuResponse, couponResponse, categoryResponse] = await Promise.all([
          simulatorApi<any>(`discounts/${encodeURIComponent(id)}`),
          simulatorApi<any>('menu').catch(() => null),
          simulatorApi<any>('coupons').catch(() => null),
          simulatorApi<any>('categories').catch(() => null),
        ])
        const discount = response?.data?.discount ?? response?.data ?? response?.discount ?? response
        if (!cancelled) {
          setRemoteMenu(responseList(menuResponse, ['items', 'products']))
          const categories = responseList(categoryResponse, ['categories'])
          setRemoteCategories(categories.length ? categories : responseList(menuResponse?.categories, ['categories']))
          if (discount && typeof discount === 'object' && discount.id) {
            const codes = responseList(couponResponse, ['coupons']).filter((code: any) => code.discountId === id)
            setRemoteDiscount({ ...discount, codes: discount.codes?.length ? discount.codes : codes })
          }
        }
      } catch {
        // Keep the existing local offer editor as a fallback for local records.
      } finally {
        if (!cancelled) setRemoteChecked(true)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  if (!isLoaded || !remoteChecked) {
    return (
      <AppShell title="Edit Offer">
        <div className="flex h-64 items-center justify-center text-muted-foreground">Loading offer…</div>
      </AppShell>
    )
  }

  if (remoteDiscount) {
    const offer = mapOrdrzDiscount(remoteDiscount, remoteMenu, remoteCategories)
    const saveRemoteOffer = async (updated: Offer) => {
      const itemIdFor = (value: string) => {
        const item = remoteMenu.find((candidate: any) =>
          String(candidate.id ?? candidate._id ?? candidate.productId ?? candidate.itemId ?? '') === value ||
          String(candidate.sku ?? '').toUpperCase() === value.toUpperCase()
        )
        return String(item?.id ?? item?._id ?? item?.productId ?? item?.itemId ?? value)
      }
      const categoryIdFor = (value: string) => {
        const category = remoteCategories.find((candidate: any) =>
          String(candidate.id ?? candidate._id ?? candidate.categoryId ?? candidate.category_id ?? '') === value ||
          String(candidate.name ?? candidate.categoryName ?? candidate.title ?? candidate.label ?? '').trim().toLowerCase() === value.trim().toLowerCase()
        )
        const id = category?.id ?? category?._id ?? category?.categoryId ?? category?.category_id
        if (id) return String(id)
        if ((remoteDiscount.rules?.categoryIds || []).map(String).includes(value)) return value
        throw new Error(`Could not find the Ordrz category ID for “${value}”. Refresh categories and try again.`)
      }
      const rules = { ...(remoteDiscount.rules || {}) }
      if (updated.rules.minSpend) rules.minSubtotal = updated.rules.minSpend / 100
      else delete rules.minSubtotal
      if (updated.rules.maxDiscount) rules.maxDiscount = updated.rules.maxDiscount / 100
      else delete rules.maxDiscount
      delete rules.couponCode
      if (updated.rules.includedItems?.length) rules.itemIds = updated.rules.includedItems.map(itemIdFor)
      else delete rules.itemIds
      if (updated.rules.excludedItems?.length) rules.excludedItemIds = updated.rules.excludedItems.map(itemIdFor)
      else delete rules.excludedItemIds
      if (updated.rules.includedCategories?.length) rules.categoryIds = updated.rules.includedCategories.map(categoryIdFor)
      else delete rules.categoryIds
      if (updated.rules.excludedCategories?.length) rules.excludedCategoryIds = updated.rules.excludedCategories.map(categoryIdFor)
      else delete rules.excludedCategoryIds
      if (updated.type === 'bogo') {
        rules.buyQuantity = updated.buyQuantity
        rules.getQuantity = updated.getQuantity
        rules.getBenefit = updated.bogoRewardMode === 'fixed_amount' ? 'FIXED_AMOUNT' : updated.bogoRewardMode === 'fixed_price' ? 'FIXED_PRICE' : 'PERCENTAGE'
        rules.getValue = updated.bogoRewardMode === 'percentage' ? updated.getItemDiscount : (updated.bogoRewardValue || 0) / 100
        if (updated.bogoItems?.length) rules.buyItemIds = updated.bogoItems.map(itemIdFor)
        if (updated.bogoRewardItems?.length) rules.getItemIds = updated.bogoRewardItems.map(itemIdFor)
      }
      if (updated.type === 'bundle') {
        rules.bundlePrice = (updated.bundlePrice || 0) / 100
        rules.requiredItems = (updated.bundleItems || []).map(itemId => ({ itemId: itemIdFor(itemId), quantity: 1 }))
      }
      rules.schedule = updated.schedule.timeWindows?.length ? {
        timezone: rules.schedule?.timezone || 'Asia/Karachi',
        windows: (updated.schedule.timeWindows || []).map(window => ({ days: updated.schedule.daysOfWeek?.length ? updated.schedule.daysOfWeek : [0, 1, 2, 3, 4, 5, 6], start: window.startTime, end: window.endTime })),
      } : undefined

      const originalType = String(remoteDiscount.type || '').toUpperCase()
      const initialMappedType = mapOrdrzDiscount(remoteDiscount, remoteMenu, remoteCategories).type
      const requestedApiType = updated.type === initialMappedType ? originalType : ({ percentage: 'PERCENTAGE', flat: 'FIXED_AMOUNT', bundle: 'COMBO', bogo: 'BUY_X_GET_Y', free_delivery: 'FREE_DELIVERY' } as const)[updated.type]
      const value = updated.type === 'percentage' ? updated.discountValue : updated.type === 'flat' ? updated.discountValue / 100 : null
      await simulatorApi(`discounts/${encodeURIComponent(id)}`, 'PATCH', {
        name: updated.name,
        type: requestedApiType,
        scope: updated.type === 'free_delivery'
          ? 'DELIVERY'
          : updated.type === 'bogo' || updated.type === 'bundle' || rules.itemIds?.length || rules.categoryIds?.length
            ? 'ITEM'
            : 'ORDER',
        value: requestedApiType === originalType && !['PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_PRICE', 'OPEN_AMOUNT'].includes(originalType) ? remoteDiscount.value : value,
        applicationModes: updated.applicationMode ? [updated.applicationMode.toUpperCase()] : remoteDiscount.applicationModes,
        isActive: updated.status === 'active' || updated.status === 'scheduled',
        isStackable: updated.isStackable ?? remoteDiscount.isStackable ?? false,
        priority: updated.priority,
        startAt: updated.schedule.startDate,
        endAt: updated.schedule.endDate || null,
        maxUses: updated.limits.maxRedemptions ?? null,
        usesPerCustomer: remoteDiscount.usesPerCustomer ?? null,
        taxTreatment: remoteDiscount.taxTreatment ?? null,
        rules,
      })

      const existingCodes = Array.isArray(remoteDiscount.codes) ? remoteDiscount.codes : []
      const currentCode = existingCodes.find((code: any) => code.isActive !== false)
      if (updated.applicationMode === 'code' && updated.rules.couponCode?.trim()) {
        const code = updated.rules.couponCode.trim().toUpperCase()
        if (currentCode?.id) {
          await simulatorApi(`coupons/${encodeURIComponent(id)}/${encodeURIComponent(currentCode.id)}`, 'PATCH', { code, isActive: true })
        } else {
          await simulatorApi('coupons', 'POST', { discountId: id, code, isActive: true })
        }
      } else if (currentCode?.id) {
        await simulatorApi(`coupons/${encodeURIComponent(id)}/${encodeURIComponent(currentCode.id)}`, 'PATCH', { isActive: false })
      }
    }

    const categoryOptions = remoteCategories
      .map(category => String(category.name ?? category.categoryName ?? category.title ?? category.label ?? ''))
      .filter(Boolean)
    return <AppShell title="Edit Offer" description={`Editing: ${offer.name}`}><OfferForm offer={offer} mode="edit" onSave={saveRemoteOffer} categoryOptions={categoryOptions} /></AppShell>
  }

  if (!localOffer) notFound()
  return <AppShell title="Edit Offer" description={`Editing: ${localOffer.name}`}><OfferForm offer={localOffer} mode="edit" /></AppShell>
}
