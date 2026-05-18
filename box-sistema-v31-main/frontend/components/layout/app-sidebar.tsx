"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  ScanBarcode,
  Package,
  FileBarChart2,
  Truck,
  ClipboardList,
  Users,
  ScrollText,
  UserCircle,
  LogOut,
  Diamond,
  ChevronRight,
  Sparkles,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/lib/auth-context"
import { USE_ERP_API } from "@/lib/config"
import { ROLE_LABEL, type UserRole } from "@/lib/types"
import { cn } from "@/lib/utils"

interface MenuItem {
  title: string
  href: string
  icon: typeof Home
  roles?: UserRole[]
}

const menuItems: MenuItem[] = [
  { title: "Bosh sahifa", href: "/", icon: Home },
  { title: "Barcode skan", href: "/barcode", icon: ScanBarcode },
  { title: "Boxlar", href: "/boxes", icon: Package },
  { title: "Detalniy", href: "/detalniy", icon: FileBarChart2, roles: ["admin", "storekeeper"] },
  { title: "Shipmentlar", href: "/shipments", icon: Truck, roles: ["admin", "storekeeper"] },
  { title: "Chat", href: "/chat", icon: Sparkles, roles: ["admin", "storekeeper"] },
  { title: "Orderlar", href: "/orders", icon: ClipboardList, roles: ["admin"] },
  { title: "Foydalanuvchilar", href: "/users", icon: Users, roles: ["admin"] },
  { title: "Audit log", href: "/audit", icon: ScrollText, roles: ["admin"] },
  { title: "Profil", href: "/profile", icon: UserCircle },
]

const roleClass: Record<UserRole, string> = {
  admin: "bg-amber-500/20 text-amber-400",
  storekeeper: "bg-blue-500/20 text-blue-400",
  worker: "bg-slate-500/20 text-slate-400",
}

export function AppSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const { user, logout } = useAuth()
  const isCollapsed = state === "collapsed"

  if (!user) return null

  const role = user.role
  const visibleItems = menuItems.filter((m) => {
    if (USE_ERP_API && (m.href === "/chat" || m.href === "/users")) return false
    return !m.roles || m.roles.includes(role)
  })

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-sidebar">
      <SidebarHeader className="p-3">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-sidebar-accent",
            isCollapsed && "justify-center p-2"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/25">
            <Diamond className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">AND BILLUR</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/50">
                Box Sistema v3
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "group relative h-9 gap-3 rounded-lg font-medium transition-all duration-200",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <Link href={item.href}>
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0 transition-colors",
                            isActive && "text-sidebar-primary"
                          )}
                        />
                        <span className="truncate">{item.title}</span>
                        {isActive && !isCollapsed && (
                          <ChevronRight className="ml-auto h-4 w-4 text-sidebar-primary/60" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg bg-sidebar-accent/50 p-2.5 backdrop-blur-sm",
            isCollapsed && "justify-center p-2"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary to-teal-600 text-xs font-semibold text-white shadow-md">
            {(user.name || user.username).charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</span>
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  roleClass[role]
                )}
              >
                {ROLE_LABEL[role]}
              </span>
            </div>
          )}
        </div>

        <SidebarMenu className="mt-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => logout()}
              tooltip="Chiqish"
              className="h-9 gap-3 rounded-lg font-medium text-sidebar-foreground/60 transition-all hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-[18px] w-[18px]" />
              <span>Chiqish</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
