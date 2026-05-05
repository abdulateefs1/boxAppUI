"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SizeGrid } from "@/components/shared/size-grid"
import { Check, Loader2, Package, Scale, ScanBarcode } from "lucide-react"
import type { Order, SizeQuantities } from "@/lib/types"
import { api } from "@/lib/api"
import { formatNumber } from "@/lib/utils"
import { toast } from "sonner"

interface SimpleBoxModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order | null
  onSave: () => void
  onCancel: () => void
}

export function SimpleBoxModal({ open, onOpenChange, order, onSave, onCancel }: SimpleBoxModalProps) {
  const [boxNumber, setBoxNumber] = useState("")
  const [zakaz, setZakaz] = useState("")
  const [ogirlik, setOgirlik] = useState("")
  const [sizes, setSizes] = useState<SizeQuantities>({})
  const [warehouseCode, setWarehouseCode] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setBoxNumber("")
      setZakaz("")
      setOgirlik("")
      setSizes({})
      setWarehouseCode("")
    }
  }, [open])

  if (!order) return null

  const totalDona = Object.values(sizes).reduce((s, v) => s + (Number(v) || 0), 0)

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
      const created = await api.createSimpleBox({
        id: boxNumber.trim(),
        zakaz: zakaz.trim(),
        kg,
        model: order.model,
        color: order.color,
        sizes,
      })
      if (warehouseCode.trim()) {
        await api.updateBox({
          uid: created.uid,
          zakaz: zakaz.trim(),
          kg,
          sizes,
          warehouseCode: warehouseCode.trim(),
        })
      }
      toast.success("Box yaratildi")
      onSave()
    } catch (e: any) {
      toast.error(e?.message || "Saqlab bo'lmadi")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-4 w-4 text-primary" />
            </div>
            Oddiy box
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-slate-400">Model / Rang</div>
              <div className="mt-0.5 truncate text-lg font-bold text-white">
                {order.model} <span className="text-slate-400">/</span> {order.color}
              </div>
            </div>
            {order.barcode && (
              <div className="rounded-lg bg-white/10 px-3 py-1.5 font-mono text-sm text-white">
                {order.barcode}
              </div>
            )}
          </div>
        </div>

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
                placeholder="12.5"
                className="h-12 pl-10 font-mono text-lg"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Razmerlar</Label>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {formatNumber(totalDona)} dona
              </span>
            </div>
            <SizeGrid values={sizes} onChange={setSizes} />
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
            <Button onClick={onCancel} variant="outline" className="flex-1 h-12" disabled={submitting}>
              Bekor
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
      </DialogContent>
    </Dialog>
  )
}
