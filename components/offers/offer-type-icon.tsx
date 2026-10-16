import { cn } from '@/lib/utils'
import type { OfferType } from '@/lib/types'
import { Percent, DollarSign, Package, Gift, Truck } from 'lucide-react'

const iconMap = {
  percentage: Percent,
  flat: DollarSign,
  bundle: Package,
  bogo: Gift,
  free_delivery: Truck,
}

const colorMap = {
  percentage: 'bg-blue-100 text-blue-600',
  flat: 'bg-green-100 text-green-600',
  bundle: 'bg-purple-100 text-purple-600',
  bogo: 'bg-amber-100 text-amber-600',
  free_delivery: 'bg-cyan-100 text-cyan-700',
}

interface OfferTypeIconProps {
  type: OfferType
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function OfferTypeIcon({ type, size = 'md', className }: OfferTypeIconProps) {
  const Icon = iconMap[type]
  
  const sizeClasses = {
    sm: 'h-6 w-6 p-1',
    md: 'h-8 w-8 p-1.5',
    lg: 'h-10 w-10 p-2',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }
  
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg',
        sizeClasses[size],
        colorMap[type],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
    </div>
  )
}
