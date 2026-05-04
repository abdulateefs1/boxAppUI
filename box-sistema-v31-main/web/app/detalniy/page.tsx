"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FileSpreadsheet, Download, Search, Package, Filter, X, Loader2 } from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ALL_SIZES, type Box, type DetalniyGroup } from "@/lib/types"
import { api } from "@/lib/api"
import { formatNumber, cn, totalPiecesOfBox } from "@/lib/utils"
import { toast } from "sonner"

export default function DetalniyPage() {
  const [zakazFilter, setZakazFilter] = useState("")
  const [modelFilter, setModelFilter] = useState("")
  const [groups, setGroups] = useState<DetalniyGroup[]>([])
  const [warehouseBoxes, setWarehouseBoxes] = useState<Box[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [g, all] = await Promise.all([
        api.getDetalniy(zakazFilter.trim() || undefined, modelFilter.trim() || undefined),
        api.getBoxes(),
      ])
      setGroups(g)
      setWarehouseBoxes(all.filter((b) => b.status === "warehouse"))
    } catch (e: any) {
      toast.error(e?.message || "Yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [zakazFilter, modelFilter])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => void load(), 300)
    return () => clearTimeout(t)
  }, [load])

  const totalBoxes = warehouseBoxes.length
  const totalDona = warehouseBoxes.reduce((s, b) => s + totalPiecesOfBox(b), 0)

  const tableRows = useMemo(() => {
    type Row = {
      key: string
      model: string
      color: string
      nomer: string
      spec: number
      sizes: Record<string, number>
      rowIndex: number
      isFirst: boolean
    }
    const rows: Row[] = []
    groups.forEach((g, gi) => {
      const sizeRows = (g.boxes || []).map((b) => {
        if (b.type === "mix") {
          const item = (b.items || []).find(
            (it) =>
              String(it.model || "").trim().toLowerCase() === String(g.model || "").trim().toLowerCase() &&
              String(it.color || "").trim().toLowerCase() === String(g.color || "").trim().toLowerCase()
          )
          return (item?.sizes || {}) as Record<string, number>
        }
        return (b.sizes || {}) as Record<string, number>
      })
      const spec = sizeRows.length || 1
      sizeRows.forEach((rs, idx) => {
        rows.push({
          key: `${gi}-${idx}-${g.zakaz}-${g.model}-${g.color}`,
          model: g.model,
          color: g.color,
          nomer: String(g.zakaz),
          spec,
          sizes: rs || {},
          rowIndex: idx,
          isFirst: idx === 0,
        })
      })
    })
    return rows
  }, [groups])

  const handleExportExcel = async () => {
    try {
      await api.downloadDetalniyExcel(zakazFilter.trim() || undefined, modelFilter.trim() || undefined)
      toast.success("Excel yuklandi")
    } catch (e: any) {
      toast.error(e?.message || "Yuklab bo'lmadi")
    }
  }

  const hasActiveFilters = zakazFilter || modelFilter
  const clearFilters = () => {
    setZakazFilter("")
    setModelFilter("")
  }

  return (
    <>
      <AppHeader
        title="Detalniy"
        icon={<FileSpreadsheet className="h-4 w-4" />}
        action={
          <Button onClick={handleExportExcel} size="sm" className="h-8 gap-1.5 bg-teal-600 hover:bg-teal-700">
            <Download className="h-3.5 w-3.5" />
            Excel
          </Button>
        }
      />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                  <Package className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums text-foreground">
                    {loading ? "—" : formatNumber(totalBoxes)}
                  </div>
                  <div className="text-sm text-muted-foreground">Jami karobka omborda</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100">
                  <FileSpreadsheet className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums text-foreground">
                    {loading ? "—" : formatNumber(totalDona)}
                  </div>
                  <div className="text-sm text-muted-foreground">Jami dona</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  <span>Filtrlar</span>
                </div>

                <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Zakaz..."
                      value={zakazFilter}
                      onChange={(e) => setZakazFilter(e.target.value)}
                      className="h-9 pl-9"
                    />
                  </div>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Model..."
                      value={modelFilter}
                      onChange={(e) => setModelFilter(e.target.value)}
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

          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="sticky left-0 z-10 whitespace-nowrap bg-muted/30 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Model
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Rang
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Nomer
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Spetsifika
                      </th>
                      {ALL_SIZES.map((size) => (
                        <th
                          key={size}
                          className="whitespace-nowrap px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          {size}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {loading ? (
                      <tr>
                        <td colSpan={4 + ALL_SIZES.length} className="py-16 text-center">
                          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                        </td>
                      </tr>
                    ) : tableRows.length === 0 ? (
                      <tr>
                        <td colSpan={4 + ALL_SIZES.length} className="py-16 text-center">
                          <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground/30" />
                          <p className="mt-4 text-muted-foreground">Ombor bo&apos;sh yoki filtrga mos emas</p>
                          {hasActiveFilters && (
                            <Button variant="link" onClick={clearFilters} className="mt-2">
                              Filtrlarni tozalash
                            </Button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      tableRows.map((row) => (
                        <tr key={row.key} className="transition-colors hover:bg-muted/30">
                          {row.isFirst ? (
                            <>
                              <td
                                rowSpan={row.spec}
                                className="sticky left-0 z-10 whitespace-nowrap bg-background px-4 py-3 align-top font-semibold text-foreground"
                              >
                                {row.model}
                              </td>
                              <td rowSpan={row.spec} className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                                {row.color}
                              </td>
                              <td rowSpan={row.spec} className="whitespace-nowrap px-4 py-3 text-center align-top">
                                <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                                  {row.nomer}
                                </span>
                              </td>
                              <td rowSpan={row.spec} className="whitespace-nowrap px-4 py-3 text-center align-top text-muted-foreground">
                                {row.spec}
                              </td>
                            </>
                          ) : null}
                          {ALL_SIZES.map((size) => {
                            const qty = row.sizes[size] ?? row.sizes[String(size)]
                            return (
                              <td
                                key={size}
                                className={cn(
                                  "whitespace-nowrap px-2 py-3 text-center tabular-nums",
                                  qty ? "font-semibold text-primary" : "text-muted-foreground/20"
                                )}
                              >
                                {qty || "—"}
                              </td>
                            )
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
