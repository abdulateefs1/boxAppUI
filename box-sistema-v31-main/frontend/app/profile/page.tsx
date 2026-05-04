"use client"

import { useState } from "react"
import { UserCircle, Lock, Save, Shield, ShieldCheck, User, ChevronRight } from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/types"
import { toast } from "sonner"

function getRoleConfig(rol: UserRole) {
  switch (rol) {
    case "admin":
      return {
        label: "Administrator",
        icon: ShieldCheck,
        bgColor: "bg-gradient-to-br from-amber-400 to-orange-500",
        description: "To'liq tizim huquqlari",
      }
    case "storekeeper":
      return {
        label: "Omborchi",
        icon: Shield,
        bgColor: "bg-gradient-to-br from-indigo-400 to-indigo-600",
        description: "Ombor boshqaruvi",
      }
    case "worker":
      return {
        label: "Ishchi",
        icon: User,
        bgColor: "bg-gradient-to-br from-slate-400 to-slate-600",
        description: "Asosiy funktsiyalar",
      }
    default:
      return {
        label: rol,
        icon: User,
        bgColor: "bg-gradient-to-br from-slate-400 to-slate-600",
        description: "",
      }
  }
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const roleConfig = user ? getRoleConfig(user.role) : getRoleConfig("worker")
  const Icon = roleConfig.icon

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("Barcha maydonlarni to'ldiring")
      return
    }

    if (newPassword.length < 6) {
      toast.error("Yangi parol kamida 6 belgi bo'lishi kerak")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("Yangi parollar mos kelmaydi")
      return
    }

    setIsSubmitting(true)
    try {
      await api.changePassword(oldPassword, newPassword)
      toast.success("Parol muvaffaqiyatli o'zgartirildi", {
        description: "Boshqa qurilmalardagi sessionlar yopildi.",
      })
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (e: any) {
      toast.error(e?.message || "Xatolik")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <>
      <AppHeader title="Profil" icon={<UserCircle className="h-4 w-4" />} />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-xl space-y-4 p-4 md:p-6">
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/30 blur-3xl" />
                  <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-indigo-500/20 blur-3xl" />
                </div>

                <div className="relative flex items-center gap-4">
                  <div
                    className={cn(
                      "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg",
                      roleConfig.bgColor
                    )}
                  >
                    <Icon className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{user.name}</h2>
                    <p className="text-sm text-slate-400">@{user.username}</p>
                  </div>
                </div>
              </div>

              <div className="divide-y">
                <div className="flex items-center justify-between p-4">
                  <div className="space-y-0.5">
                    <span className="text-sm text-muted-foreground">Rol</span>
                    <div className="font-semibold text-foreground">{roleConfig.label}</div>
                  </div>
                  <span className="text-sm text-muted-foreground">{roleConfig.description}</span>
                </div>
                <div className="flex items-center justify-between p-4">
                  <div className="space-y-0.5">
                    <span className="text-sm text-muted-foreground">Kompaniya</span>
                    <div className="font-semibold text-foreground">AND BILLUR TEXTILE</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
                  <Lock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Parolni o&apos;zgartirish</h3>
                  <p className="text-xs text-muted-foreground">Xavfsizlik uchun parolingizni yangilang</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="oldPassword">Hozirgi parol</Label>
                  <Input
                    id="oldPassword"
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Yangi parol</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Kamida 6 belgi"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Yangi parolni tasdiqlang</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11"
                  />
                </div>

                <Button type="submit" className="h-11 w-full gap-2" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saqlanmoqda...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Parolni saqlash
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Parol o&apos;zgartirilgach, boshqa qurilmalardagi sessionlar avtomatik yopiladi.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
