import { cn } from "@/lib/utils"
import { STATUS_LABEL, type BoxStatus } from "@/lib/types"

interface StatusBadgeProps {
  status: BoxStatus
  size?: "sm" | "md"
}

const statusConfig: Record<BoxStatus, { className: string; dot: string }> = {
  packed: {
    className: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/20",
    dot: "bg-teal-500",
  },
  warehouse: {
    className: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20",
    dot: "bg-indigo-500",
  },
  shipping: {
    className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
    dot: "bg-amber-500",
  },
  shipped: {
    className: "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-600/15",
    dot: "bg-slate-400",
  },
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        config.className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {STATUS_LABEL[status]}
    </span>
  )
}
