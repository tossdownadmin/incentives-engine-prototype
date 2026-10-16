'use client'

import { useState, useRef } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useSettings } from '@/hooks/use-settings'
import { useOffers } from '@/hooks/use-offers'
import { useMenuItems } from '@/hooks/use-menu-items'
import { useLocations } from '@/hooks/use-locations'
import { useCart } from '@/hooks/use-cart'
import { formatCurrency } from '@/lib/engine'
import { STORAGE_KEYS } from '@/lib/constants'
import { SAMPLE_OFFERS, SAMPLE_MENU_ITEMS, SAMPLE_LOCATIONS, SAMPLE_SETTINGS } from '@/lib/sample-data'
import { toast } from 'sonner'
import {
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Settings as SettingsIcon,
  Database,
  Info
} from 'lucide-react'

export default function SettingsPage() {
  const { settings, updateSettings, isLoaded } = useSettings()
  const { offers, setOffers } = useOffers()
  const { items: menuItems, setItems: setMenuItems } = useMenuItems()
  const { locations, setLocations } = useLocations()
  const { clearCart } = useCart()
  
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      offers,
      menuItems,
      locations,
      settings
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `incentives-engine-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Data exported', {
      description: 'Your data has been downloaded as a JSON file'
    })
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        
        if (data.offers) setOffers(data.offers)
        if (data.menuItems) setMenuItems(data.menuItems)
        if (data.locations) setLocations(data.locations)
        if (data.settings) updateSettings(data.settings)

        toast.success('Data imported', {
          description: 'Your data has been restored from the backup file'
        })
      } catch {
        toast.error('Import failed', {
          description: 'The file could not be parsed. Please ensure it is a valid export file.'
        })
      }
    }
    reader.readAsText(file)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClearAll = () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
    window.location.reload()
  }

  const handleResetToDefaults = () => {
    setOffers(SAMPLE_OFFERS)
    setMenuItems(SAMPLE_MENU_ITEMS)
    setLocations(SAMPLE_LOCATIONS)
    updateSettings(SAMPLE_SETTINGS)
    clearCart()
    toast.success('Data reset', {
      description: 'Menu and settings were reset; promotions are empty until you create them'
    })
    setShowResetDialog(false)
  }

  if (!isLoaded) {
    return (
      <AppShell title="Settings">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell 
      title="Settings" 
      description="Configure the incentives engine"
    >
      <div className="grid gap-6 max-w-3xl">
        {/* Default Values */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Default Values
            </CardTitle>
            <CardDescription>
              Set default values for new offers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defaultMaxDiscount">Default Max Discount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="defaultMaxDiscount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={(settings.defaultMaxDiscount / 100).toFixed(2)}
                    onChange={(e) => updateSettings({ 
                      defaultMaxDiscount: Math.round(parseFloat(e.target.value) * 100) 
                    })}
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Safety cap for percentage discounts
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultMaxRedemptions">Default Max Redemptions</Label>
                <Input
                  id="defaultMaxRedemptions"
                  type="number"
                  min="1"
                  value={settings.defaultMaxRedemptions}
                  onChange={(e) => updateSettings({ 
                    defaultMaxRedemptions: parseInt(e.target.value) 
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Default limit for new offers
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Pricing Configuration
            </CardTitle>
            <CardDescription>
              How prices and discounts are calculated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select 
                  value={settings.currency} 
                  onValueChange={(v) => updateSettings({ currency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (EUR)</SelectItem>
                    <SelectItem value="GBP">GBP (GBP)</SelectItem>
                    <SelectItem value="CAD">CAD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rounding">Rounding Mode</Label>
                <Select 
                  value={settings.roundingMode} 
                  onValueChange={(v) => updateSettings({ roundingMode: v as 'nearest' | 'floor' | 'ceil' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nearest">Round to Nearest</SelectItem>
                    <SelectItem value="floor">Round Down</SelectItem>
                    <SelectItem value="ceil">Round Up</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How cents are rounded in calculations
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="font-medium mb-2">Calculation Details</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>All prices are stored and calculated in cents (integers)</li>
                <li>Rounding occurs only at the final calculation step</li>
                <li>Discounts never exceed cart total</li>
                <li>Best offer is automatically selected when multiple apply</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Management
            </CardTitle>
            <CardDescription>
              Export, import, or reset your data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Import Data
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Danger Zone</h4>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setShowResetDialog(true)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset Workspace Defaults
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => setShowClearDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Data
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Data Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Data Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">{offers.length}</p>
                <p className="text-sm text-muted-foreground">Offers</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">{menuItems.length}</p>
                <p className="text-sm text-muted-foreground">Menu Items</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">{locations.length}</p>
                <p className="text-sm text-muted-foreground">Locations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reset Confirmation */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Workspace Defaults</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current data with the imported menu and default workspace settings. Promotions will be cleared until you create them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetToDefaults}>
              Reset Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Data</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all local data and reload the page. The imported menu will be restored and promotions will remain empty.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
