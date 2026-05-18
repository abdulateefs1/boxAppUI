"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardList, Plus, Pencil, Trash2, CheckCircle2, Loader2 } from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { Box, Order } from "@/lib/types"
import { api } from "@/lib/api"
import { ERP_READONLY_ORDERS } from "@/lib/config"
import { calculateProgress, formatNumber, cn, orderProgressMap } from "@/lib/utils"
import { toast } from "sonner"

const emptyOrderForm = () => ({
  id: "" as string,
  barcode: "",
  model: "",
  color: "",
  total: "",
})

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [boxes, setBoxes] = useState<Box[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyOrderForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [o, b] = await Promise.all([api.getOrders(), api.getBoxes()])
      setOrders(o)
      setBoxes(b)
    } catch (e: any) {
      toast.error(e?.message || "Yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const progress = useMemo(() => orderProgressMap(boxes), [boxes])

  const openCreate = () => {
    setForm(emptyOrderForm())
    setDialogOpen(true)
  }

  const openEdit = (o: Order) => {
    setForm({
      id: o.id,
      barcode: o.barcode || "",
      model: o.model,
      color: o.color,
      total: String(o.total ?? ""),
    })
    setDialogOpen(true)
  }

  const saveOrder = async () => {
    const model = form.model.trim()
    const color = form.color.trim()
    const total = parseInt(form.total, 10)
    const barcode = form.barcode.trim() || null
    if (!model || !color || !total || total <= 0) {
      toast.error("Model, rang va miqdor kerak")
      return
    }
    setSaving(true)
    try {
      if (form.id) {
        await api.updateOrder(form.id, { model, color, barcode, total })
        toast.success("Order yangilandi")
      } else {
        await api.createOrder({ model, color, barcode, total })
        toast.success("Order yaratildi")
      }
      setDialogOpen(false)
      await load()
    } catch (e: any) {
      toast.error(e?.message || "Saqlanmadi")
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await api.deleteOrder(deleteId)
      toast.success("O'chirildi")
      await load()
    } catch (e: any) {
      toast.error(e?.message || "Xatolik")
    }
  }

  return (
    <>
      <AppHeader
        title="Orderlar"
        icon={<ClipboardList className="h-4 w-4" />}
        action={
          ERP_READONLY_ORDERS ? (
            <span className="text-xs text-muted-foreground max-w-[200px] text-right">
              ERP&apos;da yaratiladi — bu yerda faqat ko&apos;rish
            </span>
          ) : (
            <Button onClick={openCreate} size="sm" className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Yangi order
            </Button>
          )
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Orderni tahrirlash" : "Yangi order"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="o-barcode">Barcode</Label>
              <Input
                id="o-barcode"
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                className="font-mono"
                placeholder="Ixtiyoriy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="o-model">Model *</Label>
              <Input
                id="o-model"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="o-color">Rang *</Label>
              <Input
                id="o-color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="o-total">Buyurtma (dona) *</Label>
              <Input
                id="o-total"
                type="number"
                min={1}
                value={form.total}
                onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Bekor
            </Button>
            <Button onClick={() => void saveOrder()} disabled={saving}>
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="Orderni o'chirish"
        description="Buyurtmani o'chirishni tasdiqlaysizmi?"
        confirmLabel="O'chirish"
        onConfirm={confirmDelete}
      />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-4 md:p-6">
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : orders.length === 0 ? (
                  <p className="py-16 text-center text-muted-foreground">Order yo&apos;q</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Model
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Rang
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Barcode
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Buyurtma
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Tayyor
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Yuborildi
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Progress
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Amallar
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {orders.map((order) => {
                        const st = progress.get(order)
                        const pct = calculateProgress(st.packed, order.total)
                        const isComplete = pct >= 100

                        return (
                          <tr key={order.id} className="group transition-colors hover:bg-muted/30">
                            <td className="whitespace-nowrap px-4 py-3.5">
                              <span className="font-semibold text-foreground">{order.model}</span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">{order.color}</td>
                            <td className="whitespace-nowrap px-4 py-3.5">
                              <code className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-700">
                                {order.barcode ?? "—"}
                              </code>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-sm tabular-nums text-muted-foreground">
                              {formatNumber(order.total)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-sm tabular-nums font-medium text-foreground">
                              {formatNumber(st.packed)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-sm tabular-nums text-primary">
                              {formatNumber(st.shipped)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="relative h-2 w-28 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={cn(
                                      "absolute left-0 top-0 h-full rounded-full transition-all duration-500",
                                      isComplete
                                        ? "bg-gradient-to-r from-teal-500 to-teal-400"
                                        : "bg-gradient-to-r from-primary to-primary/80"
                                    )}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span
                                  className={cn(
                                    "flex items-center gap-1 font-mono text-xs font-semibold tabular-nums",
                                    isComplete ? "text-teal-600" : "text-muted-foreground"
                                  )}
                                >
                                  {isComplete && <CheckCircle2 className="h-3.5 w-3.5" />}
                                  {pct.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-right">
                              {!ERP_READONLY_ORDERS ? (
                              <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEdit(order)}
                                  className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setDeleteId(order.id)}
                                  className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
