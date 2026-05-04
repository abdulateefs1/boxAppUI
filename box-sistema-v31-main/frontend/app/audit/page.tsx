"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollText, Search, Filter, X, Globe, Clock, User, Loader2 } from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { AuditLogEntry } from "@/lib/types"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

function getActionConfig(action: string) {
  if (action.includes("LOGIN")) {
    return { bgColor: "bg-teal-50", textColor: "text-teal-700", dotColor: "bg-teal-500" }
  }
  if (action.includes("OPENED") || action.includes("CREATED")) {
    return { bgColor: "bg-indigo-50", textColor: "text-indigo-700", dotColor: "bg-indigo-500" }
  }
  if (action.includes("CHANGED") || action.includes("UPDATED")) {
    return { bgColor: "bg-amber-50", textColor: "text-amber-700", dotColor: "bg-amber-500" }
  }
  if (action.includes("DELETED") || action.includes("CLOSED")) {
    return { bgColor: "bg-red-50", textColor: "text-red-700", dotColor: "bg-red-500" }
  }
  return { bgColor: "bg-slate-100", textColor: "text-slate-700", dotColor: "bg-slate-500" }
}

export default function AuditPage() {
  const [searchUser, setSearchUser] = useState("")
  const [searchAction, setSearchAction] = useState("")
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const list = await api.getAuditLogs()
      setLogs(list)
    } catch (e: any) {
      toast.error(e?.message || "Yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredLogs = useMemo(() => {
    const u = searchUser.trim().toLowerCase()
    const a = searchAction.trim().toLowerCase()
    return logs.filter((log) => {
      const who = `${log.by_name || ""} ${log.by_user || ""}`.toLowerCase()
      const actTxt = String(log.type || "").toLowerCase()
      if (u && !who.includes(u)) return false
      if (a && !actTxt.includes(a)) return false
      return true
    })
  }, [logs, searchUser, searchAction])

  const hasActiveFilters = searchUser || searchAction

  const clearFilters = () => {
    setSearchUser("")
    setSearchAction("")
  }

  return (
    <>
      <AppHeader
        title="Audit log"
        icon={<ScrollText className="h-4 w-4" />}
        action={
          <span className="text-sm text-muted-foreground">
            {loading ? "..." : `${filteredLogs.length} ta yozuv`}
          </span>
        }
      />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  <span>Filtrlar</span>
                </div>

                <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Foydalanuvchi..."
                      value={searchUser}
                      onChange={(e) => setSearchUser(e.target.value)}
                      className="h-9 pl-9"
                    />
                  </div>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Amal..."
                      value={searchAction}
                      onChange={(e) => setSearchAction(e.target.value)}
                      className="h-9 pl-9"
                    />
                  </div>

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                      Tozalash
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-16 text-center">
                  <ScrollText className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-muted-foreground">Mos yozuvlar topilmadi</p>
                  {hasActiveFilters && (
                    <Button variant="link" onClick={clearFilters} className="mt-2">
                      Filtrlarni tozalash
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredLogs.map((log) => {
                    const actionConfig = getActionConfig(String(log.type))
                    const when = log.at ? new Date(log.at).toLocaleString("uz-UZ") : "—"
                    const actor = log.by_name || log.by_user || "—"
                    const detal = log.details && typeof log.details === "object" ? log.details : {}

                    return (
                      <div key={String(log.id)} className="flex gap-4 p-4 transition-colors hover:bg-muted/30">
                        <div className="flex flex-col items-center pt-1">
                          <div className={cn("h-2.5 w-2.5 rounded-full", actionConfig.dotColor)} />
                          <div className="h-full w-px bg-border" />
                        </div>

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                                actionConfig.bgColor,
                                actionConfig.textColor
                              )}
                            >
                              {log.type}
                            </span>
                            <span className="font-semibold text-foreground">{actor}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {when}
                            </span>
                            <span className="flex items-center gap-1 font-mono">
                              <Globe className="h-3 w-3" />
                              {log.ip || "—"}
                            </span>
                          </div>

                          {Object.keys(detal).length > 0 && (
                            <code className="block rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
                              {JSON.stringify(detal, null, 2)}
                            </code>
                          )}
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
