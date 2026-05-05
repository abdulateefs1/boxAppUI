"use client"

import { useState, useRef, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SizeGrid } from "@/components/shared/size-grid"
import {
  Check,
  Loader2,
  ScanBarcode,
  ArrowRight,
  Boxes,
  Package,
  Scale,
  Plus,
  X,
} from "lucide-react"
import type { Order, SizeQuantities } from "@/lib/types"
import { api } from "@/lib/api"
import { formatNumber, cn } from "@/lib/utils"
import { toast } from "sonner"

interface MixBoxModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialOrder: Order | null
  onSave: () => void
  onCancel: () => void
}

type Step = "scan-more" | "form"

export function MixBoxModal({
  open,
  onOpenChange,
  initialOrder,
  onSave,
  onCancel,
}: MixBoxModalProps) {
  const [step, setStep] = useState<Step>("scan-more")
  const [orders, setOrders] = useState<Order[]>([])
  const [barcode, setBarcode] = useState("")
  const [boxNumber, setBoxNumber] = useState("")
  const [zakaz, setZakaz] = useState("")
  const [ogirlik, setOgirlik] = useState("")
  const [warehouseCode, setWarehouseCode] = useState("")
  const [sizesPerOrder, setSizesPerOrder] = useState<SizeQuantities[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && initialOrder) {
      setOrders([initialOrder])
      setStep("scan-more")
      setBarcode("")
      setBoxNumber("")
      setZakaz("")
      setOgirlik("")
      setWarehouseCode("")
      setSizesPerOrder([])
    }
  }, [open, initialOrder])

  useEffect(() => {
    if (open && step === "scan-more") {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, step])

  const handleAddOrder = async () => {
    if (!barcode.trim()) return
    setScanning(true)
    try {
      const order = await api.getOrderByBarcode(barcode.trim())
      if (orders.some((o) => o.id === order.id)) {
        toast.error("Bu model allaqachon qo'shilgan")
        setBarcode("")
        return
      }
      setOrders((prev) => [...prev, order])
      setBarcode("")
      toast.success(`${order.model} / ${order.color} qo'shildi`)
    } catch (e: any) {
      toast.error(e?.message || "Topilmadi")
    } finally {
      setScanning(false)
    }
  }

  const handleRemoveOrder = (idx: number) => {
    if (orders.length <= 1) {
      toast.error("Kamida 1 model kerak")
      return
    }
    setOrders((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAddOrder()
  }

  const goToForm = () => {
    if (orders.length < 2) {
      toast.error("Mix box uchun kamida 2 ta model kerak")
      return
    }
    setSizesPerOrder(orders.map(() => ({})))
    setStep("form")
  }

  const totalDona = sizesPerOrder.reduce(
    (sum, s) => sum + Object.values(s).reduce((a, c) => a + (Number(c) || 0), 0),
    0
  )

  const handleSave = async () => {
    if (!boxNumber.trim() || !zakaz.trim()) {
      toast.error("Box raqami va zakaz kerak")
      return
    }
    const kg = parseFloat(ogirlik)
    if (!kg || kg <= 0) {
      toast.error("Og'irlik kerak")
      return
    }
    if (totalDona === 0) {
      toast.error("Hech bo'lmaganda 1 ta razmer kiriting")
      return
    }
    setSubmitting(true)
    try {
      const items = orders.map((ord, idx) => ({
        model: ord.model,
        color: ord.color,
        sizes: sizesPerOrder[idx] || {},
      }))
      const created = await api.createMixBox({
        id: boxNumber.trim(),
        zakaz: zakaz.trim(),
        kg,
        items,
      })
      if (warehouseCode.trim()) {
        await api.updateBox({
          uid: created.uid,
          zakaz: zakaz.trim(),
          kg,
          items,
          warehouseCode: warehouseCode.trim(),
        })
      }
      toast.success("Mix box yaratildi")
      onSave()
    } catch (e: any) {
      toast.error(e?.message || "Saqlab bo'lmadi")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setOrders([])
    setBarcode("")
    setBoxNumber("")
    setZakaz("")
    setOgirlik("")
    setWarehouseCode("")
    setSizesPerOrder([])
    setStep("scan-more")
    onCancel()
  }

  const colors = ["teal", "indigo", "amber", "purple", "emerald", "rose"]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
              <Boxes className="h-4 w-4 text-white" />
            </div>
            Mix Box ({orders.length} model)
          </DialogTitle>
        </DialogHeader>

        {step === "scan-more" && (
          <div className="space-y-4 pt-2">
            <p className="text-center text-sm text-muted-foreground">
              Yana model qo&apos;shing (kamida 2 ta) yoki razmerlarga o&apos;ting
            </p>

            <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ScanBarcode className="h-7 w-7" />
                </div>
                <div className="flex w-full gap-2">
                  <Input
                    ref={inputRef}
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    placeholder="Barcode..."
                    className="h-11 text-center font-mono text-base tracking-wider"
                    autoComplete="off"
                    disabled={scanning}
                  />
                  <Button onClick={handleAddOrder} disabled={!barcode.trim() || scanning} className="h-11 gap-1.5">
                    {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Qo&apos;shish
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Tanlangan modellar</Label>
              {orders.length === 0 ? (
                <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                  Hali model qo&apos;shilmagan
                </div>
              ) : (
                orders.map((o, idx) => {
                  const c = colors[idx % colors.length]
                  return (
                    <div
                      key={o.id + idx}
                      className={cn(
                        "flex items-center gap-3 rounded-xl p-3 ring-1 ring-inset",
                        c === "teal" && "bg-teal-50 ring-teal-600/20",
                        c === "indigo" && "bg-indigo-50 ring-indigo-600/20",
                        c === "amber" && "bg-amber-50 ring-amber-600/20",
                        c === "purple" && "bg-purple-50 ring-purple-600/20",
                        c === "emerald" && "bg-emerald-50 ring-emerald-600/20",
                        c === "rose" && "bg-rose-50 ring-rose-600/20"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-bold text-white",
                          c === "teal" && "bg-teal-500",
                          c === "indigo" && "bg-indigo-500",
                          c === "amber" && "bg-amber-500",
                          c === "purple" && "bg-purple-500",
                          c === "emerald" && "bg-emerald-500",
                          c === "rose" && "bg-rose-500"
                        )}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold text-foreground">{o.model}</div>
                        <div className="truncate text-xs text-muted-foreground">{o.color}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOrder(idx)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleClose} variant="outline" className="flex-1 h-11">
                Bekor
              </Button>
              <Button
                onClick={goToForm}
                disabled={orders.length < 2}
                className="flex-1 h-11 gap-2"
              >
                Davom
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "form" && (
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="boxNumber" className="text-xs font-medium text-muted-foreground">
                  Box raqami (01-50)
                </Label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="boxNumber"
                    value={boxNumber}
                    onChange={(e) => setBoxNumber(e.target.value)}
                    placeholder="01"
                    maxLength={2}
                    inputMode="numeric"
                    className="h-12 pl-10 font-mono text-lg font-bold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zakaz" className="text-xs font-medium text-muted-foreground">
                  Zakaz
                </Label>
                <Input
                  id="zakaz"
                  value={zakaz}
                  onChange={(e) => setZakaz(e.target.value)}
                  placeholder="600"
                  className="h-12 font-mono text-lg"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ogirlik" className="text-xs font-medium text-muted-foreground">
                Og&apos;irlik (kg)
              </Label>
              <div className="relative">
                <Scale className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ogirlik"
                  type="number"
                  step="0.1"
                  value={ogirlik}
                  onChange={(e) => setOgirlik(e.target.value)}
                  placeholder="14.0"
                  className="h-12 pl-10 font-mono text-lg"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">Razmerlar (har model uchun)</Label>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {formatNumber(totalDona)} dona
                </span>
              </div>

              {orders.map((ord, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary">
                      {idx + 1}
                    </span>
                    {ord.model} <span className="text-muted-foreground">/</span> {ord.color}
                  </div>
                  <SizeGrid
                    values={sizesPerOrder[idx] || {}}
                    onChange={(s) =>
                      setSizesPerOrder((prev) => prev.map((p, i) => (i === idx ? s : p)))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouseCode" className="text-xs font-medium text-muted-foreground">
                Scan ID (masalan: 00541616)
              </Label>
              <div className="relative">
                <ScanBarcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="warehouseCode"
                  value={warehouseCode}
                  onChange={(e) => setWarehouseCode(e.target.value.toUpperCase())}
                  placeholder="Skan qilingan box ID"
                  className="h-12 pl-10 font-mono"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setStep("scan-more")}
                variant="outline"
                className="flex-1 h-12"
                disabled={submitting}
              >
                Orqaga
              </Button>
              <Button
                onClick={handleSave}
                disabled={totalDona === 0 || submitting}
                className="flex-1 h-12 gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Saqlash
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
