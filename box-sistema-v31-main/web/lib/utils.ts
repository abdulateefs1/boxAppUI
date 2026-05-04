import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Box, Order, RankingEntry, SizeQuantities, BoxStatus } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number | string): string {
  const n = typeof num === "number" ? num : parseInt(String(num)) || 0
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

export function calculateProgress(packed: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.min(100, (packed / total) * 100)
}

export function totalPiecesOfBox(b: Box): number {
  if (b.type === "mix" && Array.isArray(b.items)) {
    return b.items.reduce(
      (s, it) =>
        s +
        Object.values(it.sizes || {}).reduce(
          (a, c) => a + (parseInt(String(c), 10) || 0),
          0
        ),
      0
    )
  }
  return Object.values(b.sizes || {}).reduce(
    (a, c) => a + (parseInt(String(c), 10) || 0),
    0
  )
}

export function modelLineForBox(b: Box): string {
  if (b.type === "mix") {
    return (b.items || [])
      .map(
        (it) =>
          `${it.model} (${Object.values(it.sizes || {}).reduce(
            (a, c) => a + (parseInt(String(c), 10) || 0),
            0
          )})`
      )
      .join(", ")
  }
  return `${b.model || ""} / ${b.color || ""}`
}

export function formatSizesText(sizes?: SizeQuantities | null): string {
  if (!sizes) return ""
  const entries = Object.entries(sizes).filter(
    ([, q]) => (parseInt(String(q), 10) || 0) > 0
  )
  if (!entries.length) return ""
  entries.sort(([a], [b]) => {
    const an = parseInt(a, 10)
    const bn = parseInt(b, 10)
    if (Number.isNaN(an) || Number.isNaN(bn)) return a.localeCompare(b)
    return an - bn
  })
  return entries.map(([k, v]) => `${k}:${parseInt(String(v), 10) || 0}`).join(" · ")
}

export const STATUS_OPTIONS: { value: BoxStatus | "all"; label: string }[] = [
  { value: "all", label: "Barcha statuslar" },
  { value: "packed", label: "Qadoqlandi" },
  { value: "warehouse", label: "Omborda" },
  { value: "shipping", label: "Shipmentda" },
  { value: "shipped", label: "Yuborilgan" },
]

export function buildRanking(boxes: Box[], explicitRanking?: RankingEntry[]) {
  if (explicitRanking) return explicitRanking
  const map: Record<string, RankingEntry> = {}
  boxes.forEach((b) => {
    const k = b.createdBy || "unknown"
    if (!map[k]) {
      map[k] = {
        username: b.createdBy || "unknown",
        name: b.createdByName || b.createdBy || "Unknown",
        count: 0,
        total: 0,
      }
    }
    map[k].count += 1
    map[k].total += totalPiecesOfBox(b)
  })
  return Object.values(map).sort((a, b) => b.count - a.count)
}

export function aggregateShipmentSnapshot(snapshot: Box[]) {
  const groups: Record<
    string,
    { model: string; color: string; boxMap: Record<string, boolean>; sizes: Record<string, number> }
  > = {}
  const add = (model: string, color: string, boxUid: string, sizes?: SizeQuantities | null) => {
    const key = `${String(model || "").trim().toLowerCase()}|${String(color || "").trim().toLowerCase()}`
    if (!groups[key]) {
      groups[key] = {
        model: String(model || "").trim(),
        color: String(color || "").trim(),
        boxMap: {},
        sizes: {},
      }
    }
    groups[key].boxMap[String(boxUid || "")] = true
    Object.entries(sizes || {}).forEach(([sz, q]) => {
      const v = parseInt(String(q), 10) || 0
      if (v > 0) groups[key].sizes[sz] = (groups[key].sizes[sz] || 0) + v
    })
  }
  ;(snapshot || []).forEach((b) => {
    const uid = b.uid || `${b.zakaz}-${b.id}`
    if (b.type === "mix") {
      ;(b.items || []).forEach((it) => add(it.model, it.color, uid, it.sizes))
    } else {
      add(b.model || "", b.color || "", uid, b.sizes)
    }
  })
  return Object.values(groups).map((g) => {
    const sizesTxt = Object.keys(g.sizes)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .map((sz) => `${sz}:${g.sizes[sz]}`)
      .join(" · ")
    const total = Object.values(g.sizes).reduce((s, q) => s + q, 0)
    return { model: g.model, color: g.color, boxCount: Object.keys(g.boxMap).length, total, sizesTxt }
  })
}

export function orderProgressMap(boxes: Box[]) {
  const stats: Record<string, { packed: number; shipped: number }> = {}
  const key = (m?: string | null, c?: string | null) =>
    `${String(m || "").trim().toLowerCase()}|${String(c || "").trim().toLowerCase()}`
  boxes.forEach((b) => {
    const handle = (m?: string | null, c?: string | null, sz?: SizeQuantities | null) => {
      const k = key(m, c)
      if (!stats[k]) stats[k] = { packed: 0, shipped: 0 }
      const pcs = Object.values(sz || {}).reduce(
        (a, x) => a + (parseInt(String(x), 10) || 0),
        0
      )
      if (["packed", "warehouse", "shipping", "shipped"].includes(b.status))
        stats[k].packed += pcs
      if (b.status === "shipped") stats[k].shipped += pcs
    }
    if (b.type === "mix") {
      ;(b.items || []).forEach((it) => handle(it.model, it.color, it.sizes))
    } else {
      handle(b.model, b.color, b.sizes)
    }
  })
  return {
    get(o: Order) {
      return stats[key(o.model, o.color)] || { packed: 0, shipped: 0 }
    },
  }
}
