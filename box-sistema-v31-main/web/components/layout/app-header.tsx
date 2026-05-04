"use client"

import { useEffect, useState } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth-context"
import { usePathname } from "next/navigation"

interface AppHeaderProps {
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function AppHeader({ title, icon, action }: AppHeaderProps) {
  const { user } = useAuth()
  const pathname = usePathname()
  const [dateStr, setDateStr] = useState("")

  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString("uz-UZ", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    )
  }, [])

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur-md">
      {pathname !== "/login" ? (
        <SidebarTrigger className="-ml-1 h-8 w-8 text-muted-foreground hover:text-foreground" />
      ) : null}
      {pathname !== "/login" ? <Separator orientation="vertical" className="h-5" /> : null}
      <div className="flex flex-1 items-center gap-2.5">
        {icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <h1 className="text-base font-semibold tracking-tight text-foreground">{title}</h1>
      </div>
      {user && pathname !== "/login" && (
        <div className="hidden items-end text-right text-xs text-muted-foreground sm:flex sm:flex-col">
          <span className="font-medium text-foreground">{user.name}</span>
          {dateStr ? <span>{dateStr}</span> : <span className="opacity-0">—</span>}
        </div>
      )}
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  )
}
