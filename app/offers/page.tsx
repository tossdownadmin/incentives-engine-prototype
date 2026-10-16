'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/offers/status-badge'
import { OfferTypeIcon } from '@/components/offers/offer-type-icon'
import { OfferJsonDialog } from '@/components/offers/offer-json-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useOffers } from '@/hooks/use-offers'
import { responseList, simulatorApi, type SimulatorApiStatus } from '@/lib/simulator-api'
import { formatCurrency } from '@/lib/engine'
import { OFFER_TYPE_CONFIG, STATUS_CONFIG } from '@/lib/constants'
import type { Offer, OfferStatus, OfferType } from '@/lib/types'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Copy,
  Pause,
  Play,
  Trash2,
  Tag,
  Braces,
} from 'lucide-react'

type OrdrzOffer = Offer & { ordrzType: string; ordrzRecord: Record<string, unknown> }

function mapOrdrzDiscount(discount: any, index: number): OrdrzOffer {
  const apiType = String(discount.type || 'PERCENTAGE').toUpperCase()
  const type: OfferType = apiType === 'FREE_DELIVERY'
    ? 'free_delivery'
    : apiType === 'FIXED_AMOUNT' || apiType === 'FIXED_PRICE'
    ? 'flat'
    : apiType === 'BUY_X_GET_Y' || apiType === 'FREE_ITEM'
      ? 'bogo'
      : apiType === 'COMBO'
        ? 'bundle'
        : 'percentage'
  const rules = discount.rules && typeof discount.rules === 'object' ? discount.rules : {}
  const createdAt = discount.createdAt || new Date().toISOString()
  const startAt = discount.startAt || createdAt
  const amount = Number(discount.value || 0)
  const toCents = (value: unknown) => Math.round(Number(value || 0) * 100)
  const status: OfferStatus = !discount.isActive
    ? 'paused'
    : discount.endAt && new Date(discount.endAt).getTime() < Date.now()
      ? 'expired'
      : discount.startAt && new Date(discount.startAt).getTime() > Date.now()
        ? 'scheduled'
        : 'active'

  return {
    id: String(discount.id || `ordrz-discount-${index}`),
    name: String(discount.name || 'Unnamed Ordrz discount'),
    description: `Ordrz ${apiType} · ${String(discount.scope || 'ITEM').toLowerCase()} discount`,
    type,
    status,
    applicationMode: discount.applicationModes?.includes('CODE') ? 'code' : discount.applicationModes?.includes('MANUAL') ? 'manual' : 'automatic',
    discountValue: type === 'percentage' ? amount : type === 'free_delivery' ? 0 : toCents(amount),
    bundleItems: rules.requiredItems?.map((item: any) => String(item.itemId || item.sku || '')).filter(Boolean),
    bundlePrice: rules.bundlePrice == null ? undefined : toCents(rules.bundlePrice),
    buyQuantity: Number(rules.buyQuantity || 1),
    getQuantity: Number(rules.getQuantity || 1),
    getItemDiscount: Number(rules.getValue ?? 100),
    bogoRewardMode: rules.getBenefit === 'FIXED_AMOUNT' ? 'fixed_amount' : rules.getBenefit === 'FIXED_PRICE' ? 'fixed_price' : 'percentage',
    bogoRewardValue: Number(rules.getValue ?? 100),
    bogoItems: rules.buyItemIds || [],
    bogoRewardItems: rules.getItemIds || [],
    rules: {
      minSpend: rules.minSubtotal == null ? undefined : toCents(rules.minSubtotal),
      maxDiscount: rules.maxDiscount == null ? undefined : toCents(rules.maxDiscount),
      includedItems: rules.itemIds || [],
      excludedItems: rules.excludedItemIds || [],
      includedCategories: rules.categoryIds || [],
      excludedCategories: rules.excludedCategoryIds || [],
      couponCode: rules.couponCode || discount.codes?.find((code: any) => code.isActive !== false)?.code,
    },
    schedule: {
      startDate: startAt,
      endDate: discount.endAt || undefined,
      daysOfWeek: rules.schedule?.windows?.flatMap((window: any) => window.days || []),
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
    ordrzType: apiType,
    ordrzRecord: discount,
  }
}

export default function OffersPage() {
  const { offers: localOffers, isLoaded: localLoaded, deleteOffer, duplicateOffer, toggleStatus } = useOffers()
  const [apiStatus, setApiStatus] = useState<SimulatorApiStatus | null>(null)
  const [apiOffers, setApiOffers] = useState<OrdrzOffer[]>([])
  const [apiLoaded, setApiLoaded] = useState(false)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const refreshApiOffers = useCallback(async () => {
    setApiLoading(true)
    try {
      const status = await simulatorApi<SimulatorApiStatus>('status')
      setApiStatus(status)
      if (!status.discountsConfigured) {
        setApiOffers([])
        return
      }
      const response = await simulatorApi<any>('discounts')
      setApiOffers(responseList(response, ['discounts']).map(mapOrdrzDiscount))
      setApiError('')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not fetch Ordrz discounts')
    } finally {
      setApiLoaded(true)
      setApiLoading(false)
    }
  }, [])
  useEffect(() => { void refreshApiOffers() }, [refreshApiOffers])
  const isOrdrzMode = Boolean(apiStatus?.discountsConfigured)
  const offers = isOrdrzMode && apiLoaded ? apiOffers : localOffers
  const isLoaded = localLoaded && apiLoaded
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OfferStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<OfferType | 'all'>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [jsonOffer, setJsonOffer] = useState<Offer | null>(null)
  const [jsonStoredRecord, setJsonStoredRecord] = useState<unknown>()

  const filteredOffers = useMemo(() => {
    return offers.filter(offer => {
      const matchesSearch = offer.name.toLowerCase().includes(search.toLowerCase()) ||
        offer.description.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || offer.status === statusFilter
      const matchesType = typeFilter === 'all' || offer.type === typeFilter
      return matchesSearch && matchesStatus && matchesType
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [offers, search, statusFilter, typeFilter])

  const handleDuplicate = (id: string) => {
    const duplicated = duplicateOffer(id)
    if (duplicated) {
      toast.success('Offer duplicated', {
        description: `"${duplicated.name}" created as a draft`
      })
    }
  }

  const handleToggleStatus = (id: string) => {
    toggleStatus(id)
    toast.success('Status updated')
  }

  const handleDelete = () => {
    if (deleteId) {
      const offer = offers.find(o => o.id === deleteId)
      deleteOffer(deleteId)
      toast.success('Offer deleted', {
        description: `"${offer?.name}" has been removed`
      })
      setDeleteId(null)
    }
  }

  const getOfferValueDisplay = (offer: typeof offers[0]) => {
    const apiType = (offer as OrdrzOffer).ordrzType
    if (apiType === 'FREE_DELIVERY') return 'Free delivery'
    if (apiType === 'REDUCED_DELIVERY') return 'Reduced delivery'
    if (apiType === 'QUANTITY_TIER' || apiType === 'SPEND_TIER') return 'Tiered discount'
    switch (offer.type) {
      case 'percentage':
        return `${offer.discountValue}% off`
      case 'flat':
        return `${formatCurrency(offer.discountValue)} off`
      case 'bundle':
        return offer.bundlePrice ? `Bundle ${formatCurrency(offer.bundlePrice)}` : 'Bundle'
      case 'bogo':
        return `Buy ${offer.buyQuantity} Get ${offer.getQuantity}`
      case 'free_delivery':
        return 'Free delivery'
      default:
        return ''
    }
  }

  if (!isLoaded) {
    return (
      <AppShell title="Offers">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell 
      title="Offers" 
      description="Manage your promotional offers"
      actions={
        <Link href={isOrdrzMode ? '/simulator' : '/offers/new'}>
          <Button>
            {isOrdrzMode ? <Tag className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {isOrdrzMode ? 'Manage discounts' : 'New Offer'}
          </Button>
        </Link>
      }
    >
      {isOrdrzMode && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">Ordrz discounts · {apiOffers.length} fetched</p>
              <p className="text-sm text-muted-foreground">Live results from GET /api/ordrz/discounts</p>
            </div>
            <Button variant="outline" onClick={() => void refreshApiOffers()} disabled={apiLoading}>
              {apiLoading ? 'Refreshing…' : 'Refresh discounts'}
            </Button>
          </CardContent>
        </Card>
      )}
      {apiError && (
        <Card className="mb-6 border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">Ordrz discount fetch failed: {apiError}</CardContent>
        </Card>
      )}
      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search offers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OfferStatus | 'all')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as OfferType | 'all')}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(OFFER_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Offers List */}
      {filteredOffers.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={search || statusFilter !== 'all' || typeFilter !== 'all' ? 'No offers found' : 'No offers yet'}
          description={
            search || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first offer to start driving sales'
          }
          action={
            !search && statusFilter === 'all' && typeFilter === 'all' && (
              <Link href="/offers/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Offer
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredOffers.map((offer) => (
            <Card key={offer.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-4">
                  <OfferTypeIcon type={offer.type} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isOrdrzMode ? (
                        <span className="truncate font-semibold">{offer.name}</span>
                      ) : (
                        <Link href={`/offers/${offer.id}`} className="truncate font-semibold hover:text-primary">
                          {offer.name}
                        </Link>
                      )}
                      <StatusBadge status={offer.status} />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{offer.description}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{getOfferValueDisplay(offer)}</span>
                      <span>{offer.limits.currentRedemptions} redemptions</span>
                      {offer.limits.maxRedemptions && (
                        <span>Limit: {offer.limits.maxRedemptions}</span>
                      )}
                      {offer.targeting.channels.length > 0 && (
                        <span>
                          {offer.targeting.channels.includes('all') 
                            ? 'All channels' 
                            : offer.targeting.channels.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 gap-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 font-mono"
                      onClick={() => { setJsonOffer(offer); setJsonStoredRecord(isOrdrzMode ? (offer as OrdrzOffer).ordrzRecord : offer) }}
                    >
                      <Braces className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">JSON</span>
                    </Button>
                    {isOrdrzMode && <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                      <Link href={`/offers/${offer.id}`}><Pencil className="h-3.5 w-3.5" />Edit</Link>
                    </Button>}
                    {!isOrdrzMode && <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/offers/${offer.id}`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(offer.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setJsonOffer(offer); setJsonStoredRecord(offer) }}>
                          <Braces className="h-4 w-4 mr-2" />
                          View JSON
                        </DropdownMenuItem>
                        {(offer.status === 'active' || offer.status === 'paused' || offer.status === 'draft') && (
                          <DropdownMenuItem onClick={() => handleToggleStatus(offer.id)}>
                            {offer.status === 'active' ? (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteId(offer.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Offer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this offer? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* JSON Schema Dialog */}
      <OfferJsonDialog
        offer={jsonOffer}
        storedRecord={jsonStoredRecord}
        open={!!jsonOffer}
        onOpenChange={(open) => { if (!open) setJsonOffer(null) }}
      />

    </AppShell>
  )
}
