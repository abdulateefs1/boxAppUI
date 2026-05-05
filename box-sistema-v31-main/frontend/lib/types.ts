export type BoxStatus = "packed" | "warehouse" | "shipping" | "shipped"
export type UserRole = "admin" | "storekeeper" | "worker"
export type BoxType = "simple" | "mix"

export const ALL_SIZES = [98, 104, 110, 116, 122, 128, 134, 140, 146, 152, 158, 164, 170, 176] as const
export type Size = (typeof ALL_SIZES)[number]

export type SizeQuantities = Record<string | number, number>

export interface Order {
  id: string
  model: string
  color: string
  barcode: string | null
  total: number
  createdAt?: string
}

export interface MixItem {
  model: string
  color: string
  sizes: SizeQuantities
}

export interface Box {
  uid: string
  id: string
  zakaz: string
  type: BoxType
  kg: number
  status: BoxStatus
  model?: string | null
  color?: string | null
  sizes?: SizeQuantities | null
  items?: MixItem[] | null
  specification?: string | null
  cartonSize?: string | null
  multipack?: string | null
  grossWeight?: number | null
  tareWeight?: number | null
  warehouseCode?: string | null
  createdBy?: string
  createdByName?: string
  createdAt?: string
  createdDate?: string
  updatedAt?: string
  statusHistory?: Array<{ from: string | null; to: string; at: string; by: string }>
}

export interface Shipment {
  id: string
  truckInfo?: string
  note?: string
  status: "open" | "closed"
  boxUids: string[]
  snapshot?: Box[]
  createdBy?: string
  createdByName?: string
  createdAt?: string
  closedAt?: string | null
  closedBy?: string | null
}

export interface User {
  id: string
  username: string
  role: UserRole
  name: string
  mustChangePwd?: boolean
}

export interface SessionUser {
  id: string
  username: string
  role: UserRole
  name: string
  mustChangePwd?: boolean
}

export interface AuditLogEntry {
  id: number | string
  type: string
  by_user: string
  by_name: string
  ip: string
  details: Record<string, unknown>
  at: string
}

export interface DashboardStats {
  packed: number
  warehouse: number
  shipping: number
  shipped: number
}

export interface RankingEntry {
  username: string
  name: string
  count: number
  total: number
}

export interface DetalniyGroup {
  model: string
  color: string
  zakaz: string
  boxes: Box[]
  sizes: SizeQuantities
}

export const STATUS_LABEL: Record<BoxStatus, string> = {
  packed: "Qadoqlandi",
  warehouse: "Omborda",
  shipping: "Shipmentda",
  shipped: "Yuborilgan",
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  storekeeper: "Omborchi",
  worker: "Ishchi",
}
