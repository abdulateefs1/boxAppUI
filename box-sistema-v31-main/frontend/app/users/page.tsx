"use client"

import { useCallback, useEffect, useState } from "react"
import { Users, Plus, KeyRound, Trash2, Shield, ShieldCheck, User as UserIcon, Loader2 } from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useAuth } from "@/lib/auth-context"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { User, UserRole } from "@/lib/types"
import { toast } from "sonner"

function getRoleConfig(rol: UserRole) {
  switch (rol) {
    case "admin":
      return {
        label: "Admin",
        icon: ShieldCheck,
        bgColor: "bg-gradient-to-br from-amber-400 to-orange-500",
        badgeColor: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
      }
    case "storekeeper":
      return {
        label: "Omborchi",
        icon: Shield,
        bgColor: "bg-gradient-to-br from-indigo-400 to-indigo-600",
        badgeColor: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20",
      }
    case "worker":
      return {
        label: "Ishchi",
        icon: UserIcon,
        bgColor: "bg-gradient-to-br from-slate-400 to-slate-600",
        badgeColor: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-600/15",
      }
    default:
      return {
        label: rol,
        icon: UserIcon,
        bgColor: "bg-gradient-to-br from-slate-400 to-slate-600",
        badgeColor: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-600/15",
      }
  }
}

const ROLES: UserRole[] = ["admin", "storekeeper", "worker"]

export default function UsersPage() {
  const { user: me } = useAuth()
  const [userList, setUserList] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("worker")
  const [saving, setSaving] = useState(false)
  const [resetUser, setResetUser] = useState<User | null>(null)
  const [newPass, setNewPass] = useState("")
  const [deleteUser, setDeleteUser] = useState<User | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await api.getUsers()
      setUserList(list)
    } catch (e: any) {
      toast.error(e?.message || "Yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async () => {
    const u = username.trim()
    const n = name.trim()
    if (!u || !password) {
      toast.error("Login va parol kerak")
      return
    }
    if (password.length < 6) {
      toast.error("Parol kamida 6 belgi")
      return
    }
    setSaving(true)
    try {
      await api.createUser({ username: u, password, role, name: n || u })
      toast.success("Saqlandi")
      setCreateOpen(false)
      setName("")
      setUsername("")
      setPassword("")
      setRole("worker")
      await load()
    } catch (e: any) {
      toast.error(e?.message || "Xatolik")
    } finally {
      setSaving(false)
    }
  }

  const doResetPassword = async () => {
    if (!resetUser) return
    if (!newPass || newPass.length < 6) {
      toast.error("Parol kamida 6 belgi")
      return
    }
    try {
      await api.resetUserPassword(resetUser.id, newPass)
      toast.success("Parol o'zgardi")
      setResetUser(null)
      setNewPass("")
    } catch (e: any) {
      toast.error(e?.message || "Xatolik")
    }
  }

  const doDelete = async () => {
    if (!deleteUser) return
    try {
      await api.deleteUser(deleteUser.id)
      toast.success("O'chirildi")
      await load()
    } catch (e: any) {
      toast.error(e?.message || "Xatolik")
    }
  }

  return (
    <>
      <AppHeader
        title="Foydalanuvchilar"
        icon={<Users className="h-4 w-4" />}
        action={
          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            className="h-8 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Yangi foydalanuvchi
          </Button>
        }
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yangi foydalanuvchi</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>Ism</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Ali" />
            </div>
            <div className="space-y-2">
              <Label>Login *</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Parol *</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kamida 6 belgi"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {getRoleConfig(r).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Bekor
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? "..." : "Saqlash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(resetUser)}
        onOpenChange={(v) => {
          if (!v) {
            setResetUser(null)
            setNewPass("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parolni tiklash</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {resetUser?.name} (@{resetUser?.username})
          </p>
          <div className="space-y-2">
            <Label>Yangi parol</Label>
            <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>
              Bekor
            </Button>
            <Button onClick={() => void doResetPassword()}>Saqlash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteUser)}
        onOpenChange={(v) => !v && setDeleteUser(null)}
        title="Foydalanuvchini o'chirish"
        description={`${deleteUser?.name} (@${deleteUser?.username}) o'chiriladi.`}
        onConfirm={doDelete}
      />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {ROLES.map((r) => {
              const config = getRoleConfig(r)
              const count = userList.filter((u) => u.role === r).length
              const Icon = config.icon

              return (
                <Card key={r} className="border-0 shadow-sm">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white", config.bgColor)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold tabular-nums text-foreground">{count}</div>
                      <div className="text-xs text-muted-foreground">{config.label}</div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="divide-y">
                  {userList.map((u) => {
                    const roleConfig = getRoleConfig(u.role)
                    const isCurrentUser = me?.id === u.id
                    const Icon = roleConfig.icon
                    const cantDelete = u.username === "admin" || me?.id === u.id

                    return (
                      <div
                        key={u.id}
                        className={cn(
                          "group flex items-center gap-4 p-4 transition-colors",
                          isCurrentUser ? "bg-primary/5" : "hover:bg-muted/30"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm",
                            roleConfig.bgColor
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-foreground">{u.name}</span>
                            {isCurrentUser && (
                              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                                Siz
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-mono">@{u.username}</span>
                          </div>
                        </div>

                        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", roleConfig.badgeColor)}>
                          {roleConfig.label}
                        </span>

                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setResetUser(u)}
                            className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {!cantDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteUser(u)}
                              className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
