"use client"

import { Input } from "@/components/ui/input"
import { ALL_SIZES, type SizeQuantities } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SizeGridProps {
  values: SizeQuantities
  onChange: (values: SizeQuantities) => void
  disabled?: boolean
}

export function SizeGrid({ values, onChange, disabled }: SizeGridProps) {
  const handleChange = (size: number, value: string) => {
    const numValue = parseInt(value) || 0
    const newValues = { ...values }
    if (numValue > 0) {
      newValues[size] = numValue
    } else {
      delete newValues[size]
    }
    onChange(newValues)
  }

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ALL_SIZES.map((size) => {
          const current = values[size] ?? values[String(size)]
          const hasValue = (Number(current) || 0) > 0
          return (
            <div
              key={size}
              className={cn(
                "rounded-lg border bg-background p-2 transition-all duration-200",
                hasValue ? "border-primary/50 ring-2 ring-primary/10" : "border-transparent"
              )}
            >
              <div
                className={cn(
                  "mb-1.5 text-center text-xs font-semibold",
                  hasValue ? "text-primary" : "text-muted-foreground"
                )}
              >
                {size}
              </div>
              <Input
                type="number"
                min={0}
                value={current ?? ""}
                onChange={(e) => handleChange(size, e.target.value)}
                placeholder="0"
                disabled={disabled}
                className={cn(
                  "h-10 text-center font-mono text-lg font-bold",
                  "border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
                  hasValue ? "text-foreground" : "text-muted-foreground/50"
                )}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
