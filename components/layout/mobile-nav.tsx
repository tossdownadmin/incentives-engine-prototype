'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Tag,
  ShoppingCart,
  UtensilsCrossed,
  MapPin,
  Settings,
  Menu,
  X,
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Offers', href: '/offers', icon: Tag },
  { name: 'Simulator', href: '/simulator', icon: ShoppingCart },
  { name: 'Menu Items', href: '/menu', icon: UtensilsCrossed },
  { name: 'Locations', href: '/locations', icon: MapPin },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden">
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold">Incentives</span>
        </Link>
        
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="font-semibold">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex flex-col gap-1 p-4">
              {navigation.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/' && pathname.startsWith(item.href))
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-primary'
                        : 'text-foreground hover:bg-accent'
                    )}
                  >
                    <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </header>
      
      {/* Spacer for fixed header */}
      <div className="h-14" />
    </div>
  )
}
