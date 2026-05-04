"use client"

import { useState } from "react"
import { Diamond, Loader2, LogIn } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError("Login va parol kerak")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await login(username.trim(), password)
    } catch (err: any) {
      setError(err?.message || "Kirish amalga oshmadi")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md border-0 bg-card/95 shadow-2xl backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/30">
              <Diamond className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-foreground">AND BILLUR TEXTILE</div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Box Management System
              </div>
            </div>
          </div>

          <div className="mb-6 border-b" />

          <h1 className="mb-1 text-xl font-semibold text-foreground">Tizimga kirish</h1>
          <p className="mb-6 text-sm text-muted-foreground">Login va parolingizni kiriting</p>

          {error && (
            <div className="mb-4 rounded-lg border-l-4 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Login</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                autoFocus
                disabled={submitting}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Parol</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
                disabled={submitting}
                className="h-11"
              />
            </div>
            <Button type="submit" disabled={submitting} className="h-11 w-full gap-2">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              Kirish
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
