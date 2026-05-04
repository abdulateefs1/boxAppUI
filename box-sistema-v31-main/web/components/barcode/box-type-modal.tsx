"use client"

import { Package, Boxes, ArrowRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Order } from "@/lib/types"
import { cn } from "@/lib/utils"

interface BoxTypeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order | null
  onSelect: (type: "simple" | "mix") => void
  onCancel: () => void
}

export function BoxTypeModal({ open, onOpenChange, order, onSelect, onCancel }: BoxTypeModalProps) {
  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl">Box turini tanlang</DialogTitle>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm">
            <span className="font-semibold text-foreground">{order.model}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{order.color}</span>
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          <button
            onClick={() => onSelect("simple")}
            className={cn(
              "group relative w-full overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5 text-left transition-all duration-200",
              "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
                <Package className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-foreground">Oddiy box</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    1 model
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Bitta model uchun box yaratish. Eng ko&apos;p ishlatiladigan variant.
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          <button
            onClick={() => onSelect("mix")}
            className={cn(
              "group relative w-full overflow-hidden rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-left transition-all duration-200",
              "hover:border-amber-300 hover:shadow-lg hover:shadow-amber-500/10"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md">
                <Boxes className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-amber-900">Mix box</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    2+ model
                  </span>
                </div>
                <p className="mt-1 text-sm text-amber-700/80">
                  Bir nechta modelni bitta boxga birlashtirish (kamida 2 ta).
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-amber-500 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          <Button onClick={onCancel} variant="ghost" className="w-full text-muted-foreground">
            Bekor qilish
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
