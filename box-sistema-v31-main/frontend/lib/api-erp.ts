/**
 * Box Sistema UI → BILLUR ERP API adapter.
 * Zakazlar faqat ERP'da; bu yerda read + box/pack scan + shipment.
 */

import type {
  Box,
  Order,
  Shipment,
  SessionUser,
  SizeQuantities,
  MixItem,
  UserRole,
  RankingEntry,
  DetalniyGroup,
  AuditLogEntry,
  User,
  AiChatResponse,
} from "./types"
import {
  API_BASE_URL,
  ApiError,
  getToken,
  setToken,
} from "./api-core"
import {
  mapErpUser,
  mapErpBox,
  mapErpShipment,
  mapErpAudit,
  progressToOrder,
  listRowToOrder,
  buildDetalniyFromBoxes,
  buildRankingFromBoxes,
  type ErpOrderProgress,
  type ErpUser,
} from "./erp-mappers"

async function erpRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["x-session-token"] = token

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null)
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login"
      }
    }
    throw new ApiError(String(data?.error || `HTTP ${res.status}`), res.status)
  }
  return data as T
}

function normalizeBoxNum(raw: string): string {
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n < 1 || n > 50) throw new ApiError("Box raqami 01-50", 400)
  return String(n).padStart(2, "0")
}

async function packSizesToOrder(
  orderCode: string,
  sizes: SizeQuantities,
  boxUid: string,
  barcode?: string
) {
  for (const [size, qty] of Object.entries(sizes)) {
    const n = Number(qty) || 0
    if (n <= 0) continue
    await erpRequest("POST", "/api/box-production/scan", {
      order_code: orderCode,
      size_code: String(size),
      quantity: n,
      box_uid: boxUid,
      barcode: barcode || undefined,
    })
  }
}

const ERP_ORDER_MSG =
  "Zakazlar faqat ERP panelida yaratiladi (/orders). BoxUI faqat o'qiydi."

export const erpApi = {
  async login(username: string, password: string): Promise<{ token: string; user: SessionUser }> {
    const res = await erpRequest<{ ok: boolean; token: string; user: ErpUser }>(
      "POST",
      "/api/auth/login",
      { username, password }
    )
    setToken(res.token)
    return { token: res.token, user: mapErpUser(res.user) }
  },

  async logout(): Promise<void> {
    try {
      await erpRequest("POST", "/api/auth/logout", {})
    } catch {
      /* ignore */
    }
    setToken(null)
  },

  async me(): Promise<{ user: SessionUser | null }> {
    try {
      const u = await erpRequest<ErpUser>("GET", "/api/auth/me")
      return { user: mapErpUser(u) }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return { user: null }
      throw e
    }
  },

  async changePassword(oldPassword: string, newPassword: string) {
    return erpRequest<{ ok: boolean }>("POST", "/api/auth/me/password", {
      oldPassword,
      newPassword,
    })
  },

  async getOrders(): Promise<Order[]> {
    const rows = await erpRequest<
      Array<{
        id: string
        external_code: string
        total_pieces?: number
        total_boxed?: number
        total_remaining?: number
        client_name?: string
      }>
    >("GET", "/api/box-production/orders")
    return rows.map(listRowToOrder)
  },

  async getOrderByBarcode(barcode: string): Promise<Order> {
    const progress = await erpRequest<ErpOrderProgress>(
      "GET",
      `/api/box-production/orders/by-code/${encodeURIComponent(barcode.trim())}`
    )
    return progressToOrder(progress)
  },

  async createOrder() {
    throw new ApiError(ERP_ORDER_MSG, 403)
  },
  async updateOrder() {
    throw new ApiError(ERP_ORDER_MSG, 403)
  },
  async deleteOrder() {
    throw new ApiError(ERP_ORDER_MSG, 403)
  },

  async getBoxes(): Promise<Box[]> {
    const rows = await erpRequest<Record<string, unknown>[]>("GET", "/api/boxes")
    return rows.map(mapErpBox)
  },

  async createSimpleBox(data: {
    id: string
    zakaz: string
    kg: number
    model: string
    color: string
    sizes: SizeQuantities
    warehouseCode?: string
  }): Promise<Box> {
    const boxNum = normalizeBoxNum(data.id)
    const uid = `bx-${data.zakaz.trim()}-${boxNum}-${Date.now()}`
    const row = await erpRequest<Record<string, unknown>>("POST", "/api/box-production/boxes", {
      order_code: data.zakaz.trim(),
      box_num: boxNum,
      uid,
      type: "simple",
      kg: data.kg,
      model: data.model,
      color: data.color,
      sizes: data.sizes,
    })
    await packSizesToOrder(
      data.zakaz.trim(),
      data.sizes,
      String(row.uid),
      data.warehouseCode
    )
    return mapErpBox(row)
  },

  async createMixBox(data: {
    id: string
    zakaz: string
    kg: number
    items: MixItem[]
  }): Promise<Box> {
    const boxNum = normalizeBoxNum(data.id)
    const uid = `bx-${data.zakaz.trim()}-${boxNum}-${Date.now()}`
    const row = await erpRequest<Record<string, unknown>>("POST", "/api/box-production/boxes", {
      order_code: data.zakaz.trim(),
      box_num: boxNum,
      uid,
      type: "mix",
      kg: data.kg,
      items: data.items,
    })
    for (const item of data.items) {
      await packSizesToOrder(data.zakaz.trim(), item.sizes, String(row.uid))
    }
    return mapErpBox(row)
  },

  async updateBox(data: {
    uid: string
    zakaz?: string
    kg?: number
    sizes?: SizeQuantities
    items?: MixItem[]
    specification?: string
    cartonSize?: string
    multipack?: string
    warehouseCode?: string
    grossWeight?: number
    tareWeight?: number
  }): Promise<Box> {
    const row = await erpRequest<Record<string, unknown>>("PUT", `/api/boxes/${encodeURIComponent(data.uid)}`, {
      kg: data.kg,
      sizes: data.sizes,
      items: data.items,
    })
    return mapErpBox(row)
  },

  async setBoxStatus(uid: string, status: "packed" | "warehouse"): Promise<Box> {
    const row = await erpRequest<Record<string, unknown>>(
      "PUT",
      `/api/boxes/${encodeURIComponent(uid)}`,
      { status }
    )
    return mapErpBox(row)
  },

  async deleteBox(uid: string) {
    return erpRequest<{ ok: boolean }>("DELETE", `/api/boxes/${encodeURIComponent(uid)}`)
  },

  async getShipments(): Promise<Shipment[]> {
    const rows = await erpRequest<Record<string, unknown>[]>("GET", "/api/shipments")
    return rows.map(mapErpShipment)
  },

  async getOpenShipment(): Promise<Shipment | null> {
    const row = await erpRequest<Record<string, unknown> | null>("GET", "/api/shipments/open")
    return row ? mapErpShipment(row) : null
  },

  async openShipment(data: { truckInfo?: string; note?: string }): Promise<Shipment> {
    const row = await erpRequest<Record<string, unknown>>("POST", "/api/shipments/open", data)
    return mapErpShipment(row)
  },

  async toggleShipmentBox(boxUid: string, action: "add" | "remove"): Promise<Shipment> {
    const row = await erpRequest<Record<string, unknown>>("POST", "/api/shipments/open/boxes", {
      boxUid,
      action,
    })
    return mapErpShipment(row)
  },

  async closeShipment(): Promise<Shipment> {
    const row = await erpRequest<Record<string, unknown>>("POST", "/api/shipments/open/close", {})
    return mapErpShipment(row)
  },

  async deleteShipment(id: string) {
    throw new ApiError("Shipment o'chirish ERP'da qo'llab-quvvatlanmaydi", 400)
  },

  async getRanking(): Promise<{ date: string; ranking: RankingEntry[] }> {
    const boxes = await this.getBoxes()
    return buildRankingFromBoxes(boxes)
  },

  async getDetalniy(zakaz?: string, model?: string): Promise<DetalniyGroup[]> {
    let boxes = await this.getBoxes()
    if (zakaz) boxes = boxes.filter((b) => b.zakaz === zakaz)
    if (model) boxes = boxes.filter((b) => b.model === model)
    return buildDetalniyFromBoxes(boxes)
  },

  detalniyExcelUrl() {
    return `${API_BASE_URL}/api/reports/export/boxes`
  },

  async downloadDetalniyExcel() {
    throw new ApiError("Excel eksport uchun ERP /reports sahifasidan foydalaning", 400)
  },

  buildWarehouseDetailedExportPath() {
    return "/api/reports/export/boxes"
  },

  async downloadWarehouseDetailedExcel() {
    throw new ApiError("Excel eksport uchun ERP /reports sahifasidan foydalaning", 400)
  },

  async downloadShipmentDetailedExcel() {
    throw new ApiError("Shipment Excel ERP'da alohida", 400)
  },

  async aiChat(): Promise<AiChatResponse> {
    throw new ApiError("AI chat ERP rejimida o'chirilgan", 400)
  },

  async getUsers(): Promise<User[]> {
    throw new ApiError("Foydalanuvchilar ERP /users sahifasida boshqariladi", 400)
  },
  async createUser() {
    throw new ApiError("Foydalanuvchilar ERP'da boshqariladi", 400)
  },
  async resetUserPassword() {
    throw new ApiError("Foydalanuvchilar ERP'da boshqariladi", 400)
  },
  async deleteUser() {
    throw new ApiError("Foydalanuvchilar ERP'da boshqariladi", 400)
  },

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const rows = await erpRequest<Record<string, unknown>[]>("GET", "/api/audit?limit=200")
    return rows.map(mapErpAudit)
  },
}
