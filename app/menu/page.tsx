'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { EmptyState } from '@/components/shared/empty-state'
import { PriceDisplay } from '@/components/shared/price-display'
import { useMenuItems } from '@/hooks/use-menu-items'
import { formatCurrency } from '@/lib/engine'
import { MENU_CATEGORIES } from '@/lib/constants'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  UtensilsCrossed
} from 'lucide-react'

const menuFallbackImage = (category: string) => {
  const value = category.toLowerCase()
  if (value.includes('drink') || value.includes('energy')) return '/menu/drink.svg'
  if (value.includes('fries') || value.includes('side')) return '/menu/fries.svg'
  if (value.includes('dumpling') || value.includes('noodle')) return '/menu/pizza.svg'
  if (value.includes('wing') || value.includes('starter') || value.includes('lollipop')) return '/menu/wings.svg'
  if (value.includes('dessert')) return '/menu/dessert.svg'
  return '/menu/burger.svg'
}

export default function MenuPage() {
  const { items, categories, addItem, updateItem, deleteItem, isLoaded, apiLoaded, apiStatus, apiError } = useMenuItems()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<typeof items[0] | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formSku, setFormSku] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formAvailable, setFormAvailable] = useState(true)

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const openCreateDialog = () => {
    setEditingItem(null)
    setFormName('')
    setFormSku('')
    setFormCategory(categories[0] || MENU_CATEGORIES[0] || '')
    setFormPrice('')
    setFormAvailable(true)
    setIsDialogOpen(true)
  }

  const openEditDialog = (item: typeof items[0]) => {
    setEditingItem(item)
    setFormName(item.name)
    setFormSku(item.sku)
    setFormCategory(item.category)
    setFormPrice((item.price / 100).toFixed(2))
    setFormAvailable(item.available)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formName.trim() || !formSku.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    const priceInCents = Math.round(parseFloat(formPrice) * 100)
    if (isNaN(priceInCents) || priceInCents <= 0) {
      toast.error('Please enter a valid price')
      return
    }

    const itemData = {
      name: formName.trim(),
      sku: formSku.trim().toUpperCase(),
      category: formCategory,
      price: priceInCents,
      available: formAvailable
    }

    try {
      if (editingItem) {
        await updateItem(editingItem.id, itemData)
        toast.success(apiStatus?.itemsConfigured ? 'Item updated in Ordrz' : 'Menu item updated')
      } else {
        await addItem(itemData)
        toast.success(apiStatus?.addItemConfigured ? 'Item added to Ordrz' : 'Menu item added')
      }
      setIsDialogOpen(false)
    } catch (error) {
      toast.error('Could not add menu item', {
        description: error instanceof Error ? error.message : 'Please check the Ordrz API configuration and try again.',
      })
    }
  }

  const handleDelete = async () => {
    if (deleteId) {
      const item = items.find(i => i.id === deleteId)
      try {
        await deleteItem(deleteId)
        toast.success(apiStatus?.itemsConfigured ? 'Item deleted from Ordrz' : 'Menu item deleted', {
          description: `"${item?.name}" has been removed`
        })
        setDeleteId(null)
      } catch (error) {
        toast.error('Could not delete menu item', { description: error instanceof Error ? error.message : 'Please retry.' })
      }
    }
  }

  if (!isLoaded || !apiLoaded) {
    return (
      <AppShell title="Menu Items">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell 
      title="Menu Items" 
      description={apiStatus?.productsConfigured ? 'Products and categories are loaded from Ordrz for discount setup.' : 'Manage your restaurant menu for offer testing'}
      actions={
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      }
    >
      {apiError && (
        <div role="status" className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Ordrz catalog could not be loaded: {apiError}
        </div>
      )}
      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title={search || categoryFilter !== 'all' ? 'No items found' : 'No menu items'}
          description={
            search || categoryFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Add your first menu item to get started'
          }
          action={
            !search && categoryFilter === 'all' && (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className={!item.available ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <img
                    src={item.image || menuFallbackImage(item.category)}
                    alt=""
                    className="mr-3 h-16 w-16 shrink-0 rounded-lg border border-border/60 bg-muted object-cover"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.onerror = null
                      event.currentTarget.src = menuFallbackImage(item.category)
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{item.name}</h3>
                      {!item.available && (
                        <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{item.sku}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <PriceDisplay cents={item.price} size="lg" />
                      <Badge variant="outline">{item.category}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
              <DialogDescription>
                {editingItem ? 'Update the menu item details' : 'Add a new item to your menu'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Menu item name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  placeholder="SKU-001"
                />
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set([...categories, ...MENU_CATEGORIES])).map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="pl-7"
                      placeholder="14.99"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="available">Available</Label>
                <Switch
                  id="available"
                  checked={formAvailable}
                  onCheckedChange={setFormAvailable}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingItem ? 'Save Changes' : 'Add Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Menu Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this menu item? This may affect offers that use this item.
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
    </AppShell>
  )
}
