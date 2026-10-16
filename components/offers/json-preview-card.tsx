'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import type { Offer, OfferType, OfferStatus, OfferApplicationMode, Channel, TimeWindow } from '@/lib/types'
import { OFFER_TYPE_CONFIG, CHANNEL_CONFIG } from '@/lib/constants'
import { Copy, Check, Code2, FileJson, Braces, Zap, Info } from 'lucide-react'

interface JsonPreviewCardProps {
  offer?: Offer
  formData: {
    name: string
    description: string
    type: OfferType
    status: OfferStatus
    applicationMode: OfferApplicationMode
    couponCode: string
    discountValue: number
    bundleItems: string[]
    bundlePrice: number
    buyQuantity: number
    getQuantity: number
    getItemDiscount: number
    bogoRewardMode: 'percentage' | 'fixed_amount' | 'fixed_price'
    bogoRewardValue: number
    bogoItems: string[]
    bogoRewardItems: string[]
    minSpend: number
    maxDiscount: number
    includedItems: string[]
    includedCategories: string[]
    startDate: Date
    endDate?: Date
    daysOfWeek: number[]
    timeWindows: TimeWindow[]
    channels: Channel[]
    selectedLocations: string[]
    maxRedemptions?: number
    maxPerTransaction: number
    priority: number
    isStackable: boolean
  }
}

// Strip undefined/null/zero values for cleanliness
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => {
      if (v === undefined || v === null) return false
      if (Array.isArray(v) && v.length === 0) return false
      return true
    })
  )
}

// Syntax-highlights a JSON string into JSX spans
function JsonHighlight({ json }: { json: string }) {
  // First escape HTML entities
  let result = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Tokenize and highlight piece by piece to avoid regex conflicts
  // Use unique placeholders to prevent double-processing
  const tokens: { placeholder: string; replacement: string }[] = []
  let tokenIndex = 0

  // 1. Extract and replace strings (keys and values)
  result = result.replace(/("(?:[^"\\]|\\.)*")(\s*:)?/g, (match, str, colon) => {
    const placeholder = `__TOKEN_${tokenIndex++}__`
    const highlighted = colon
      ? `<span class="text-primary font-medium">${str}</span>${colon}`
      : `<span class="text-emerald-600">${str}</span>`
    tokens.push({ placeholder, replacement: highlighted })
    return placeholder
  })

  // 2. Replace booleans and null (before numbers to catch them first)
  result = result.replace(/\b(true|false|null)\b/g, (match) => {
    const placeholder = `__TOKEN_${tokenIndex++}__`
    tokens.push({ placeholder, replacement: `<span class="text-amber-600 font-medium">${match}</span>` })
    return placeholder
  })

  // 3. Replace standalone numbers (not inside tokens)
  result = result.replace(/:\s*(-?\d+\.?\d*)/g, (match, num) => {
    const placeholder = `__TOKEN_${tokenIndex++}__`
    tokens.push({ placeholder, replacement: `: <span class="text-blue-600">${num}</span>` })
    return placeholder
  })

  // 4. Replace all placeholders with their highlighted content
  for (const { placeholder, replacement } of tokens) {
    result = result.replace(placeholder, replacement)
  }

  return (
    <code
      className="text-[11.5px] leading-relaxed font-mono"
      dangerouslySetInnerHTML={{ __html: result }}
    />
  )
}

const TABS = [
  {
    id: 'record',
    label: 'System Record',
    icon: FileJson,
    description: 'The record stored in this system, or the exact record that will be saved from this form.',
  },
  {
    id: 'full',
    label: 'Full Schema',
    icon: FileJson,
    description: 'Complete structure — storage, POS mapping, receipt lines, and all metadata.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    icon: Zap,
    description: 'Stripped-down payload ideal for caching layers and quick cart evaluation.',
  },
  {
    id: 'api',
    label: 'API Payload',
    icon: Braces,
    description: 'JSON:API-style body for REST endpoints and webhook events.',
  },
]

export function JsonPreviewCard({ offer, formData }: JsonPreviewCardProps) {
  const [copiedTab, setCopiedTab] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('record')

  const schemas = useMemo(() => {
    const {
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
      getItemDiscount,
      bogoRewardMode,
      bogoRewardValue,
      bogoItems,
      bogoRewardItems,
      minSpend,
      maxDiscount,
      includedItems,
      includedCategories,
      startDate,
      endDate,
      daysOfWeek,
      timeWindows,
      channels,
      selectedLocations,
      maxRedemptions,
      maxPerTransaction,
      priority,
      isStackable,
    } = formData

    const typeLabel = OFFER_TYPE_CONFIG[type].label

    // Build discount configuration based on type
    const buildDiscount = () => {
      switch (type) {
        case 'percentage':
          return compact({
            method: 'percentage',
            rate: discountValue,
            unit: 'percent',
            cap: maxDiscount > 0 ? maxDiscount : null,
          })
        case 'flat':
          return compact({
            method: 'fixed_amount',
            amount: discountValue,
            unit: 'cents',
          })
        case 'bundle':
          return compact({
            method: 'bundle_price',
            fixedPrice: bundlePrice,
            unit: 'cents',
            requiredItems: bundleItems,
          })
        case 'bogo':
          return compact({
            method: 'buy_x_get_y',
            buyQuantity,
            getQuantity,
            rewardMode: bogoRewardMode,
            rewardValue: bogoRewardMode === 'percentage' ? getItemDiscount : bogoRewardValue,
            unit: bogoRewardMode === 'percentage' ? 'percent' : 'cents',
            buySkus: bogoItems.length > 0 ? bogoItems : '*',
            rewardSkus: bogoRewardItems.length > 0 ? bogoRewardItems : '*',
          })
        case 'free_delivery':
          return { method: 'free_delivery' }
      }
    }

    // Full JSON structure
    const full = {
      // Identity
      id: offer?.id || `offer_${Date.now()}`,
      externalId: null,
      name,
      description: description || null,

      // Display
      display: {
        label: name,
        shortLabel: name.length > 20 ? name.slice(0, 17) + '...' : name,
        type: typeLabel,
        receiptLine: `DISC: ${name.toUpperCase().slice(0, 36)}`,
        badgeColor: type === 'bogo' ? '#e51451' : '#2563eb',
      },

      // Discount
      discount: buildDiscount(),

      // Rules
      rules: compact({
        minCartTotal: minSpend > 0 ? minSpend : null,
        maxDiscountCap: maxDiscount > 0 ? maxDiscount : null,
        includedSkus: includedItems.length > 0 ? includedItems : null,
        includedCategories: includedCategories.length > 0 ? includedCategories : null,
        couponCode: applicationMode === 'code' ? couponCode || null : null,
        excludedCategories: null,
        excludedSkus: null,
      }),

      // Schedule (timezone handled at location level)
      schedule: {
        startDate: startDate.toISOString(),
        endDate: endDate?.toISOString() ?? null,
        daysOfWeek: daysOfWeek.length > 0 && daysOfWeek.length < 7
          ? daysOfWeek.map(d => ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d])
          : '*',
        timeWindows: timeWindows.length > 0
          ? timeWindows.map(tw => ({ from: tw.startTime, to: tw.endTime }))
          : '*',
      },

      // Targeting
      targeting: {
        channels: channels.includes('all')
          ? '*'
          : channels.map(c => CHANNEL_CONFIG[c].label),
        locationIds: selectedLocations.length > 0 ? selectedLocations : '*',
        audience: 'PUBLIC',
      },

      // Limits
      limits: compact({
        maxTotalRedemptions: maxRedemptions ?? null,
        maxPerTransaction: maxPerTransaction > 1 ? maxPerTransaction : null,
        maxPerCustomer: null,
        currentRedemptions: 0,
      }),

      // Stacking
      stacking: {
        stackable: isStackable,
        strategy: 'BEST_OFFER',
        exclusionGroup: null,
        priority,
      },

      // Lifecycle
      status: status.toUpperCase(),
      applicationMode,
      createdAt: offer?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Minimal structure
    const minimal = {
      id: offer?.id || `offer_${Date.now()}`,
      name,
      type,
      status,
      discount: buildDiscount(),
      rules: compact({
        minCartTotal: minSpend > 0 ? minSpend : undefined,
        items: includedItems.length > 0 ? includedItems : undefined,
        categories: includedCategories.length > 0 ? includedCategories : undefined,
      }),
      schedule: {
        start: startDate.toISOString(),
        end: endDate?.toISOString() ?? null,
      },
      channels: channels.includes('all') ? '*' : channels,
      locations: selectedLocations.length > 0 ? selectedLocations : '*',
      priority,
      isStackable,
    }

    // API payload structure
    const api = {
      data: {
        type: 'offer',
        id: offer?.id || `offer_${Date.now()}`,
        attributes: {
          name,
          description: description || null,
          offerType: type,
          status,
          priority,
          isStackable,
          discountConfig: buildDiscount(),
          rules: {
            minSpend: minSpend > 0 ? minSpend : null,
            maxDiscountCap: maxDiscount > 0 ? maxDiscount : null,
            includedSkus: includedItems.length > 0 ? includedItems : null,
            includedCategories: includedCategories.length > 0 ? includedCategories : null,
            couponCode: applicationMode === 'code' ? couponCode || null : null,
          },
          schedule: {
            startDate: startDate.toISOString(),
            endDate: endDate?.toISOString() ?? null,
            daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : null,
            timeWindows: timeWindows.length > 0 ? timeWindows : null,
          },
          targeting: {
            channels,
            locationIds: selectedLocations.length > 0 ? selectedLocations : null,
          },
          limits: {
            maxRedemptions: maxRedemptions ?? null,
            maxPerTransaction,
          },
        },
        meta: {
          currentRedemptions: 0,
          createdAt: offer?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    }

    const record: Offer = offer ?? {
      id: '',
      name,
      description,
      type,
      status,
      applicationMode,
      discountValue,
      bundleItems: type === 'bundle' ? bundleItems : undefined,
      bundlePrice: type === 'bundle' ? bundlePrice : undefined,
      buyQuantity: type === 'bogo' ? buyQuantity : undefined,
      getQuantity: type === 'bogo' ? getQuantity : undefined,
      getItemDiscount: type === 'bogo' && bogoRewardMode === 'percentage' ? getItemDiscount : undefined,
      bogoRewardMode: type === 'bogo' ? bogoRewardMode : undefined,
      bogoRewardValue: type === 'bogo' ? bogoRewardValue : undefined,
      bogoItems: type === 'bogo' ? bogoItems : undefined,
      bogoRewardItems: type === 'bogo' ? bogoRewardItems : undefined,
      rules: {
        minSpend: minSpend > 0 ? minSpend : undefined,
        maxDiscount: maxDiscount > 0 ? maxDiscount : undefined,
        includedItems: includedItems.length ? includedItems : undefined,
        includedCategories: includedCategories.length ? includedCategories : undefined,
        couponCode: applicationMode === 'code' ? couponCode : undefined,
      },
      schedule: {
        startDate: startDate.toISOString(),
        endDate: endDate?.toISOString(),
        daysOfWeek: daysOfWeek.length ? daysOfWeek : undefined,
        timeWindows: timeWindows.length ? timeWindows : undefined,
      },
      targeting: { channels, locations: selectedLocations },
      limits: { maxRedemptions, maxPerTransaction, currentRedemptions: 0 },
      priority,
      isStackable,
      createdAt: '',
      updatedAt: '',
    }

    return { record, full, minimal, api }
  }, [formData, offer])

  const copy = async (tab: string) => {
    const content = schemas[tab as keyof typeof schemas]
    try {
      await navigator.clipboard.writeText(JSON.stringify(content, null, 2))
      setCopiedTab(tab)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopiedTab(null), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const currentContent = schemas[activeTab as keyof typeof schemas]
  const lineCount = JSON.stringify(currentContent, null, 2).split('\n').length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0">
              <FileJson className="h-4.5 w-4.5 text-primary" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight">
                JSON Schema
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Preview the data structure for POS/API integration
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-xs h-6">v1.0</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-9 p-0.5 bg-muted/60 gap-0.5 w-full grid grid-cols-4">
            {TABS.map(tab => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="h-8 px-3 gap-1.5 text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <tab.icon className="h-3.5 w-3.5 hidden sm:block" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map(tab => (
            <TabsContent key={tab.id} value={tab.id} className="mt-4 space-y-3">
              {/* Tab description row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.description}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground font-mono">{lineCount} lines</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 gap-1.5 text-xs"
                    onClick={() => copy(tab.id)}
                  >
                    {copiedTab === tab.id ? (
                      <><Check className="h-3 w-3 text-emerald-600" /> Copied</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copy</>
                    )}
                  </Button>
                </div>
              </div>

              {/* Code block */}
              <div className="relative rounded-xl border bg-[#fafafa] overflow-hidden">
                {/* Line gutter stripe */}
                <div className="absolute left-0 top-0 bottom-0 w-10 bg-muted/40 border-r pointer-events-none" />
                <ScrollArea className="h-[400px]">
                  <div className="flex">
                    {/* Line numbers */}
                    <div className="w-10 shrink-0 select-none py-4 pr-2 text-right">
                      {JSON.stringify(schemas[tab.id as keyof typeof schemas], null, 2)
                        .split('\n')
                        .map((_, i) => (
                          <div key={i} className="text-[10px] text-muted-foreground/60 leading-[1.7] font-mono">
                            {i + 1}
                          </div>
                        ))}
                    </div>
                    {/* Code */}
                    <pre className="flex-1 py-4 pl-3 pr-4 overflow-x-auto">
                      <JsonHighlight json={JSON.stringify(schemas[tab.id as keyof typeof schemas], null, 2)} />
                    </pre>
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Footer note */}
        <div className="mt-4 pt-4 border-t">
          <div className="rounded-lg bg-muted/50 border px-4 py-2.5 flex items-start gap-2">
            <Code2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Integration note:</span> All monetary values are in cents (e.g.{' '}
              <code className="font-mono bg-muted px-1 rounded">1499</code> = $14.99).
              Use <code className="font-mono bg-muted px-1 rounded">externalId</code> to map to your POS discount IDs (Clover, Toast, Square).
              Timezone is inherited from location settings.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
