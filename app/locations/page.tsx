'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { useLocations } from '@/hooks/use-locations'
import { useBusinessLocations } from '@/hooks/use-business-locations'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  MapPin
} from 'lucide-react'

export default function LocationsPage() {
  const local = useLocations()
  const { locations, isBusinessSource, isLoading: businessLocationsLoading, error: businessLocationsError } = useBusinessLocations(local.locations)
  const { addLocation, updateLocation, deleteLocation, isLoaded } = local
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<typeof locations[0] | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formActive, setFormActive] = useState(true)

  const openCreateDialog = () => {
    setEditingLocation(null)
    setFormName('')
    setFormAddress('')
    setFormActive(true)
    setIsDialogOpen(true)
  }

  const openEditDialog = (location: typeof locations[0]) => {
    setEditingLocation(location)
    setFormName(location.name)
    setFormAddress(location.address || '')
    setFormActive(location.active)
    setIsDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formName.trim()) {
      toast.error('Please enter a location name')
      return
    }

    const locationData = {
      name: formName.trim(),
      address: formAddress.trim() || undefined,
      active: formActive
    }

    if (editingLocation) {
      updateLocation(editingLocation.id, locationData)
      toast.success('Location updated')
    } else {
      addLocation(locationData)
      toast.success('Location added')
    }

    setIsDialogOpen(false)
  }

  const handleDelete = () => {
    if (deleteId) {
      const location = locations.find(l => l.id === deleteId)
      deleteLocation(deleteId)
      toast.success('Location deleted', {
        description: `"${location?.name}" has been removed`
      })
      setDeleteId(null)
    }
  }

  if (!isLoaded || businessLocationsLoading) {
    return (
      <AppShell title="Locations">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell 
      title="Locations" 
      description={isBusinessSource ? 'Business locations loaded from Ordrz' : 'Manage your restaurant locations'}
      actions={!isBusinessSource ? (
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      ) : undefined}
    >
      {isBusinessSource && (
        <p className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          These locations come from your Ordrz business account. Manage location details in Ordrz.
        </p>
      )}
      {businessLocationsError && (
        <p role="status" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
          Could not load Ordrz business locations: {businessLocationsError}
        </p>
      )}
      {locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No locations"
          description={isBusinessSource ? 'No business locations were returned by Ordrz.' : 'Add your first location to enable location-based targeting'}
          action={!isBusinessSource ? (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <Card key={location.id} className={!location.active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{location.name}</h3>
                        <Badge variant={location.active ? 'default' : 'secondary'}>
                          {location.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {location.address && (
                        <p className="text-sm text-muted-foreground mt-1">{location.address}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isBusinessSource && <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(location)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>}
                    {!isBusinessSource && <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(location.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {!isBusinessSource && <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
              <DialogDescription>
                {editingLocation ? 'Update the location details' : 'Add a new restaurant location'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Location Name</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Downtown Main"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address (optional)</Label>
                <Input
                  id="address"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="active">Active</Label>
                <Switch
                  id="active"
                  checked={formActive}
                  onCheckedChange={setFormActive}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingLocation ? 'Save Changes' : 'Add Location'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>}

      {/* Delete Confirmation */}
      {!isBusinessSource && <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this location? Offers targeting this location will no longer apply here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
    </AppShell>
  )
}
