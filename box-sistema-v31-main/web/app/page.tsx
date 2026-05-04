"use client"

import { useEffect, useState } from "react"
import {
  Package,
  Warehouse,
  Truck,
  CheckCircle2,
  Trophy,
  TrendingUp,
  ArrowUpRight,
  Loader2,
} from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { api } from "@/lib/api"
import { ROLE_LABEL } from "@/lib/types"
import type { Box, RankingEntry, UserRole } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { toast } from "sonner"

const statsConfig = [
  {
    key: "packed" as const,
    label: "Qadoqlandi",
    description: "Bugun qadoqlangan",
    icon: Package,
    gradient: "from-teal-500 to-teal-600",
    bgLight: "bg-teal-50",
    textColor: "text-teal-600",
  },
  {
    key: "warehouse" as const,
    label: "Omborda",
    description: "Hozirda omborda",
    icon: Warehouse,
    gradient: "from-indigo-500 to-indigo-600",
    bgLight: "bg-indigo-50",
    textColor: "text-indigo-600",
  },
  {
    key: "shipping" as const,
    label: "Shipmentda",
    description: "Yuborishga tayyor",
    icon: Truck,
    gradient: "from-amber-500 to-amber-600",
    bgLight: "bg-amber-50",
    textColor: "text-amber-600",
  },
  {
    key: "shipped" as const,
    label: "Yuborilgan",
    description: "Jami yuborilgan",
    icon: CheckCircle2,
    gradient: "from-slate-500 to-slate-600",
    bgLight: "bg-slate-100",
    textColor: "text-slate-600",
  },
]

const roleStyle: Record<UserRole, string> = {
  admin: "bg-gradient-to-r from-amber-500 to-orange-500",
  storekeeper: "bg-gradient-to-r from-blue-500 to-indigo-500",
  worker: "bg-gradient-to-r from-slate-500 to-slate-600",
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [boxes, setBoxes] = useState<Box[]>([])
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let active = true
    Promise.all([api.getBoxes(), api.getRanking()])
      .then(([bs, r]) => {
        if (!active) return
        setBoxes(bs)
        setRanking(r.ranking || [])
      })
      .catch((e: any) => toast.error(e?.message || "Yuklab bo'lmadi"))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [user])

  if (!user) return null

  const stats = boxes.reduce(
    (acc, b) => {
      if (b.status in acc) (acc as any)[b.status]++
      return acc
    },
    { packed: 0, warehouse: 0, shipping: 0, shipped: 0 }
  )

  return (
    <>
      <AppHeader title="Bosh sahifa" />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" />
              <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-400">Xush kelibsiz</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-sm text-slate-500">Box Sistema v3</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{user.name}</h1>
                <p className="mt-1.5 text-slate-400">AND BILLUR TEXTILE</p>
              </div>

              <div
                className={cn(
                  "flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg",
                  roleStyle[user.role]
                )}
              >
                <span>{ROLE_LABEL[user.role]}</span>
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statsConfig.map((stat) => {
              const Icon = stat.icon
              const value = stats[stat.key]
              return (
                <Card
                  key={stat.key}
                  className="group relative overflow-hidden border-0 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className={cn("rounded-xl p-2.5", stat.bgLight)}>
                        <Icon className={cn("h-5 w-5", stat.textColor)} />
                      </div>
                      <div
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100",
                          stat.bgLight
                        )}
                      >
                        <TrendingUp className={cn("h-3.5 w-3.5", stat.textColor)} />
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-3xl font-bold tracking-tight text-foreground">
                        {loading ? "—" : formatNumber(value)}
                      </div>
                      <div className="mt-1 text-sm font-medium text-muted-foreground">{stat.label}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground/70">{stat.description}</div>
                    </div>
                    <div
                      className={cn(
                        "absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r opacity-0 transition-opacity group-hover:opacity-100",
                        stat.gradient
                      )}
                    />
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
                  <Trophy className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Bugungi Reyting</h2>
                  <p className="text-xs text-muted-foreground">Eng ko&apos;p box qadoqlaganlar</p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !ranking.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Bugun hali box yo&apos;q</p>
              ) : (
                <div className="space-y-2">
                  {ranking.slice(0, 10).map((entry, index) => {
                    const isMe = entry.username === user.username
                    const medals = [
                      "bg-gradient-to-br from-amber-400 to-amber-600",
                      "bg-gradient-to-br from-slate-300 to-slate-500",
                      "bg-gradient-to-br from-orange-400 to-orange-600",
                    ]

                    return (
                      <div
                        key={entry.username + index}
                        className={cn(
                          "group flex items-center gap-4 rounded-xl p-3.5 transition-all duration-200",
                          isMe ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : "hover:bg-muted/50"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                            index < 3
                              ? `${medals[index]} text-white shadow-md`
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground truncate">{entry.name}</span>
                            {isMe && (
                              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                                Siz
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">@{entry.username}</span>
                        </div>

                        <div className="text-right">
                          <div className="text-xl font-bold tabular-nums text-primary">{entry.count}</div>
                          <div className="text-xs tabular-nums text-muted-foreground">
                            {formatNumber(entry.total)} dona
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
