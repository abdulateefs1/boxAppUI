"use client"

import { usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { useAuth } from "@/lib/auth-context"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const isLogin = pathname === "/login"

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isLogin || !user) {
    return <>{children}</>
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col">{children}</SidebarInset>
    </SidebarProvider>
  )
}
