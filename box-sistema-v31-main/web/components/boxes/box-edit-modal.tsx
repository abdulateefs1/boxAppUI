"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SizeGrid } from "@/components/shared/size-grid"
import { Check, Loader2, Pencil, Scale } from "lucide-react"
import type { Box, MixItem, SizeQuantities } from "@/lib/types"
import { api } from "@/lib/api"
import { formatNumber } from "@/lib/utils"
import { toast } from "sonner"

interface BoxEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  box: Box | null
  onSaved: () => void
}

export function BoxEditModal({ open, onOpenChange, box, onSaved }: BoxEditModalProps) {
  const [zakaz, setZakaz] = useState("")
  const [kg, setKg] = useState("")
  const [itemSizes, setItemSizes] = useState<SizeQuantities[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!box) return
    setZakaz(box.zakaz || "")
    setKg(String(box.kg || ""))
    if (box.type === "mix") {
      setItemSizes((box.items || []).map((it) => ({ ...(it.sizes || {}) })))
    } else {
      setItemSizes([{ ...(box.sizes || {}) }])
    }
  }, [box, open])

  if (!box) return null

  const totalDona = itemSizes.reduce(
    (s, sz) => s + Object.values(sz).reduce((a, c) => a + (Number(c) || 0), 0),
    0
  )

  const handleSave = async () => {
    if (!zakaz.trim()) {
      toast.error("Zakaz kerak")
      return
    }
    const kgNum = parseFloat(kg)
    if (!kgNum || kgNum <= 0) {
      toast.error("Og'irlik kerak")
      return
    }
    if (totalDona === 0) {
      toast.error("Kamida 1 ta razmer kerak")
      return
    }
    setSubmitting(true)
    try {
      if (box.type === "mix") {
        const items: MixItem[] = (box.items || []).map((it, idx) => ({
          model: it.model,
          color: it.color,
          sizes: itemSizes[idx] || {},
        }))
        await api.updateBox({ uid: box.uid, zakaz: zakaz.trim(), kg: kgNum, items })
      } else {
        await api.updateBox({
          uid: box.uid,
          zakaz: zakaz.trim(),
          kg: kgNum,
          sizes: itemSizes[0] || {},
        })
      }
      toast.success("Box tahrirlandi")
      onSaved()
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
              <Pencil className="h-4 w-4 text-primary" />
            </div>
            Box {box.zakaz}/{box.id} ni tahrirlash
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Box №</Label>
              <Input value={box.id} readOnly className="h-12 font-mono text-lg font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Zakaz</Label>
              <Input value={zakaz} onChange={(e) => setZakaz(e.target.value)} className="h-12 font-mono text-lg" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Og&apos;irlik (kg)</Label>
            <div className="relative">
              <Scale className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                step="0.1"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
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

            {box.type === "mix" ? (
              (box.items || []).map((it, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="text-xs font-semibold text-foreground">
                    {idx + 1}. {it.model} <span className="text-muted-foreground">/</span> {it.color}
                  </div>
                  <SizeGrid
                    values={itemSizes[idx] || {}}
                    onChange={(s) =>
                      setItemSizes((prev) => prev.map((p, i) => (i === idx ? s : p)))
                    }
                  />
                </div>
              ))
            ) : (
              <SizeGrid
                values={itemSizes[0] || {}}
                onChange={(s) => setItemSizes([s])}
              />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1 h-12" disabled={submitting}>
              Bekor
            </Button>
            <Button onClick={handleSave} disabled={submitting} className="flex-1 h-12 gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Saqlash
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
