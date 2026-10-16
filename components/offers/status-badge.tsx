import { cn } from '@/lib/utils'
import type { OfferStatus } from '@/lib/types'
import { STATUS_CONFIG } from '@/lib/constants'

interface StatusBadgeProps {
  status: OfferStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  )
}
