'use client'

import { Sidebar } from './sidebar'
import { MobileNav } from './mobile-nav'

interface AppShellProps {
  children: React.ReactNode
  title?: string
  description?: string
  actions?: React.ReactNode
}

export function AppShell({ children, title, description, actions }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      
      {/* Mobile Navigation */}
      <MobileNav />
      
      {/* Main Content */}
      <main className="lg:pl-64 transition-all duration-300">
        <div className="min-h-screen">
          {/* Page Header */}
          {(title || actions) && (
            <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:top-0">
              <div className="flex h-16 items-center justify-between px-4 lg:px-8">
                <div>
                  {title && (
                    <h1 className="text-lg font-semibold text-foreground lg:text-xl">{title}</h1>
                  )}
                  {description && (
                    <p className="text-sm text-muted-foreground hidden sm:block">{description}</p>
                  )}
                </div>
                {actions && (
                  <div className="flex items-center gap-2">
                    {actions}
                  </div>
                )}
              </div>
            </header>
          )}
          
          {/* Page Content */}
          <div className="p-4 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

export function PageHeader({ 
  title, 
  description, 
  actions 
}: { 
  title: string
  description?: string
  actions?: React.ReactNode 
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
