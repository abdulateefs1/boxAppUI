import type {
  Box,
  BoxStatus,
  Order,
  Shipment,
  SessionUser,
  UserRole,
  SizeQuantities,
  MixItem,
  RankingEntry,
  DetalniyGroup,
  AuditLogEntry,
} from "./types"

export interface ErpUser {
  id: string
  username: string
  full_name: string
  role_id: string
  permissions?: string[]
}

export interface ErpOrderProgress {
  order_id: string
  external_code: string
  status: string
  client_name: string | null
  total_ordered: number
  total_boxed: number
  total_remaining: number
  is_complete: boolean
  items: Array<{
    id: string
    model_code: string
    model_name: string
    color_code: string
    color_name: string
    size_code: string
    ordered_qty: number
    boxed_qty: number
    remaining_qty: number
  }>
}

export function erpRoleToBoxApp(roleId: string, permissions: string[] = []): UserRole {
  if (roleId === "owner" || roleId === "admin") return "admin"
  if (roleId === "warehouse" || permissions.includes("box.update")) return "storekeeper"
  return "worker"
}

export function mapErpUser(u: ErpUser): SessionUser {
  return {
    id: u.id,
    username: u.username,
    name: u.full_name || u.username,
    role: erpRoleToBoxApp(u.role_id, u.permissions || []),
    mustChangePwd: false,
  }
}

export function progressToOrder(p: ErpOrderProgress): Order {
  const first = p.items[0]
  return {
    id: p.order_id,
    model: first?.model_code || first?.model_name || p.external_code,
    color: first?.color_code || first?.color_name || "—",
    barcode: p.external_code,
    total: p.total_ordered,
  }
}

export function listRowToOrder(row: {
  id: string
  external_code: string
  total_pieces?: number
  total_boxed?: number
  total_remaining?: number
  client_name?: string
}): Order {
  const total =
    Number(row.total_pieces) ||
    Number(row.total_boxed || 0) + Number(row.total_remaining || 0)
  return {
    id: row.id,
    model: row.external_code,
    color: row.client_name || "—",
    barcode: row.external_code,
    total,
  }
}

function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback
  if (typeof v === "object") return v as T
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

export function mapErpBox(row: Record<string, unknown>): Box {
  const sizes = parseJson<SizeQuantities | null>(row.sizes, null)
  const items = parseJson<MixItem[] | null>(row.items, null)
  return {
    uid: String(row.uid),
    id: String(row.box_num),
    zakaz: String(row.zakaz),
    type: (row.type as Box["type"]) || "simple",
    kg: Number(row.kg) || 0,
    status: row.status as BoxStatus,
    model: (row.model as string) || null,
    color: (row.color as string) || null,
    sizes,
    items,
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdByName: (row.created_by_name as string) || undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    createdDate: row.created_date ? String(row.created_date) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    statusHistory: parseJson(row.status_history, []),
  }
}

export function mapErpShipment(row: Record<string, unknown>): Shipment {
  const boxUids = parseJson<string[]>(row.box_uids, [])
  const snapshot = parseJson<Box[]>(row.snapshot, [])
  return {
    id: String(row.id),
    truckInfo: (row.truck_info as string) || undefined,
    note: (row.note as string) || undefined,
    status: row.status as Shipment["status"],
    boxUids,
    snapshot,
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdByName: (row.created_by_name as string) || undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    closedBy: row.closed_by ? String(row.closed_by) : null,
  }
}

export function mapErpAudit(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: String(row.id),
    type: String(row.event_type || row.type || ""),
    by_user: String(row.username || ""),
    by_name: String(row.username || ""),
    ip: String(row.ip_address || ""),
    details: parseJson(row.metadata, {}),
    at: String(row.at || ""),
  }
}

export function buildDetalniyFromBoxes(boxes: Box[]): DetalniyGroup[] {
  const map = new Map<string, DetalniyGroup>()
  for (const b of boxes) {
    const key = `${b.zakaz}|${b.model}|${b.color}`
    let g = map.get(key)
    if (!g) {
      g = {
        model: b.model || "—",
        color: b.color || "—",
        zakaz: b.zakaz,
        boxes: [],
        sizes: {},
      }
      map.set(key, g)
    }
    g.boxes.push(b)
    const sizes = b.sizes || {}
    for (const [k, v] of Object.entries(sizes)) {
      g.sizes[k] = (g.sizes[k] || 0) + (Number(v) || 0)
    }
  }
  return Array.from(map.values())
}

export function buildRankingFromBoxes(boxes: Box[]): { date: string; ranking: RankingEntry[] } {
  const today = new Date().toISOString().slice(0, 10)
  const counts = new Map<string, { name: string; count: number; total: number }>()
  for (const b of boxes) {
    const d = (b.createdDate || b.createdAt || "").slice(0, 10)
    if (d !== today) continue
    const user = b.createdByName || b.createdBy || "unknown"
    const cur = counts.get(user) || { name: user, count: 0, total: 0 }
    cur.count += 1
    const pcs = Object.values(b.sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0)
    cur.total += pcs
    counts.set(user, cur)
  }
  const ranking: RankingEntry[] = Array.from(counts.entries())
    .map(([username, v]) => ({
      username,
      name: v.name,
      count: v.count,
      total: v.total,
    }))
    .sort((a, b) => b.count - a.count)
  return { date: today, ranking }
}
