'use client'

import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { Copy, Check, FileJson, Code2, Braces, Zap, Info } from 'lucide-react'
import type { Offer } from '@/lib/types'
import { OFFER_TYPE_CONFIG, CHANNEL_CONFIG } from '@/lib/constants'

interface OfferJsonDialogProps {
  offer: Offer | null
  storedRecord?: unknown
  open: boolean
  onOpenChange: (open: boolean) => void
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

function buildDiscount(offer: Offer) {
  switch (offer.type) {
    case 'percentage':
      return compact({
        method: 'percentage',
        rate: offer.discountValue,
        unit: 'percent',
        cap: offer.rules.maxDiscount ?? null,
      })
    case 'flat':
      return compact({
        method: 'fixed_amount',
        amount: offer.discountValue,
        unit: 'cents',
      })
    case 'bundle':
      return compact({
        method: 'bundle_price',
        fixedPrice: offer.bundlePrice,
        unit: 'cents',
        requiredItems: offer.bundleItems ?? [],
      })
    case 'bogo':
      return compact({
        method: 'buy_x_get_y',
        buyQuantity: offer.buyQuantity,
        getQuantity: offer.getQuantity,
        getDiscount: offer.getItemDiscount,
        unit: 'percent',
        buySkus: offer.bogoItems && offer.bogoItems.length > 0 ? offer.bogoItems : '*',
        rewardSkus: offer.bogoRewardItems && offer.bogoRewardItems.length > 0 ? offer.bogoRewardItems : '*',
      })
    case 'free_delivery':
      return { method: 'free_delivery' }
  }
}

function buildFullSchema(offer: Offer) {
  const typeLabel = OFFER_TYPE_CONFIG[offer.type].label

  return {
    // ── Identity ────────────────────────────────────────────────
    id: offer.id,
    externalId: null,            // Map to Clover/Toast/Square discount ID here
    name: offer.name,
    description: offer.description || null,

    // ── Display (used by POS receipt, kiosk UI, web order summary)
    display: {
      label: offer.name,
      shortLabel: offer.name.length > 20 ? offer.name.slice(0, 17) + '...' : offer.name,
      type: typeLabel,
      receiptLine: `DISC: ${offer.name.toUpperCase().slice(0, 36)}`,
      badgeColor: offer.type === 'bogo' ? '#e51451' : '#2563eb',
    },

    // ── Discount ─────────────────────────────────────────────────
    // All monetary values in cents. Engine uses integer arithmetic
    // to stay deterministic and match POS rounding.
    discount: buildDiscount(offer),

    // ── Eligibility Rules ─────────────────────────────────────────
    rules: compact({
      minCartTotal: offer.rules.minSpend ?? null,     // cents
      maxDiscountCap: offer.rules.maxDiscount ?? null, // cents (percentage offers only)
      includedSkus: offer.rules.includedItems ?? null,
      excludedSkus: offer.rules.excludedItems ?? null,
      includedCategories: offer.rules.includedCategories ?? null,
      excludedCategories: offer.rules.excludedCategories ?? null,
    }),

    // ── Schedule ──────────────────────────────────────────────────
    // Timezone is inherited from location settings
    schedule: {
      startDate: offer.schedule.startDate,     // ISO-8601
      endDate: offer.schedule.endDate ?? null, // null = no expiry
      // daysOfWeek: 0=Sun … 6=Sat. Omitted means all days.
      daysOfWeek: offer.schedule.daysOfWeek && offer.schedule.daysOfWeek.length > 0
        ? offer.schedule.daysOfWeek.map(d => ['SUN','MON','TUE','WED','THU','FRI','SAT'][d])
        : '*',
      // Each window is evaluated against the location's local time.
      timeWindows: offer.schedule.timeWindows && offer.schedule.timeWindows.length > 0
        ? offer.schedule.timeWindows.map(tw => ({ from: tw.startTime, to: tw.endTime }))
        : '*',
    },

    // ── Targeting ─────────────────────────────────────────────────
    targeting: {
      // Channels the offer is active on. '*' means all.
      channels: offer.targeting.channels.includes('all')
        ? '*'
        : offer.targeting.channels.map(c => CHANNEL_CONFIG[c].label),
      // Location IDs. '*' means all locations.
      locationIds: offer.targeting.locations.length > 0
        ? offer.targeting.locations
        : '*',
      // v1 always public — no CRM or loyalty lookup required.
      audience: 'PUBLIC',
    },

    // ── Limits & Safety ──────────────────────────────────────────
    limits: compact({
      // null = unlimited
      maxTotalRedemptions: offer.limits.maxRedemptions ?? null,
      maxPerTransaction: offer.limits.maxPerTransaction ?? null,
      // Future: maxPerCustomer (requires CRM)
      maxPerCustomer: null,
      currentRedemptions: offer.limits.currentRedemptions,
    }),

    // ── Stacking (v1: single best-offer only) ────────────────────
    stacking: {
      stackable: offer.isStackable ?? false,
      strategy: 'BEST_OFFER',   // Engine picks highest cart-level savings
      exclusionGroup: null,      // Future: group ID to prevent same-group stacking
      priority: offer.priority,  // Higher number wins tie-breaks
    },

    // ── Lifecycle ─────────────────────────────────────────────────
    status: offer.status.toUpperCase(),
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
  }
}

function buildMinimal(offer: Offer) {
  return {
    id: offer.id,
    name: offer.name,
    type: offer.type,
    status: offer.status,
    discount: buildDiscount(offer),
    rules: compact({
      minCartTotal: offer.rules.minSpend ?? undefined,
      categories: offer.rules.includedCategories && offer.rules.includedCategories.length > 0
        ? offer.rules.includedCategories
        : undefined,
    }),
    schedule: {
      start: offer.schedule.startDate,
      end: offer.schedule.endDate ?? null,
    },
    channels: offer.targeting.channels.includes('all') ? '*' : offer.targeting.channels,
    locations: offer.targeting.locations.length > 0 ? offer.targeting.locations : '*',
    priority: offer.priority,
  }
}

function buildApiPayload(offer: Offer) {
  return {
    data: {
      type: 'offer',
      id: offer.id,
      attributes: {
        name: offer.name,
        description: offer.description || null,
        offerType: offer.type,
        status: offer.status,
        priority: offer.priority,
        discountConfig: buildDiscount(offer),
        rules: {
          minSpend: offer.rules.minSpend ?? null,
          maxDiscountCap: offer.rules.maxDiscount ?? null,
          includedCategories: offer.rules.includedCategories ?? null,
          includedSkus: offer.rules.includedItems ?? null,
          excludedSkus: offer.rules.excludedItems ?? null,
        },
        schedule: {
          startDate: offer.schedule.startDate,
          endDate: offer.schedule.endDate ?? null,
          daysOfWeek: offer.schedule.daysOfWeek ?? null,
          timeWindows: offer.schedule.timeWindows ?? null,
        },
        targeting: {
          channels: offer.targeting.channels,
          locationIds: offer.targeting.locations.length > 0 ? offer.targeting.locations : null,
        },
        limits: {
          maxRedemptions: offer.limits.maxRedemptions ?? null,
          maxPerTransaction: offer.limits.maxPerTransaction ?? null,
        },
      },
      meta: {
        currentRedemptions: offer.limits.currentRedemptions,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt,
      },
    },
  }
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
    id: 'stored',
    label: 'Stored Record',
    icon: FileJson,
    description: 'The exact record returned by the configured storage system.',
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

export function OfferJsonDialog({ offer, storedRecord, open, onOpenChange }: OfferJsonDialogProps) {
  const [copiedTab, setCopiedTab] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('stored')

  const schemas = useMemo(() => {
    if (!offer) return { stored: {}, full: {}, minimal: {}, api: {} }
    return {
      stored: storedRecord ?? offer,
      full: buildFullSchema(offer),
      minimal: buildMinimal(offer),
      api: buildApiPayload(offer),
    }
  }, [offer, storedRecord])

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

  if (!offer) return null

  const currentTabMeta = TABS.find(t => t.id === activeTab)!
  const currentContent = schemas[activeTab as keyof typeof schemas]
  const lineCount = JSON.stringify(currentContent, null, 2).split('\n').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full p-0 gap-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0 mt-0.5">
              <FileJson className="h-4.5 w-4.5 text-primary" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold leading-tight">
                JSON Schema
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {offer.name}
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="font-mono text-xs h-6">v1.0</Badge>
            <Badge
              className="text-xs h-6 capitalize"
              style={{
                backgroundColor: offer.status === 'active' ? '#dcfce7' : offer.status === 'paused' ? '#fee2e2' : '#f3f4f6',
                color: offer.status === 'active' ? '#166534' : offer.status === 'paused' ? '#991b1b' : '#374151',
                border: 'none',
              }}
            >
              {offer.status}
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="px-6 pt-4 pb-0">
            <TabsList className="h-9 p-0.5 bg-muted/60 gap-0.5">
              {TABS.map(tab => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="h-8 px-3 gap-1.5 text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {TABS.map(tab => (
            <TabsContent key={tab.id} value={tab.id} className="flex flex-col flex-1 mt-0 px-6 pb-6">

              {/* Tab description row */}
              <div className="flex items-center justify-between py-3 gap-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.description}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground font-mono">{lineCount} lines</span>
                  <Button
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
                <ScrollArea className="h-[420px]">
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

        {/* Footer */}
        <div className="px-6 pb-5 pt-0">
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

      </DialogContent>
    </Dialog>
  )
}
