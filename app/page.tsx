'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { StatCard } from '@/components/dashboard/stat-card'
import { StatusBadge } from '@/components/offers/status-badge'
import { OfferTypeIcon } from '@/components/offers/offer-type-icon'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useOffers } from '@/hooks/use-offers'
import { formatCurrency } from '@/lib/engine'
import { OFFER_TYPE_CONFIG } from '@/lib/constants'
import {
  Tag,
  TrendingUp,
  DollarSign,
  Clock,
  Plus,
  ArrowRight,
  Percent,
  Package,
  Gift,
  Truck,
} from 'lucide-react'

export default function DashboardPage() {
  const { offers, isLoaded } = useOffers()

  const stats = useMemo(() => {
    const activeOffers = offers.filter(o => o.status === 'active')
    const totalRedemptions = offers.reduce((sum, o) => sum + o.limits.currentRedemptions, 0)
    
    // Estimate savings (simplified calculation)
    const estimatedSavings = offers.reduce((sum, o) => {
      if (o.type === 'percentage') {
        return sum + (o.limits.currentRedemptions * 1500 * (o.discountValue / 100)) // Assume avg $15 order
      } else if (o.type === 'flat') {
        return sum + (o.limits.currentRedemptions * o.discountValue)
      } else if (o.type === 'bundle') {
        return sum + (o.limits.currentRedemptions * 500) // Assume avg $5 bundle savings
      } else if (o.type === 'bogo') {
        return sum + (o.limits.currentRedemptions * 1000) // Assume avg $10 BOGO savings
      }
      return sum // Delivery-fee savings depend on each location's delivery fee.
    }, 0)

    const scheduledOffers = offers.filter(o => o.status === 'scheduled')

    return {
      activeOffers: activeOffers.length,
      totalRedemptions,
      estimatedSavings,
      scheduledOffers: scheduledOffers.length
    }
  }, [offers])

  const recentOffers = useMemo(() => {
    return [...offers]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
  }, [offers])

  const offersByType = useMemo(() => {
    return {
      percentage: offers.filter(o => o.type === 'percentage').length,
      flat: offers.filter(o => o.type === 'flat').length,
      bundle: offers.filter(o => o.type === 'bundle').length,
      bogo: offers.filter(o => o.type === 'bogo').length,
      free_delivery: offers.filter(o => o.type === 'free_delivery').length,
    }
  }, [offers])

  if (!isLoaded) {
    return (
      <AppShell title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell 
      title="Dashboard" 
      description="Overview of your incentives engine"
      actions={
        <Link href="/offers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Offer
          </Button>
        </Link>
      }
    >
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Active Offers"
          value={stats.activeOffers}
          description="Currently running promotions"
          icon={Tag}
        />
        <StatCard
          title="Total Redemptions"
          value={stats.totalRedemptions.toLocaleString()}
          description="All-time usage"
          icon={TrendingUp}
        />
        <StatCard
          title="Customer Savings"
          value={formatCurrency(stats.estimatedSavings)}
          description="Estimated total savings"
          icon={DollarSign}
        />
        <StatCard
          title="Scheduled"
          value={stats.scheduledOffers}
          description="Upcoming offers"
          icon={Clock}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Offers */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Recent Offers</CardTitle>
            <Link href="/offers">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOffers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No offers yet. Create your first offer to get started.
                </p>
              ) : (
                recentOffers.map((offer) => (
                  <Link
                    key={offer.id}
                    href={`/offers/${offer.id}`}
                    className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                  >
                    <OfferTypeIcon type={offer.type} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{offer.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {OFFER_TYPE_CONFIG[offer.type].label}
                        {offer.type === 'percentage' && ` - ${offer.discountValue}% off`}
                        {offer.type === 'flat' && ` - ${formatCurrency(offer.discountValue)} off`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium">{offer.limits.currentRedemptions}</p>
                        <p className="text-xs text-muted-foreground">redemptions</p>
                      </div>
                      <StatusBadge status={offer.status} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Offers by Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Offers by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                    <Percent className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium">Percentage</span>
                </div>
                <span className="text-lg font-semibold">{offersByType.percentage}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-sm font-medium">Flat Discount</span>
                </div>
                <span className="text-lg font-semibold">{offersByType.flat}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                    <Package className="h-4 w-4 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium">Bundle</span>
                </div>
                <span className="text-lg font-semibold">{offersByType.bundle}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                    <Gift className="h-4 w-4 text-amber-600" />
                  </div>
                  <span className="text-sm font-medium">Buy X Get Y</span>
                </div>
                <span className="text-lg font-semibold">{offersByType.bogo}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100">
                    <Truck className="h-4 w-4 text-cyan-700" />
                  </div>
                  <span className="text-sm font-medium">Free Shipping</span>
                </div>
                <span className="text-lg font-semibold">{offersByType.free_delivery}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/offers/new">
              <Button variant="outline" className="w-full justify-start h-auto py-4">
                <Plus className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Create Offer</p>
                  <p className="text-xs text-muted-foreground">Add a new promotion</p>
                </div>
              </Button>
            </Link>
            <Link href="/simulator">
              <Button variant="outline" className="w-full justify-start h-auto py-4">
                <TrendingUp className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Test Offers</p>
                  <p className="text-xs text-muted-foreground">Open cart simulator</p>
                </div>
              </Button>
            </Link>
            <Link href="/menu">
              <Button variant="outline" className="w-full justify-start h-auto py-4">
                <Package className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Manage Menu</p>
                  <p className="text-xs text-muted-foreground">Edit menu items</p>
                </div>
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="outline" className="w-full justify-start h-auto py-4">
                <Clock className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Settings</p>
                  <p className="text-xs text-muted-foreground">Configure engine</p>
                </div>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
