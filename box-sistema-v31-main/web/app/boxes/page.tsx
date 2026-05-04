"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Package,
  Pencil,
  ArrowRight,
  Trash2,
  Search,
  Filter,
  X,
  Loader2,
} from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/shared/status-badge"
import { BoxEditModal } from "@/components/boxes/box-edit-modal"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { Box, BoxStatus } from "@/lib/types"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { cn, formatNumber, formatSizesText, modelLineForBox, totalPiecesOfBox } from "@/lib/utils"
import { toast } from "sonner"

export default function BoxesPage() {
  const { user } = useAuth()
  const [boxes, setBoxes] = useState<Box[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedZakaz, setSelectedZakaz] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [editing, setEditing] = useState<Box | null>(null)
  const [deleting, setDeleting] = useState<Box | null>(null)

  const canManage = user?.role === "admin" || user?.role === "storekeeper"

  const reload = async () => {
    try {
      const list = await api.getBoxes()
      setBoxes(list)
    } catch (e: any) {
      toast.error(e?.message || "Yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    reload()
  }, [user])

  const filteredBoxes = useMemo(
    () =>
      boxes.filter((b) => {
        if (selectedStatus !== "all" && b.status !== selectedStatus) return false
        if (selectedZakaz && String(b.zakaz) !== selectedZakaz) return false
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          const modelTxt =
            b.type === "mix"
              ? (b.items || []).map((it) => `${it.model} ${it.color}`).join(" ")
              : `${b.model || ""} ${b.color || ""}`
          return (
            String(b.id).toLowerCase().includes(q) ||
            String(b.zakaz).toLowerCase().includes(q) ||
            modelTxt.toLowerCase().includes(q)
          )
        }
        return true
      }),
    [boxes, selectedStatus, selectedZakaz, searchQuery]
  )

  const zakazChips = useMemo(() => {
    const map: Record<string, { cnt: number; pieces: number }> = {}
    boxes.forEach((b) => {
      const z = String(b.zakaz || "").trim()
      if (!z) return
      if (!map[z]) map[z] = { cnt: 0, pieces: 0 }
      map[z].cnt += 1
      map[z].pieces += totalPiecesOfBox(b)
    })
    return Object.entries(map).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true })
    )
  }, [boxes])

  const clearFilters = () => {
    setSelectedStatus("all")
    setSelectedZakaz("")
    setSearchQuery("")
  }

  const hasActiveFilters = selectedStatus !== "all" || selectedZakaz || searchQuery

  const handleStatusToggle = async (b: Box, target: "warehouse" | "packed") => {
    try {
      await api.setBoxStatus(b.uid, target)
      toast.success(target === "warehouse" ? "Omborga o'tkazildi" : "Qaytarildi")
      reload()
    } catch (e: any) {
      toast.error(e?.message || "Status o'zgartirilmadi")
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await api.deleteBox(deleting.uid)
      toast.success("Box o'chirildi")
      setDeleting(null)
      reload()
    } catch (e: any) {
      toast.error(e?.message || "O'chirib bo'lmadi")
    }
  }

  return (
    <>
      <AppHeader
        title="Boxlar"
        icon={<Package className="h-4 w-4" />}
        action={
          <span className="text-sm text-muted-foreground">
            {formatNumber(filteredBoxes.length)} ta box
          </span>
        }
      />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    <span>Filtrlar</span>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="h-9 w-full sm:w-[160px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Barcha statuslar</SelectItem>
                        <SelectItem value="packed">Qadoqlandi</SelectItem>
                        <SelectItem value="warehouse">Omborda</SelectItem>
                        <SelectItem value="shipping">Shipmentda</SelectItem>
                        <SelectItem value="shipped">Yuborilgan</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Qidirish: zakaz, box, model, rang..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
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

                {zakazChips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {zakazChips.slice(0, 30).map(([z, item]) => (
                      <button
                        key={z}
                        onClick={() => setSelectedZakaz(selectedZakaz === z ? "" : z)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
                          selectedZakaz === z
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        )}
                      >
                        Zakaz {z} · {item.cnt} box · {formatNumber(item.pieces)} dona
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {loading ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : filteredBoxes.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-muted-foreground">Mos box topilmadi</p>
                  {hasActiveFilters && (
                    <Button variant="link" onClick={clearFilters} className="mt-2">
                      Filtrlarni tozalash
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredBoxes.slice(0, 200).map((box) => {
                const total = totalPiecesOfBox(box)
                return (
                  <Card
                    key={box.uid}
                    className="group border-0 shadow-sm transition-all duration-200 hover:shadow-md"
                  >
                    <CardContent className="p-0">
                      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                        <div className="flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-lg font-bold tracking-tight text-foreground">
                              {box.zakaz}/{box.id}
                            </span>
                            {box.type === "mix" && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                MIX
                              </span>
                            )}
                            <StatusBadge status={box.status as BoxStatus} />
                          </div>
                          <p className="text-sm font-medium text-foreground/80">{modelLineForBox(box)}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="font-medium">{box.kg} kg</span>
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                            <span>{formatNumber(total)} dona</span>
                            {box.createdByName && (
                              <>
                                <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                <span>{box.createdByName}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {canManage && (
                          <div className="flex flex-wrap gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditing(box)}
                              className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Tahrirlash
                            </Button>

                            {box.status === "packed" && (
                              <Button
                                size="sm"
                                onClick={() => handleStatusToggle(box, "warehouse")}
                                className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                                Omborga
                              </Button>
                            )}

                            {box.status === "warehouse" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusToggle(box, "packed")}
                                className="h-8 gap-1.5"
                              >
                                <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                                Qaytarish
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleting(box)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="border-t bg-muted/30 px-4 py-2.5 text-xs">
                        {box.type === "mix" ? (
                          <div className="space-y-1">
                            {(box.items || []).map((it, i) => (
                              <div key={i}>
                                <span className="font-semibold text-foreground">
                                  {it.model} / {it.color}
                                </span>
                                <span className="ml-2 text-muted-foreground">
                                  {formatSizesText(it.sizes)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div>
                            <span className="font-medium text-muted-foreground">Razmerlar:</span>{" "}
                            <span className="text-foreground/80">{formatSizesText(box.sizes)}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      </main>

      <BoxEditModal
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        box={editing}
        onSaved={() => {
          setEditing(null)
          reload()
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Boxni o'chirish"
        description={`Box ${deleting?.zakaz}/${deleting?.id} ni o'chirishni tasdiqlaysizmi?`}
        onConfirm={confirmDelete}
      />
    </>
  )
}
