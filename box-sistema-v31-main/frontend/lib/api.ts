"use client"

import type {
  Box,
  Order,
  Shipment,
  User,
  AuditLogEntry,
  RankingEntry,
  DetalniyGroup,
  SessionUser,
  SizeQuantities,
  MixItem,
  UserRole,
} from "./types"

const TOKEN_KEY = "ab_session_token"

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ""

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token)
    else window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = "ApiError"
  }
}

async function downloadAuthenticatedXlsx(apiPathWithQuery: string, fallbackFilename: string): Promise<void> {
  const token = getToken()
  const res = await fetch(`${API_BASE_URL}${apiPathWithQuery}`, {
    headers: token ? { "x-session-token": token } : {},
    credentials: "include",
  })
  let filename = fallbackFilename
  const cd = res.headers.get("content-disposition")
  if (cd) {
    const star = cd.match(/filename\*=UTF-8''([^;]+)/i)
    const plain = cd.match(/filename="([^"]+)"/i) || cd.match(/filename=([^;\s]+)/i)
    if (star?.[1]) {
      try {
        filename = decodeURIComponent(star[1]).replace(/^"+|"+$/g, "")
      } catch {
        filename = fallbackFilename
      }
    } else if (plain?.[1]) {
      filename = plain[1].replace(/^"+|"+$/g, "")
    }
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = typeof j.error === "string" ? j.error : msg
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status)
  }
  const blob = await res.blob()
  const link = document.createElement("a")
  const objUrl = URL.createObjectURL(blob)
  link.href = objUrl
  link.download = filename || fallbackFilename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objUrl)
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (token) headers["x-session-token"] = token

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data: any = {}
  try {
    data = await res.json()
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
    throw new ApiError(data?.error || `HTTP ${res.status}`, res.status)
  }
  return data as T
}

export const api = {
  // ===== AUTH =====
  async login(username: string, password: string): Promise<{ token: string; user: SessionUser }> {
    const res = await request<{ ok: boolean; token: string; user: SessionUser }>(
      "POST",
      "/api/login",
      { username, password }
    )
    setToken(res.token)
    return res
  },
  async logout(): Promise<void> {
    try {
      await request<{ ok: boolean }>("POST", "/api/logout")
    } catch {
      /* ignore */
    }
    setToken(null)
  },
  async me(): Promise<{ user: SessionUser | null }> {
    return request("GET", "/api/me")
  },
  async changePassword(oldPassword: string, newPassword: string) {
    return request<{ ok: boolean }>("POST", "/api/change-password", {
      oldPassword,
      newPassword,
    })
  },

  // ===== ORDERS =====
  async getOrders(): Promise<Order[]> {
    return request("GET", "/api/orders")
  },
  async getOrderByBarcode(barcode: string): Promise<Order> {
    return request("GET", `/api/orders/by-barcode/${encodeURIComponent(barcode)}`)
  },
  async createOrder(data: { model: string; color: string; barcode?: string | null; total: number }) {
    return request<Order>("POST", "/api/orders", data)
  },
  async updateOrder(id: string, data: Partial<Order>) {
    return request<Order>("PUT", `/api/orders/${encodeURIComponent(id)}`, data)
  },
  async deleteOrder(id: string) {
    return request<{ ok: boolean }>("DELETE", `/api/orders/${encodeURIComponent(id)}`)
  },

  // ===== BOXES =====
  async getBoxes(): Promise<Box[]> {
    return request("GET", "/api/boxes")
  },
  async createSimpleBox(data: {
    id: string
    zakaz: string
    kg: number
    model: string
    color: string
    sizes: SizeQuantities
  }): Promise<Box> {
    return request("POST", "/api/boxes", { ...data, type: "simple" })
  },
  async createMixBox(data: {
    id: string
    zakaz: string
    kg: number
    items: MixItem[]
  }): Promise<Box> {
    return request("POST", "/api/boxes", { ...data, type: "mix" })
  },
  async updateBox(data: {
    uid: string
    zakaz?: string
    kg?: number
    sizes?: SizeQuantities
    items?: MixItem[]
  }): Promise<Box> {
    return request("PUT", "/api/boxes/_", data)
  },
  async setBoxStatus(uid: string, status: "packed" | "warehouse"): Promise<Box> {
    return request("PUT", "/api/boxes/_/status", { uid, status })
  },
  async deleteBox(uid: string) {
    return request<{ ok: boolean }>(
      "DELETE",
      `/api/boxes/_?uid=${encodeURIComponent(uid)}`
    )
  },

  // ===== SHIPMENTS =====
  async getShipments(): Promise<Shipment[]> {
    return request("GET", "/api/shipments")
  },
  async getOpenShipment(): Promise<Shipment | null> {
    return request("GET", "/api/shipments/open")
  },
  async openShipment(data: { truckInfo?: string; note?: string }): Promise<Shipment> {
    return request("POST", "/api/shipments/open", data)
  },
  async toggleShipmentBox(boxUid: string, action: "add" | "remove"): Promise<Shipment> {
    return request("POST", "/api/shipments/open/boxes", { boxUid, action })
  },
  async closeShipment(): Promise<Shipment> {
    return request("POST", "/api/shipments/open/close", {})
  },
  async deleteShipment(id: string) {
    return request<{ ok: boolean }>(
      "DELETE",
      `/api/shipments/${encodeURIComponent(id)}`
    )
  },

  // ===== RANKING =====
  async getRanking(): Promise<{ date: string; ranking: RankingEntry[] }> {
    return request("GET", "/api/ranking")
  },

  // ===== DETALNIY =====
  async getDetalniy(zakaz?: string, model?: string): Promise<DetalniyGroup[]> {
    const params = new URLSearchParams()
    if (zakaz) params.set("zakaz", zakaz)
    if (model) params.set("model", model)
    return request("GET", `/api/detalniy${params.toString() ? `?${params}` : ""}`)
  },
  detalniyExcelUrl(zakaz?: string, model?: string): string {
    const params = new URLSearchParams()
    if (zakaz) params.set("zakaz", zakaz)
    if (model) params.set("model", model)
    return `${API_BASE_URL}/api/detalniy/excel${params.toString() ? `?${params}` : ""}`
  },
  async downloadDetalniyExcel(zakaz?: string, model?: string): Promise<void> {
    const url = api.detalniyExcelUrl(zakaz, model)
    const token = getToken()
    const res = await fetch(url, {
      headers: token ? { "x-session-token": token } : {},
      credentials: "include",
    })
    if (!res.ok) throw new ApiError("Excel yuklanmadi", res.status)
    const blob = await res.blob()
    const link = document.createElement("a")
    const objUrl = URL.createObjectURL(blob)
    link.href = objUrl
    link.download = `Detalniy_${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objUrl)
  },

  /** Лист2 layout — detailed warehouse export */
  buildWarehouseDetailedExportPath(filters: {
    status?: string
    orderNumbers?: string
    model?: string
    color?: string
    specification?: string
    warehouseId?: string
    dateFrom?: string
    dateTo?: string
  }) {
    const p = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== "") p.set(k, String(v))
    })
    const q = p.toString()
    return `/api/exports/warehouse-detailed.xlsx${q ? `?${q}` : ""}`
  },

  async downloadWarehouseDetailedExcel(filters: {
    status?: string
    orderNumbers?: string
    model?: string
    color?: string
    specification?: string
    warehouseId?: string
    dateFrom?: string
    dateTo?: string
  }): Promise<void> {
    const path = api.buildWarehouseDetailedExportPath(filters)
    return downloadAuthenticatedXlsx(path, `warehouse-detailed-${new Date().toISOString().slice(0, 10)}.xlsx`)
  },

  async downloadShipmentDetailedExcel(shipmentId: string): Promise<void> {
    const path = `/api/shipments/${encodeURIComponent(shipmentId)}/export-detailed.xlsx`
    return downloadAuthenticatedXlsx(path, `shipment-${shipmentId}-detailed.xlsx`)
  },

  // ===== USERS =====
  async getUsers(): Promise<User[]> {
    return request("GET", "/api/users")
  },
  async createUser(data: {
    username: string
    password: string
    role: UserRole
    name: string
  }) {
    return request<User>("POST", "/api/users", data)
  },
  async resetUserPassword(id: string, password: string) {
    return request<{ ok: boolean }>(
      "PUT",
      `/api/users/${encodeURIComponent(id)}/password`,
      { password }
    )
  },
  async deleteUser(id: string) {
    return request<{ ok: boolean }>("DELETE", `/api/users/${encodeURIComponent(id)}`)
  },

  // ===== AUDIT =====
  async getAuditLogs(): Promise<AuditLogEntry[]> {
    return request("GET", "/api/audit-logs")
  },
}
