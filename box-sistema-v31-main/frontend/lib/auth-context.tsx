"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useRouter, usePathname } from "next/navigation"
import { api, getToken, setToken } from "./api"
import type { SessionUser } from "./types"

interface AuthContextValue {
  user: SessionUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const refresh = useCallback(async () => {
    const t = getToken()
    if (!t) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const r = await api.me()
      if (r.user) setUser(r.user)
      else {
        setToken(null)
        setUser(null)
      }
    } catch {
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (loading) return
    const isLogin = pathname === "/login"
    if (!user && !isLogin) {
      router.replace("/login")
    } else if (user && isLogin) {
      router.replace("/")
    }
  }, [user, loading, pathname, router])

  const login = useCallback(
    async (username: string, password: string) => {
      const r = await api.login(username, password)
      setUser(r.user)
      router.replace("/")
    },
    [router]
  )

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
    router.replace("/login")
  }, [router])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
