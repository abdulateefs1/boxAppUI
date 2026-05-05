"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/components/layout/app-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Send, Loader2, Bot, User, Trash2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api } from "@/lib/api"
import type { AiChatResponse } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type ChatRole = "user" | "assistant"
type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  data?: Array<Record<string, unknown>>
  suggestions?: string[]
}

const PROMPTS = [
  "LRTT-084 Sweet Dreams nechta karobkada?",
  "LRTT-084 Sweet Dreams qaysi razmerlardan nechta bor?",
  "LRTT-084 Sweet Dreams qaysi zakaz ichida?",
  "70% dan oshgan orderlar qaysilar?",
  "Bugun yuklangan shipmentlar bo'yicha xulosa ber",
  "Omborda izlishka bo'lib qolgan modellarni ko'rsat",
  "Qaysi model/rang/razmer eng ko'p qolib ketgan?",
  "Shipmentga tayyor bo'lgan orderlarni chiqar",
  "Box count bilan item quantity mos kelmayotgan joylarni top",
]

function DataTable({ rows }: { rows?: Array<Record<string, unknown>> }) {
  const safeRows = Array.isArray(rows) ? rows : []
  if (!safeRows.length) return null
  const columns = Object.keys(safeRows[0]).slice(0, 8)
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-semibold text-foreground">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {safeRows.slice(0, 20).map((row, i) => (
            <tr key={i} className="border-t">
              {columns.map((col) => (
                <td key={`${i}-${col}`} className="px-3 py-2 text-muted-foreground">
                  {String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ChatPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const canUseChat = useMemo(
    () => user?.role === "admin" || user?.role === "storekeeper",
    [user?.role]
  )

  useEffect(() => {
    if (!loading && user && !canUseChat) {
      router.replace("/")
      toast.error("Chat sahifasiga ruxsat yo'q")
    }
  }, [loading, user, canUseChat, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, sending])

  const sendMessage = async (messageText?: string) => {
    const text = String(messageText ?? input).trim()
    if (!text || sending) return
    setSending(true)
    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")

    try {
      const res: AiChatResponse = await api.aiChat(text)
      const aiMsg: ChatMessage = {
        id: `${Date.now()}-a`,
        role: "assistant",
        content: res.answer || "AI javobi bo'sh qaytdi.",
        data: res.data,
        suggestions: res.suggestions,
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (e: any) {
      toast.error(e?.message || "AI hozir javob bera olmadi. Keyinroq urinib ko'ring.")
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-e`,
          role: "assistant",
          content: "AI hozir javob bera olmadi. Keyinroq urinib ko'ring.",
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  if (!user) return null
  if (!canUseChat) return null

  return (
    <>
      <AppHeader title="AI Ombor Assistant" icon={<Sparkles className="h-4 w-4" />} />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-foreground md:text-2xl">AI Ombor Assistant</h1>
                  <p className="text-sm text-muted-foreground">
                    Box, order, shipment va ombor ma&apos;lumotlarini tez tahlil qiladi
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={!messages.length}
                  onClick={() => setMessages([])}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear chat
                </Button>
              </div>

              {!messages.length && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => void sendMessage(p)}
                      className="rounded-lg border bg-muted/20 p-3 text-left text-sm transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex min-h-[420px] flex-1 flex-col border-0 shadow-sm">
            <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              {!messages.length ? (
                <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
                  Savol yuboring yoki yuqoridagi promptlardan birini tanlang.
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn("max-w-[92%] rounded-xl p-3 text-sm", m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "mr-auto border bg-muted/20")}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] opacity-80">
                      {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      {m.role === "user" ? "Siz" : "AI"}
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    <DataTable rows={m.data} />
                    {!!m.suggestions?.length && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.suggestions.slice(0, 3).map((s) => (
                          <Badge
                            key={s}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => void sendMessage(s)}
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
              {sending && (
                <div className="mr-auto flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI tahlil qilmoqda...
                </div>
              )}
              <div ref={bottomRef} />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={2}
                  placeholder="Savolingizni yozing... (Enter yuboradi, Shift+Enter yangi qator)"
                />
                <Button
                  className="h-auto gap-2 sm:w-36"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || sending}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Yuborish
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
