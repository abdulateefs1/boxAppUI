"use client"

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

export async function downloadAuthenticatedXlsx(
  apiPathWithQuery: string,
  fallbackFilename: string
): Promise<void> {
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
