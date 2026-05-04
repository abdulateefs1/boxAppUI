"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Truck, Plus, Check, Trash2, Search, Package, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { Box, Shipment } from "@/lib/types"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { aggregateShipmentSnapshot, formatNumber, totalPiecesOfBox } from "@/lib/utils"
import { toast } from "sonner"

function matchesShipmentSearch(b: Box, q: string): boolean {
  if (!q.trim()) return true
  const ql = q.trim().toLowerCase()
  const modelTxt =
    b.type === "mix"
      ? (b.items || []).map((it) => `${it.model || ""} ${it.color || ""}`).join(" ")
      : `${b.model || ""} ${b.color || ""}`
  const hay = `${b.zakaz || ""} ${b.id || ""} ${modelTxt}`.toLowerCase()
  return hay.includes(ql)
}

function matchesWarehouseModelColor(b: Box, modelQ: string, colorQ: string): boolean {
  const m = modelQ.trim().toLowerCase()
  const c = colorQ.trim().toLowerCase()
  if (!m && !c) return true
  if (b.type === "mix") {
    return (b.items || []).some((it) => {
      const modelTxt = String(it.model || "").toLowerCase()
      const colorTxt = String(it.color || "").toLowerCase()
      return (!m || modelTxt.includes(m)) && (!c || colorTxt.includes(c))
    })
  }
  const modelTxt = String(b.model || "").toLowerCase()
  const colorTxt = String(b.color || "").toLowerCase()
  return (!m || modelTxt.includes(m)) && (!c || colorTxt.includes(c))
}

export default function ShipmentsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const [open, setOpen] = useState<Shipment | null>(null)
  const [allShipments, setAllShipments] = useState<Shipment[]>([])
  const [allBoxes, setAllBoxes] = useState<Box[]>([])
  const [loading, setLoading] = useState(true)

  const [truckInfo, setTruckInfo] = useState("")
  const [note, setNote] = useState("")
  const [opening, setOpening] = useState(false)

  const [searchIn, setSearchIn] = useState("")
  const [modelFilter, setModelFilter] = useState("")
  const [colorFilter, setColorFilter] = useState("")

  const [expandedHistId, setExpandedHistId] = useState<string | null>(null)
  const [closeConfirm, setCloseConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; status: "open" | "closed" } | null>(null)

  const load = useCallback(async () => {
    try {
      const [o, ships, boxes] = await Promise.all([
        api.getOpenShipment(),
        api.getShipments(),
        api.getBoxes(),
      ])
      setOpen(o)
      setAllShipments(ships)
      setAllBoxes(boxes)
    } catch (e: any) {
      toast.error(e?.message || "Yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const closedShipments = useMemo(
    () => allShipments.filter((s) => s.status === "closed"),
    [allShipments]
  )

  const inShipmentBoxes = useMemo(() => {
    if (!open?.boxUids?.length) return []
    const set = new Set(open.boxUids)
    return allBoxes.filter((b) => set.has(b.uid))
  }, [open, allBoxes])

  const warehouseBoxes = useMemo(
    () => allBoxes.filter((b) => b.status === "warehouse"),
    [allBoxes]
  )

  const inFiltered = useMemo(
    () => inShipmentBoxes.filter((b) => matchesShipmentSearch(b, searchIn)),
    [inShipmentBoxes, searchIn]
  )

  const whFiltered = useMemo(
    () =>
      warehouseBoxes.filter(
        (b) => matchesShipmentSearch(b, searchIn) && matchesWarehouseModelColor(b, modelFilter, colorFilter)
      ),
    [warehouseBoxes, searchIn, modelFilter, colorFilter]
  )

  const openShipmentTotalKg = useMemo(
    () => inShipmentBoxes.reduce((s, b) => s + (Number(b.kg) || 0), 0),
    [inShipmentBoxes]
  )

  const handleOpenShipment = async () => {
    setOpening(true)
    try {
      await api.openShipment({ truckInfo: truckInfo.trim(), note: note.trim() })
      toast.success("Shipment ochildi")
      setTruckInfo("")
      setNote("")
      await load()
    } catch (e: any) {
      toast.error(e?.message || "Xatolik")
    } finally {
      setOpening(false)
    }
  }

  const toggleBox = async (uid: string, action: "add" | "remove") => {
    try {
      await api.toggleShipmentBox(uid, action)
      toast.success(action === "add" ? "Qo'shildi" : "Qaytarildi")
      await load()
    } catch (e: any) {
      toast.error(e?.message || "Xatolik")
    }
  }

  const confirmCloseShipment = async () => {
    try {
      await api.closeShipment()
      toast.success("Yopildi")
      await load()
    } catch (e: any) {
      toast.error(e?.message || "Xatolik")
    }
  }

  const confirmDeleteShipment = async () => {
    if (!deleteTarget) return
    try {
      await api.deleteShipment(deleteTarget.id)
      toast.success("Shipment o'chirildi")
      setDeleteTarget(null)
      await load()
    } catch (e: any) {
      toast.error(e?.message || "Xatolik")
    }
  }

  const BoxRow = ({
    b,
    action,
    label,
  }: {
    b: Box
    action: "add" | "remove"
    label: string
  }) => {
    const pieces = totalPiecesOfBox(b)
    return (
      <div className="flex items-center justify-between gap-3 border-b border-border/40 py-2.5 last:border-0">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            <span>
              {b.zakaz}/{b.id}
            </span>
            {b.type === "mix" && (
              <Badge variant="secondary" className="text-[10px]">
                MIX
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {b.kg} kg · {formatNumber(pieces)} dona
          </div>
        </div>
        <Button
          size="sm"
          variant={action === "add" ? "default" : "ghost"}
          className="h-8 shrink-0"
          onClick={() => void toggleBox(b.uid, action)}
        >
          {label}
        </Button>
      </div>
    )
  }

  return (
    <>
      <AppHeader title="Shipmentlar" icon={<Truck className="h-4 w-4" />} />

      <ConfirmDialog
        open={closeConfirm}
        onOpenChange={setCloseConfirm}
        title="Shipmentni yopish"
        description="Bu amalni qaytarib bo'lmaydi."
        confirmLabel="Yopish"
        variant="default"
        onConfirm={confirmCloseShipment}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Shipmentni o'chirish"
        description={
          deleteTarget?.status === "closed"
            ? `${deleteTarget.id}: tarix yozuvini o'chirasizmi? Yuborilgan boxlar holati o'zgarmaydi.`
            : `${deleteTarget?.id}: ochiq shipment o'chiladi; shipmentdagi boxlar omborga qaytadi.`
        }
        onConfirm={confirmDeleteShipment}
      />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : !open ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <Truck className="h-6 w-6 text-amber-600" />
                  Yangi shipment ochish
                </div>
                <div className="space-y-2">
                  <Label>Mashina ma&apos;lumoti</Label>
                  <Input
                    value={truckInfo}
                    onChange={(e) => setTruckInfo(e.target.value)}
                    placeholder="DAF / 01 A 123 BB"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Izoh</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ixtiyoriy" />
                </div>
                <Button className="w-full gap-2" onClick={() => void handleOpenShipment()} disabled={opening}>
                  <Plus className="h-4 w-4" />
                  Ochish
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-0 shadow-sm">
                <CardContent className="space-y-3 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Ochiq shipment
                      </div>
                      <div className="text-xl font-bold text-foreground">{open.id}</div>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Ochiq</Badge>
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Mashina</span>
                      <span className="font-medium">{open.truckInfo?.trim() || "—"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Boxlar</span>
                      <span className="font-medium">{inShipmentBoxes.length} ta</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Og&apos;irlik</span>
                      <span className="font-medium">{openShipmentTotalKg.toFixed(1)} kg</span>
                    </div>
                  </div>
                  <Button className="w-full gap-2 bg-teal-600 hover:bg-teal-700" onClick={() => setCloseConfirm(true)}>
                    <Check className="h-4 w-4" />
                    Shipmentni yopish
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() =>
                        setDeleteTarget({ id: open.id, status: "open" })
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Shipmentni o&apos;chirish (Admin)
                    </Button>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                        <Package className="h-4 w-4 text-amber-600" />
                      </div>
                      <span className="font-semibold">Shipmentdagi boxlar</span>
                      <Badge variant="secondary">{inShipmentBoxes.length}</Badge>
                    </div>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Qidiruv: zakaz, box, model..."
                        className="h-9 pl-9"
                        value={searchIn}
                        onChange={(e) => setSearchIn(e.target.value)}
                      />
                    </div>
                    <div className="max-h-72 overflow-auto">
                      {!inFiltered.length ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">Mos box topilmadi</p>
                      ) : (
                        inFiltered.map((b) => <BoxRow key={b.uid} b={b} action="remove" label="Qaytarish" />)
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
                        <Package className="h-4 w-4 text-indigo-600" />
                      </div>
                      <span className="font-semibold">Ombordagi boxlar</span>
                      <Badge variant="secondary">{warehouseBoxes.length}</Badge>
                    </div>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Qidiruv: zakaz, box, model..."
                        className="h-9 pl-9"
                        value={searchIn}
                        onChange={(e) => setSearchIn(e.target.value)}
                      />
                    </div>
                    <div className="mb-3 grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="Model bo'yicha"
                        className="h-9"
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                      />
                      <Input
                        placeholder="Rang bo'yicha"
                        className="h-9"
                        value={colorFilter}
                        onChange={(e) => setColorFilter(e.target.value)}
                      />
                    </div>
                    <div className="max-h-72 overflow-auto">
                      {!whFiltered.length ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">Mos box topilmadi</p>
                      ) : (
                        whFiltered.map((b) => <BoxRow key={b.uid} b={b} action="add" label="+ Qo'shish" />)
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <span>Shipment tarixi</span>
                <Badge variant="outline">{closedShipments.length}</Badge>
              </div>
              {!closedShipments.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Hali yopilgan shipment yo&apos;q</p>
              ) : (
                <div className="divide-y">
                  {closedShipments.map((s) => {
                    const snap = Array.isArray(s.snapshot) ? s.snapshot : []
                    const pcs = snap.reduce((sum, b) => sum + totalPiecesOfBox(b), 0)
                    const kg = snap.reduce((sum, b) => sum + (Number(b.kg) || 0), 0)
                    const dt = s.closedAt ? new Date(s.closedAt).toLocaleString("uz-UZ") : "—"
                    const rows = aggregateShipmentSnapshot(snap)
                    const expanded = expandedHistId === s.id

                    return (
                      <div key={s.id} className="flex gap-3 py-3 first:pt-0">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="font-semibold text-foreground">
                            {s.id} · {snap.length} box
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {dt} · {kg.toFixed(1)} kg · {pcs} dona
                          </div>
                          {expanded && (
                            <div className="mt-2 space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
                              {rows.length ? (
                                rows.map((r, i) => (
                                  <div key={`${s.id}-${i}`} className="border-b border-border/30 pb-2 last:border-0 last:pb-0">
                                    <div>
                                      <strong>
                                        {r.model} / {r.color}
                                      </strong>{" "}
                                      — {r.boxCount} box · {r.total} dona
                                    </div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">{r.sizesTxt || "—"}</div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-muted-foreground">Ma&apos;lumot yo&apos;q</p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => setExpandedHistId(expanded ? null : s.id)}
                          >
                            {expanded ? (
                              <>
                                Yopish <ChevronDown className="h-4 w-4 rotate-180" />
                              </>
                            ) : (
                              <>
                                Ko&apos;rish <ChevronRight className="h-4 w-4" />
                              </>
                            )}
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              title="Tarixdan o'chirish"
                              onClick={() => setDeleteTarget({ id: s.id, status: "closed" })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
