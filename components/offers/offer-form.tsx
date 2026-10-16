'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { OfferTypeIcon } from './offer-type-icon'
import { JsonPreviewCard } from './json-preview-card'
import { useOffers } from '@/hooks/use-offers'
import { useMenuItems } from '@/hooks/use-menu-items'
import { useLocations } from '@/hooks/use-locations'
import { useBusinessLocations } from '@/hooks/use-business-locations'
import { formatCurrency } from '@/lib/engine'
import { seedState } from '@/lib/offline-simulator'
import { OFFER_TYPE_CONFIG, DAYS_OF_WEEK, CHANNEL_CONFIG } from '@/lib/constants'
import type { MenuItem, Offer, OfferType, OfferStatus, OfferApplicationMode, Channel } from '@/lib/types'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  CalendarIcon,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'

interface OfferFormProps {
  offer?: Offer
  mode: 'create' | 'edit'
  onSave?: (offer: Offer) => Promise<void | string> | void | string
  categoryOptions?: string[]
}

const getMenuItemFallback = (item: MenuItem) => {
  const category = item.category.toLowerCase()
  if (category.includes('side')) return '/menu/fries.svg'
  if (category.includes('drink')) return '/menu/drink.svg'
  if (category.includes('dessert')) return '/menu/dessert.svg'
  if (category.includes('starter')) return '/menu/salad.svg'
  if (category.includes('pizza')) return '/menu/pizza.svg'
  return '/menu/burger.svg'
}

const getMenuItemImage = (item: MenuItem) => item.image || getMenuItemFallback(item)

const FORM_STEPS = [
  { value: 'basics', label: 'Basics' },
  { value: 'rules', label: 'Rules' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'targeting', label: 'Targeting' },
  { value: 'limits', label: 'Limits' },
  { value: 'preview', label: 'Review' },
] as const
type FormStep = typeof FORM_STEPS[number]['value']

export function OfferForm({ offer, mode, onSave, categoryOptions }: OfferFormProps) {
  const router = useRouter()
  const { addOffer, updateOffer } = useOffers()
  const { items: menuItems, categories: menuCategories } = useMenuItems()
  const categories = categoryOptions?.length ? categoryOptions : menuCategories
  const { locations: localLocations } = useLocations()
  const { locations, error: locationsError } = useBusinessLocations(localLocations)
  const [activeStep, setActiveStep] = useState<FormStep>('basics')

  // Form state
  const [name, setName] = useState(offer?.name || '')
  const [description, setDescription] = useState(offer?.description || '')
  const [type, setType] = useState<OfferType>(offer?.type || 'percentage')
  const [status, setStatus] = useState<OfferStatus>(offer?.status || 'draft')
  const [applicationMode, setApplicationMode] = useState<OfferApplicationMode>(offer?.applicationMode || 'automatic')
  const [discountValue, setDiscountValue] = useState(offer?.discountValue || 0)
  
  // Bundle
  const [bundleItems, setBundleItems] = useState<string[]>(offer?.bundleItems || [])
  const [bundlePrice, setBundlePrice] = useState(offer?.bundlePrice || 0)
  
  // BOGO
  const [buyQuantity, setBuyQuantity] = useState(offer?.buyQuantity || 2)
  const [getQuantity, setGetQuantity] = useState(offer?.getQuantity || 1)
  const [bogoRewardMode, setBogoRewardMode] = useState<'percentage' | 'fixed_amount' | 'fixed_price'>(offer?.bogoRewardMode || 'percentage')
  const [bogoRewardValue, setBogoRewardValue] = useState(offer?.bogoRewardValue ?? offer?.getItemDiscount ?? 100)
  const [bogoItems, setBogoItems] = useState<string[]>(offer?.bogoItems || [])
  const [bogoRewardItems, setBogoRewardItems] = useState<string[]>(offer?.bogoRewardItems || [])
  const [bundleSearch, setBundleSearch] = useState('')
  const [bundleCategory, setBundleCategory] = useState('all')
  const [bogoBuySearch, setBogoBuySearch] = useState('')
  const [bogoBuyCategory, setBogoBuyCategory] = useState('all')
  const [bogoRewardSearch, setBogoRewardSearch] = useState('')
  const [bogoRewardCategory, setBogoRewardCategory] = useState('all')

  // Rules
  const [minSpend, setMinSpend] = useState(offer?.rules.minSpend || 0)
  const [maxDiscount, setMaxDiscount] = useState(offer?.rules.maxDiscount || 0)
  const [includedCategories, setIncludedCategories] = useState<string[]>(offer?.rules.includedCategories || [])
  const [includedItems, setIncludedItems] = useState<string[]>(offer?.rules.includedItems || [])
  const [appliesTo, setAppliesTo] = useState<'order' | 'category' | 'item'>(() =>
    offer?.rules.includedItems?.length ? 'item' : offer?.rules.includedCategories?.length ? 'category' : 'order'
  )
  const [itemSearch, setItemSearch] = useState('')
  const [itemCategory, setItemCategory] = useState('all')
  const [couponCode, setCouponCode] = useState(offer?.rules.couponCode || '')

  // Schedule
  const [startDate, setStartDate] = useState<Date>(offer?.schedule.startDate ? new Date(offer.schedule.startDate) : new Date())
  const [endDate, setEndDate] = useState<Date | undefined>(offer?.schedule.endDate ? new Date(offer.schedule.endDate) : undefined)
  const [hasEndDate, setHasEndDate] = useState(!!offer?.schedule.endDate)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(offer?.schedule.daysOfWeek || [])
  const [timeWindows, setTimeWindows] = useState(offer?.schedule.timeWindows || [])

  // Targeting
  const [channels, setChannels] = useState<Channel[]>(offer?.targeting.channels || ['all'])
  const [selectedLocations, setSelectedLocations] = useState<string[]>(offer?.targeting.locations || [])

  // Limits
  const [maxRedemptions, setMaxRedemptions] = useState(offer?.limits.maxRedemptions || 0)
  const [hasMaxRedemptions, setHasMaxRedemptions] = useState(!!offer?.limits.maxRedemptions)
  const [maxPerTransaction, setMaxPerTransaction] = useState(offer?.limits.maxPerTransaction || 1)

  const [priority, setPriority] = useState(offer?.priority || 5)
  const [isStackable, setIsStackable] = useState(offer?.isStackable ?? false)

  const goToNextStep = () => {
    if (activeStep === 'basics' && !name.trim()) {
      toast.error('Please enter an offer name before continuing')
      return
    }
    if (activeStep === 'basics' && applicationMode === 'code' && !couponCode.trim()) {
      toast.error('Enter a coupon code before continuing')
      return
    }
    if (activeStep === 'rules' && type !== 'bogo' && appliesTo === 'category' && includedCategories.length === 0) {
      toast.error('Select at least one category for this offer')
      return
    }
    if (activeStep === 'rules' && type !== 'bogo' && appliesTo === 'item' && includedItems.length === 0) {
      toast.error('Select at least one item for this offer')
      return
    }
    const nextStep = visibleSteps[activeStepIndex + 1]
    if (nextStep) setActiveStep(nextStep.value)
  }

  const goToPreviousStep = () => {
    const previousStep = visibleSteps[activeStepIndex - 1]
    if (previousStep) setActiveStep(previousStep.value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Please enter an offer name')
      return
    }

    if (applicationMode === 'code' && !couponCode.trim()) {
      toast.error('Enter a coupon code for this offer')
      return
    }

    if (type !== 'bogo' && appliesTo === 'category' && includedCategories.length === 0) {
      toast.error('Select at least one category for this offer')
      setActiveStep('rules')
      return
    }
    if (type !== 'bogo' && appliesTo === 'item' && includedItems.length === 0) {
      toast.error('Select at least one item for this offer')
      setActiveStep('rules')
      return
    }

    if (type === 'bundle' && !onSave) {
      const selectedBundleItems = menuItems.filter(item => bundleItems.includes(item.sku))
      const originalBundleTotal = selectedBundleItems.reduce((sum, item) => sum + item.price, 0)
      if (selectedBundleItems.length < 2) {
        toast.error('Select at least two items for a bundle')
        return
      }
      if (bundlePrice <= 0 || bundlePrice >= originalBundleTotal) {
        toast.error('Bundle price must be lower than the selected items total')
        return
      }
    }

    const offerData = {
      name: name.trim(),
      description: description.trim(),
      type,
      status,
      applicationMode,
      discountValue: type === 'percentage' ? discountValue : type === 'flat' ? discountValue : 0,
      bundleItems: type === 'bundle' ? bundleItems : undefined,
      bundlePrice: type === 'bundle' ? bundlePrice : undefined,
      buyQuantity: type === 'bogo' ? buyQuantity : undefined,
      getQuantity: type === 'bogo' ? getQuantity : undefined,
      getItemDiscount: type === 'bogo' && bogoRewardMode === 'percentage' ? bogoRewardValue : undefined,
      bogoRewardMode: type === 'bogo' ? bogoRewardMode : undefined,
      bogoRewardValue: type === 'bogo' ? bogoRewardValue : undefined,
      bogoItems: type === 'bogo' ? bogoItems : undefined,
      bogoRewardItems: type === 'bogo' ? bogoRewardItems : undefined,
      rules: {
        minSpend: minSpend > 0 ? minSpend : undefined,
        maxDiscount: maxDiscount > 0 ? maxDiscount : undefined,
        includedItems: includedItems.length > 0 ? includedItems : undefined,
        includedCategories: includedCategories.length > 0 ? includedCategories : undefined,
        couponCode: applicationMode === 'code' ? couponCode.trim().toUpperCase() : undefined,
      },
      schedule: {
        startDate: startDate.toISOString(),
        endDate: hasEndDate && endDate ? endDate.toISOString() : undefined,
        daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : undefined,
        timeWindows: timeWindows.length > 0 ? timeWindows : undefined,
      },
      targeting: {
        channels,
        locations: selectedLocations,
      },
      limits: {
        maxRedemptions: hasMaxRedemptions && maxRedemptions > 0 ? maxRedemptions : undefined,
        maxPerTransaction,
        currentRedemptions: offer?.limits.currentRedemptions || 0,
      },
      priority,
      isStackable,
    }

    if (onSave) {
      try {
        const saveWarning = await onSave({
          ...offerData,
          id: offer?.id || '',
          limits: { ...offerData.limits, currentRedemptions: offer?.limits.currentRedemptions || 0 },
          createdAt: offer?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Offer)
        if (saveWarning) {
          toast.error(saveWarning)
        } else {
          toast.success(mode === 'create' ? 'Offer created' : 'Offer updated', { description: `“${name}” has been saved` })
        }
        router.push('/offers')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not save this offer.')
      }
      return
    }

    if (mode === 'create') {
      const createdOffer = addOffer(offerData as Omit<Offer, 'id' | 'createdAt' | 'updatedAt'>)
      if (applicationMode === 'code') createSimulatorCoupon(createdOffer.id, couponCode.trim().toUpperCase())
      toast.success('Offer created', { description: `"${name}" has been created` })
    } else if (offer) {
      updateOffer(offer.id, offerData)
      if (applicationMode === 'code') createSimulatorCoupon(offer.id, couponCode.trim().toUpperCase())
      toast.success('Offer updated', { description: `"${name}" has been saved` })
    }

    router.push('/offers')
  }

  const toggleBundleItem = (sku: string) => {
    setBundleItems(prev => 
      prev.includes(sku) ? prev.filter(s => s !== sku) : [...prev, sku]
    )
  }

  const toggleBogoItem = (sku: string) => {
    setBogoItems(prev => 
      prev.includes(sku) ? prev.filter(s => s !== sku) : [...prev, sku]
    )
  }

  const toggleBogoRewardItem = (sku: string) => {
    setBogoRewardItems(prev =>
      prev.includes(sku) ? prev.filter(s => s !== sku) : [...prev, sku]
    )
  }

  const toggleDay = (day: number) => {
    setDaysOfWeek(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const toggleCategory = (category: string) => {
    setIncludedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    )
  }

  const chooseApplyScope = (scope: 'order' | 'category' | 'item') => {
    setAppliesTo(scope)
    if (scope !== 'category') setIncludedCategories([])
    if (scope !== 'item') setIncludedItems([])
  }

  const createSimulatorCoupon = (discountId: string, code: string) => {
    try {
      const storageKey = 'discount-coupon-simulator-v1'
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const simulatorState = raw ? JSON.parse(raw) : seedState()
      const existing = Array.isArray(simulatorState.discountCodes) ? simulatorState.discountCodes : []
      if (existing.some((coupon: { code: string }) => coupon.code === code)) {
        toast.error(`Coupon ${code} already exists in the simulator`)
        return
      }
      simulatorState.discountCodes = [...existing, {
        id: crypto.randomUUID(),
        discountId,
        code,
        isActive: true,
        startAt: null,
        endAt: null,
        maxUses: null,
        usesPerCustomer: null,
      }]
      window.localStorage.setItem(storageKey, JSON.stringify(simulatorState))
      window.dispatchEvent(new CustomEvent('incentives-local-storage-updated', { detail: { key: storageKey } }))
    } catch {
      toast.error('Offer saved, but the simulator coupon could not be created')
    }
  }

  const toggleIncludedItem = (sku: string) => {
    setIncludedItems(prev =>
      prev.includes(sku) ? prev.filter(itemSku => itemSku !== sku) : [...prev, sku]
    )
  }

  const filterMenuItems = (search: string, selectedCategory: string) => {
    const query = search.trim().toLowerCase()
    return menuItems.filter(item => {
      const matchesSearch = !query || item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query) || item.category.toLowerCase().includes(query)
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }
  const filteredMenuItems = filterMenuItems(itemSearch, itemCategory)
  const filteredBundleItems = filterMenuItems(bundleSearch, bundleCategory)
  const filteredBogoBuyItems = filterMenuItems(bogoBuySearch, bogoBuyCategory)
  const filteredBogoRewardItems = filterMenuItems(bogoRewardSearch, bogoRewardCategory)
  const visibleSteps = type === 'bogo' ? FORM_STEPS.filter(step => step.value !== 'rules') : FORM_STEPS
  const activeStepIndex = visibleSteps.findIndex(step => step.value === activeStep)
  const selectedBundleItems = menuItems.filter(item => bundleItems.includes(item.sku))
  const originalBundleTotal = selectedBundleItems.reduce((sum, item) => sum + item.price, 0)

  const toggleChannel = (channel: Channel) => {
    if (channel === 'all') {
      setChannels(['all'])
    } else {
      const newChannels = channels.filter(c => c !== 'all')
      if (newChannels.includes(channel)) {
        const filtered = newChannels.filter(c => c !== channel)
        setChannels(filtered.length === 0 ? ['all'] : filtered)
      } else {
        setChannels([...newChannels, channel])
      }
    }
  }

  const addTimeWindow = () => {
    setTimeWindows(prev => [...prev, { startTime: '09:00', endTime: '17:00' }])
  }

  const updateTimeWindow = (index: number, field: 'startTime' | 'endTime', value: string) => {
    setTimeWindows(prev => prev.map((tw, i) => 
      i === index ? { ...tw, [field]: value } : tw
    ))
  }

  const removeTimeWindow = (index: number) => {
    setTimeWindows(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-between mb-6">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <p className="text-sm text-muted-foreground">{mode === 'create' ? 'New offer' : 'Editing offer'}</p>
      </div>

      <Tabs value={activeStep} onValueChange={value => setActiveStep(value as FormStep)} className="space-y-6">
        <TabsList className={cn('grid w-full grid-cols-3', type === 'bogo' ? 'lg:grid-cols-5' : 'lg:grid-cols-6')}>
          {visibleSteps.map((step, index) => (
            <TabsTrigger key={step.value} value={step.value} title={`Step ${index + 1}: ${step.label}`}>
              <span className="mr-1.5 text-xs text-muted-foreground">{index + 1}</span>{step.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Basics Tab */}
        <TabsContent value="basics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Set the name and description for your offer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Offer Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Happy Hour 20% Off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this offer for customers..."
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-4">
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={status === 'active'}
                    onCheckedChange={(checked) => setStatus(checked ? 'active' : 'draft')}
                  />
                  <span className="text-sm text-muted-foreground">
                    {status === 'active' ? 'Active' : 'Draft'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="applicationMode">How should this offer trigger?</Label>
                <select
                  id="applicationMode"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={applicationMode}
                  onChange={(e) => setApplicationMode(e.target.value as OfferApplicationMode)}
                >
                  <option value="automatic">Automatic when cart qualifies</option>
                  <option value="code">Coupon code required</option>
                  <option value="manual">Manual approval at POS</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {applicationMode === 'automatic'
                    ? 'The offer is evaluated automatically for eligible orders.'
                    : applicationMode === 'code'
                      ? 'Create a coupon code for this offer before applying it at checkout.'
                      : 'A manager must choose this offer from POS manual discounts.'}
                </p>
                {applicationMode === 'code' && (
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="couponCode">Coupon code</Label>
                    <Input
                      id="couponCode"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                      placeholder="e.g. BOGO10"
                    />
                    <p className="text-xs text-muted-foreground">This code will be created and linked to the offer automatically.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Offer Type</CardTitle>
              <CardDescription>Choose the type of discount or deal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(Object.entries(OFFER_TYPE_CONFIG) as [OfferType, typeof OFFER_TYPE_CONFIG[OfferType]][])
                  .filter(([key]) => key !== 'bundle' || (mode === 'edit' && offer?.type === 'bundle'))
                  .map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={cn(
                      'flex flex-col items-center gap-3 rounded-lg border-2 p-4 text-center transition-colors',
                      type === key
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <OfferTypeIcon type={key} size="lg" />
                    <div>
                      <p className="font-medium">{config.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Type-specific configuration */}
          {type === 'percentage' && (
            <Card>
              <CardHeader>
                <CardTitle>Percentage Discount</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="discountValue">Discount Percentage</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="discountValue"
                      type="number"
                      min={1}
                      max={100}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {type === 'flat' && (
            <Card>
              <CardHeader>
                <CardTitle>Flat Discount</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="flatValue">Discount Amount (cents)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      id="flatValue"
                      type="number"
                      min={1}
                      value={(discountValue / 100).toFixed(2)}
                      onChange={(e) => setDiscountValue(Math.round(Number(e.target.value) * 100))}
                      className="w-32"
                      step="0.01"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Customers will save {formatCurrency(discountValue)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {type === 'bundle' && (
            <Card>
              <CardHeader>
                <CardTitle>Bundle Configuration</CardTitle>
                <CardDescription>Select items that make up this bundle</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bundlePrice">Bundle Price</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      id="bundlePrice"
                      type="number"
                      min={0}
                      value={(bundlePrice / 100).toFixed(2)}
                      onChange={(e) => setBundlePrice(Math.round(Number(e.target.value) * 100))}
                      className="w-32"
                      step="0.01"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Normal total: {formatCurrency(originalBundleTotal)} ·{' '}
                    {bundlePrice > 0 && bundlePrice < originalBundleTotal
                      ? `Customer saves ${formatCurrency(originalBundleTotal - bundlePrice)}`
                      : 'Set a price below the normal total to create a saving.'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Bundle Items</Label>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                    <Input placeholder="Search items by name, SKU, or category" value={bundleSearch} onChange={event => setBundleSearch(event.target.value)} />
                    <select aria-label="Filter bundle items by category" className="h-10 rounded-md border bg-background px-3 text-sm" value={bundleCategory} onChange={event => setBundleCategory(event.target.value)}>
                      <option value="all">All categories</option>
                      {categories.map(category => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                    {filteredBundleItems.map((item) => (
                      <label
                        key={item.id}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                          bundleItems.includes(item.sku) ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        )}
                      >
                        <Checkbox
                          checked={bundleItems.includes(item.sku)}
                          onCheckedChange={() => toggleBundleItem(item.sku)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                        </div>
                      </label>
                    ))}
                    {!filteredBundleItems.length && <p className="col-span-full p-4 text-center text-sm text-muted-foreground">No items match these filters.</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {type === 'bogo' && (
            <Card>
              <CardHeader>
                <CardTitle>Buy X Get Y Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="buyQty">Buy Quantity</Label>
                    <Input
                      id="buyQty"
                      type="number"
                      min={1}
                      value={buyQuantity}
                      onChange={(e) => setBuyQuantity(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="getQty">Get Quantity</Label>
                    <Input
                      id="getQty"
                      type="number"
                      min={1}
                      value={getQuantity}
                      onChange={(e) => setGetQuantity(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bogoRewardMode">Reward pricing</Label>
                    <select
                      id="bogoRewardMode"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={bogoRewardMode}
                      onChange={(e) => {
                        const next = e.target.value as typeof bogoRewardMode
                        setBogoRewardMode(next)
                        if (next === 'percentage' && bogoRewardValue > 100) setBogoRewardValue(100)
                      }}
                    >
                      <option value="percentage">Percentage off</option>
                      <option value="fixed_price">Fixed final price</option>
                      <option value="fixed_amount">Fixed amount off</option>
                    </select>
                    <Input
                      id="bogoRewardValue"
                      type="number"
                      min={0}
                      max={bogoRewardMode === 'percentage' ? 100 : undefined}
                      value={bogoRewardMode === 'percentage' ? bogoRewardValue : (bogoRewardValue / 100).toFixed(2)}
                      onChange={(e) => setBogoRewardValue(bogoRewardMode === 'percentage' ? Number(e.target.value) : Math.round(Number(e.target.value) * 100))}
                      placeholder={bogoRewardMode === 'percentage' ? '0–100' : 'Amount'}
                    />
                    <p className="text-xs text-muted-foreground">
                      {bogoRewardMode === 'percentage'
                        ? `${bogoRewardValue}% off (100% = free)`
                        : bogoRewardMode === 'fixed_price'
                          ? `Reward costs ${formatCurrency(bogoRewardValue)}`
                          : `Reward gets ${formatCurrency(bogoRewardValue)} off`}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Buy {buyQuantity} item(s), get {getQuantity} item(s) {bogoRewardMode === 'percentage'
                    ? `at ${bogoRewardValue}% off`
                    : bogoRewardMode === 'fixed_price'
                      ? `for ${formatCurrency(bogoRewardValue)} each`
                      : `with ${formatCurrency(bogoRewardValue)} off each`}
                </p>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Choose the trigger products and the reward products separately. Leave a list empty to allow any item.
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Buy these items</Label>
                    {bogoItems.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setBogoItems([])}>
                        Allow any item
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                    <Input placeholder="Search buy items by name, SKU, or category" value={bogoBuySearch} onChange={event => setBogoBuySearch(event.target.value)} />
                    <select aria-label="Filter buy items by category" className="h-10 rounded-md border bg-background px-3 text-sm" value={bogoBuyCategory} onChange={event => setBogoBuyCategory(event.target.value)}>
                      <option value="all">All categories</option>
                      {categories.map(category => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                    {filteredBogoBuyItems.map((item) => (
                      <label
                        key={item.id}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                          bogoItems.includes(item.sku) ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        )}
                      >
                        <Checkbox
                          checked={bogoItems.includes(item.sku)}
                          onCheckedChange={() => toggleBogoItem(item.sku)}
                        />
                        <img
                          src={getMenuItemImage(item)}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg border border-border/60 bg-muted object-cover"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.onerror = null
                            event.currentTarget.src = getMenuItemFallback(item)
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                        </div>
                      </label>
                    ))}
                    {!filteredBogoBuyItems.length && <p className="col-span-full p-4 text-center text-sm text-muted-foreground">No items match these filters.</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {bogoItems.length ? `${bogoItems.length} buy item${bogoItems.length === 1 ? '' : 's'} selected` : 'Any item can trigger this offer'}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Get these items</Label>
                    {bogoRewardItems.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setBogoRewardItems([])}>
                        Allow any reward
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                    <Input placeholder="Search reward items by name, SKU, or category" value={bogoRewardSearch} onChange={event => setBogoRewardSearch(event.target.value)} />
                    <select aria-label="Filter reward items by category" className="h-10 rounded-md border bg-background px-3 text-sm" value={bogoRewardCategory} onChange={event => setBogoRewardCategory(event.target.value)}>
                      <option value="all">All categories</option>
                      {categories.map(category => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                    {filteredBogoRewardItems.map((item) => (
                      <label
                        key={item.id}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                          bogoRewardItems.includes(item.sku) ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        )}
                      >
                        <Checkbox
                          checked={bogoRewardItems.includes(item.sku)}
                          onCheckedChange={() => toggleBogoRewardItem(item.sku)}
                        />
                        <img
                          src={getMenuItemImage(item)}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg border border-border/60 bg-muted object-cover"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.onerror = null
                            event.currentTarget.src = getMenuItemFallback(item)
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                        </div>
                      </label>
                    ))}
                    {!filteredBogoRewardItems.length && <p className="col-span-full p-4 text-center text-sm text-muted-foreground">No items match these filters.</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {bogoRewardItems.length ? `${bogoRewardItems.length} reward item${bogoRewardItems.length === 1 ? '' : 's'} selected` : 'Any item can be given as the reward'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {type === 'free_delivery' && (
            <Card>
              <CardHeader>
                <CardTitle>Free Shipping</CardTitle>
                <CardDescription>Waive the delivery charge when this offer is applied.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This offer applies to delivery orders only. Add a minimum spend under Rules if the customer needs to meet an order threshold.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Spend Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="minSpend">Minimum Spend</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    id="minSpend"
                    type="number"
                    min={0}
                    value={(minSpend / 100).toFixed(2)}
                    onChange={(e) => setMinSpend(Math.round(Number(e.target.value) * 100))}
                    className="w-32"
                    step="0.01"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave at 0 for no minimum
                </p>
              </div>
              {type === 'percentage' && (
                <div className="space-y-2">
                  <Label htmlFor="maxDiscount">Maximum Discount Cap</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      id="maxDiscount"
                      type="number"
                      min={0}
                      value={(maxDiscount / 100).toFixed(2)}
                      onChange={(e) => setMaxDiscount(Math.round(Number(e.target.value) * 100))}
                      className="w-32"
                      step="0.01"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximum amount that can be discounted (safety cap)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
              <CardHeader>
                <CardTitle>Where should this offer apply?</CardTitle>
                <CardDescription>{type === 'free_delivery' ? 'Choose which orders qualify for free delivery.' : 'Choose the order, categories, or specific items that qualify.'}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {([
                  ['order', 'Whole order', 'Apply to the full eligible order'],
                  ['category', 'Categories', 'Choose one or more menu categories'],
                  ['item', 'Specific items', 'Choose individual menu items'],
                ] as const).map(([scope, label, description]) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => chooseApplyScope(scope)}
                    aria-pressed={appliesTo === scope}
                    className={cn(
                      'rounded-lg border-2 p-4 text-left transition-colors',
                      appliesTo === scope ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    )}
                  >
                    <span className="block font-medium">{label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
                  </button>
                ))}
              </CardContent>
          </Card>

          {appliesTo === 'category' && (
            <Card>
              <CardHeader>
                <CardTitle>Choose categories</CardTitle>
                <CardDescription>{type === 'free_delivery' ? 'The order must contain an item from a selected category to qualify.' : 'Apply this offer only to the selected categories.'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      aria-pressed={includedCategories.includes(category)}
                      className={cn(
                        'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                        includedCategories.includes(category)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                {includedCategories.length === 0 && (
                  <p className="mt-4 text-sm text-muted-foreground">Select at least one category.</p>
                )}
              </CardContent>
            </Card>
          )}

          {appliesTo === 'item' && (
            <Card>
              <CardHeader>
                <CardTitle>Choose items</CardTitle>
                <CardDescription>{type === 'free_delivery' ? 'The order must contain a selected item to qualify for free delivery.' : 'Apply this offer only to the selected menu items.'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <Input
                  placeholder="Search menu items by name, SKU, or category..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                />
                <select aria-label="Filter menu items by category" className="h-10 rounded-md border bg-background px-3 text-sm" value={itemCategory} onChange={event => setItemCategory(event.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
              <div className="max-h-96 overflow-y-auto rounded-lg border p-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  {filteredMenuItems.map((item) => {
                    const checked = includedItems.includes(item.sku)
                    return (
                      <label
                        key={item.sku}
                        htmlFor={`included-item-${item.sku}`}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-colors',
                          checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        )}
                      >
                        <Checkbox
                          id={`included-item-${item.sku}`}
                          checked={checked}
                          onCheckedChange={() => toggleIncludedItem(item.sku)}
                        />
                        <img
                          src={getMenuItemImage(item)}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover"
                          onError={(event) => {
                            event.currentTarget.onerror = null
                            event.currentTarget.src = getMenuItemFallback(item)
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.category} · {formatCurrency(item.price)}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                {!filteredMenuItems.length && (
                  <p className="p-6 text-center text-sm text-muted-foreground">No menu items match this search.</p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {includedItems.length === 0
                  ? 'No items selected - offer applies to all items in the selected categories.'
                  : `${includedItems.length} item${includedItems.length === 1 ? '' : 's'} selected`}
              </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Date Range</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(startDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>End Date</Label>
                    <div className="flex items-center gap-2">
                      <Switch checked={hasEndDate} onCheckedChange={setHasEndDate} />
                      <span className="text-sm text-muted-foreground">Has end date</span>
                    </div>
                  </div>
                  {hasEndDate && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Days of Week</CardTitle>
              <CardDescription>Select which days this offer is active</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      'h-12 w-12 rounded-full text-sm font-medium transition-colors',
                      daysOfWeek.includes(day.value)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {daysOfWeek.length === 0 && (
                <p className="text-sm text-muted-foreground mt-4">
                  No days selected - offer is active every day
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time Windows</CardTitle>
              <CardDescription>Set specific hours when this offer is active</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {timeWindows.map((window, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Input
                    type="time"
                    value={window.startTime}
                    onChange={(e) => updateTimeWindow(index, 'startTime', e.target.value)}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={window.endTime}
                    onChange={(e) => updateTimeWindow(index, 'endTime', e.target.value)}
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTimeWindow(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addTimeWindow}>
                <Plus className="h-4 w-4 mr-2" />
                Add Time Window
              </Button>
              {timeWindows.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No time windows - offer is active all day
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Targeting Tab */}
        <TabsContent value="targeting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Channels</CardTitle>
              <CardDescription>Select where this offer is available</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(Object.entries(CHANNEL_CONFIG) as [Channel, typeof CHANNEL_CONFIG[Channel]][]).map(([key, config]) => (
                  <label
                    key={key}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors',
                      channels.includes(key)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <Checkbox
                      checked={channels.includes(key)}
                      onCheckedChange={() => toggleChannel(key)}
                    />
                    <div>
                      <p className="font-medium">{config.label}</p>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Locations</CardTitle>
              <CardDescription>Select which business locations this offer applies to</CardDescription>
            </CardHeader>
            <CardContent>
              {locationsError && (
                <p role="status" className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900">
                  Could not load Ordrz business locations: {locationsError}
                </p>
              )}
              {locations.length === 0 && !locationsError && (
                <p className="mb-3 text-sm text-muted-foreground">No business locations are available.</p>
              )}
              <div className="space-y-2">
                {locations.map((location) => (
                  <label
                    key={location.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                      selectedLocations.includes(location.id) ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                    )}
                  >
                    <Checkbox
                      checked={selectedLocations.includes(location.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedLocations(prev => [...prev, location.id])
                        } else {
                          setSelectedLocations(prev => prev.filter(id => id !== location.id))
                        }
                      }}
                    />
                    <div>
                      <p className="font-medium">{location.name}</p>
                      {location.address && (
                        <p className="text-xs text-muted-foreground">{location.address}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {selectedLocations.length === 0 && (
                <p className="text-sm text-muted-foreground mt-4">
                  No locations selected - offer applies to all locations
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Limits Tab */}
        <TabsContent value="limits" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Redemption Limits</CardTitle>
              <CardDescription>Set limits to control offer usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Maximum Total Redemptions</Label>
                    <p className="text-xs text-muted-foreground">Limit total times this offer can be used</p>
                  </div>
                  <Switch checked={hasMaxRedemptions} onCheckedChange={setHasMaxRedemptions} />
                </div>
                {hasMaxRedemptions && (
                  <Input
                    type="number"
                    min={1}
                    value={maxRedemptions}
                    onChange={(e) => setMaxRedemptions(Number(e.target.value))}
                    className="w-32"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPerTx">Maximum Per Transaction</Label>
                <Input
                  id="maxPerTx"
                  type="number"
                  min={1}
                  value={maxPerTransaction}
                  onChange={(e) => setMaxPerTransaction(Number(e.target.value))}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  How many times this offer can apply in a single order
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Offer Stacking</CardTitle>
              <CardDescription>Choose whether this offer can combine with other eligible discounts.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="isStackable">Allow this offer to stack</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isStackable
                      ? 'This offer can apply alongside other eligible discounts.'
                      : 'When applied, this offer blocks other eligible discounts.'}
                  </p>
                </div>
                <Switch id="isStackable" checked={isStackable} onCheckedChange={setIsStackable} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Priority</CardTitle>
              <CardDescription>Higher priority offers are selected when multiple apply</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority Level (1-10)</Label>
                <Input
                  id="priority"
                  type="number"
                  min={1}
                  max={10}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-24"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Offer Preview</CardTitle>
              <CardDescription>Review your offer configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <OfferTypeIcon type={type} size="lg" />
                  <div>
                    <h3 className="font-semibold text-lg">{name || 'Untitled Offer'}</h3>
                    <p className="text-sm text-muted-foreground">{description || 'No description'}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Type</p>
                    <p className="font-medium">{OFFER_TYPE_CONFIG[type].label}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Value</p>
                    <p className="font-medium">
                      {type === 'percentage' && `${discountValue}% off`}
                      {type === 'flat' && `${formatCurrency(discountValue)} off`}
                      {type === 'bundle' && `Bundle for ${formatCurrency(bundlePrice)}`}
                      {type === 'bogo' && `Buy ${buyQuantity} Get ${getQuantity} ${bogoRewardMode === 'percentage' ? `at ${bogoRewardValue}% off` : bogoRewardMode === 'fixed_price' ? `for ${formatCurrency(bogoRewardValue)} each` : `with ${formatCurrency(bogoRewardValue)} off each`}`}
                      {type === 'free_delivery' && 'Free delivery fee'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Schedule</p>
                    <p className="font-medium">
                      {format(startDate, 'MMM d, yyyy')}
                      {hasEndDate && endDate ? ` - ${format(endDate, 'MMM d, yyyy')}` : ' (ongoing)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Channels</p>
                    <p className="font-medium">
                      {channels.includes('all') ? 'All Channels' : channels.map(c => CHANNEL_CONFIG[c].label).join(', ')}
                    </p>
                  </div>
                  {minSpend > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Minimum Spend</p>
                      <p className="font-medium">{formatCurrency(minSpend)}</p>
                    </div>
                  )}
                  {maxDiscount > 0 && type === 'percentage' && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Maximum Discount</p>
                      <p className="font-medium">{formatCurrency(maxDiscount)}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <JsonPreviewCard
            offer={offer}
            formData={{
              name,
              description,
              type,
              status,
              applicationMode,
              couponCode,
              discountValue,
              bundleItems,
              bundlePrice,
              buyQuantity,
              getQuantity,
              getItemDiscount: bogoRewardMode === 'percentage' ? bogoRewardValue : 0,
              bogoRewardMode,
              bogoRewardValue,
              bogoItems,
              bogoRewardItems,
              minSpend,
              maxDiscount,
              includedItems,
              includedCategories,
              startDate,
              endDate: hasEndDate ? endDate : undefined,
              daysOfWeek,
              timeWindows,
              channels,
              selectedLocations,
              maxRedemptions: hasMaxRedemptions ? maxRedemptions : undefined,
              maxPerTransaction,
              priority,
              isStackable,
            }}
          />
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex items-center justify-between border-t pt-5">
        <Button type="button" variant="outline" onClick={goToPreviousStep} disabled={activeStepIndex === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <p className="text-sm text-muted-foreground">Step {activeStepIndex + 1} of {visibleSteps.length}</p>
        {activeStepIndex === visibleSteps.length - 1 ? (
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" />
            {mode === 'create' ? 'Create Offer' : 'Save Changes'}
          </Button>
        ) : (
          <Button type="button" onClick={goToNextStep}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  )
}
