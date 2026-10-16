import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/engine'

interface PriceDisplayProps {
  cents: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function PriceDisplay({ cents, className, size = 'md' }: PriceDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
  }

  return (
    <span className={cn(sizeClasses[size], className)}>
      {formatCurrency(cents)}
    </span>
  )
}

interface DiscountedPriceProps {
  originalCents: number
  discountedCents: number
  className?: string
}

export function DiscountedPrice({ originalCents, discountedCents, className }: DiscountedPriceProps) {
  const hasSavings = discountedCents < originalCents

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {hasSavings && (
        <span className="text-sm text-muted-foreground line-through">
          {formatCurrency(originalCents)}
        </span>
      )}
      <span className={cn('font-semibold', hasSavings && 'text-primary')}>
        {formatCurrency(discountedCents)}
      </span>
    </div>
  )
}

interface SavingsBadgeProps {
  cents: number
  className?: string
}

export function SavingsBadge({ cents, className }: SavingsBadgeProps) {
  if (cents <= 0) return null

  return (
    <span className={cn(
      'inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
      className
    )}>
      Save {formatCurrency(cents)}
    </span>
  )
}
