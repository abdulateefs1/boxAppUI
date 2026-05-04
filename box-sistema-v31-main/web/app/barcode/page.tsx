"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { ScanBarcode, Loader2, Smartphone, Keyboard } from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { Input } from "@/components/ui/input"
import { BoxTypeModal } from "@/components/barcode/box-type-modal"
import { SimpleBoxModal } from "@/components/barcode/simple-box-modal"
import { MixBoxModal } from "@/components/barcode/mix-box-modal"
import { api } from "@/lib/api"
import type { Order } from "@/lib/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type SearchState = "idle" | "searching" | "found" | "not_found"

export default function BarcodePage() {
  const [barcode, setBarcode] = useState("")
  const [searchState, setSearchState] = useState<SearchState>("idle")
  const [foundOrder, setFoundOrder] = useState<Order | null>(null)
  const [showBoxTypeModal, setShowBoxTypeModal] = useState(false)
  const [showSimpleBoxModal, setShowSimpleBoxModal] = useState(false)
  const [showMixBoxModal, setShowMixBoxModal] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSearch = useCallback(async (code: string) => {
    if (!code.trim()) return
    setSearchState("searching")
    try {
      const order = await api.getOrderByBarcode(code.trim())
      setFoundOrder(order)
      setSearchState("found")
      setShowBoxTypeModal(true)
    } catch (e: any) {
      setFoundOrder(null)
      setSearchState("not_found")
      toast.error("Barcode topilmadi", {
        description: e?.message || `"${code}" barcodeiga mos order topilmadi.`,
      })
      setTimeout(() => {
        setBarcode("")
        setSearchState("idle")
        inputRef.current?.focus()
      }, 1500)
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && barcode.trim()) handleSearch(barcode)
  }

  const handleBoxTypeSelect = (type: "simple" | "mix") => {
    setShowBoxTypeModal(false)
    if (type === "simple") setShowSimpleBoxModal(true)
    else setShowMixBoxModal(true)
  }

  const handleModalClose = () => {
    setShowBoxTypeModal(false)
    setShowSimpleBoxModal(false)
    setShowMixBoxModal(false)
    setBarcode("")
    setSearchState("idle")
    setFoundOrder(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleBoxCreated = () => {
    handleModalClose()
  }

  return (
    <>
      <AppHeader title="Barcode skan" icon={<ScanBarcode className="h-4 w-4" />} />

      <main className="flex flex-1 flex-col items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-xl">
          <div className="mb-8 flex justify-center">
            <div
              className={cn(
                "relative flex h-24 w-24 items-center justify-center rounded-3xl transition-all duration-500",
                searchState === "searching"
                  ? "bg-amber-100 animate-pulse"
                  : searchState === "not_found"
                    ? "bg-red-100"
                    : "bg-primary/10"
              )}
            >
              <ScanBarcode
                className={cn(
                  "h-10 w-10 transition-colors duration-300",
                  searchState === "searching"
                    ? "text-amber-600"
                    : searchState === "not_found"
                      ? "text-red-600"
                      : "text-primary"
                )}
              />
              {searchState === "idle" && (
                <div className="absolute inset-0 rounded-3xl ring-4 ring-primary/20 animate-ping opacity-75" />
              )}
            </div>
          </div>

          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Barcode Skanerlash</h1>
            <p className="mt-2 text-muted-foreground">Skanerni ulang yoki qo&apos;lda kiriting</p>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-primary/5 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Smartphone className="h-4 w-4 text-primary" />
              </div>
              <p className="flex-1 text-sm text-muted-foreground">
                Skanerni ulang yoki barcode yozib{" "}
                <kbd className="mx-1 inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground">
                  <Keyboard className="h-2.5 w-2.5" />
                  Enter
                </kbd>{" "}
                bosing
              </p>
            </div>

            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                placeholder="Barcode kiriting..."
                disabled={searchState === "searching"}
                className={cn(
                  "h-16 rounded-xl border-2 bg-background text-center font-mono text-2xl font-semibold tracking-[0.2em] transition-all duration-200",
                  "placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal",
                  searchState === "searching" && "border-amber-300 bg-amber-50/50",
                  searchState === "not_found" && "border-red-300 bg-red-50/50",
                  searchState === "idle" && "border-border focus:border-primary focus:ring-4 focus:ring-primary/10"
                )}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
              />

              {searchState === "searching" && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                </div>
              )}
            </div>

            {searchState === "searching" && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-amber-600">
                <span className="animate-pulse">Qidirilmoqda...</span>
              </div>
            )}

            {searchState === "not_found" && (
              <div className="mt-4 text-center text-sm text-red-600">
                Barcode topilmadi. Qaytadan tekshiring.
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              Skaner avtomatik aniqlaydi
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              Katta-kichik harf farq qilmaydi
            </span>
          </div>
        </div>
      </main>

      <BoxTypeModal
        open={showBoxTypeModal}
        onOpenChange={setShowBoxTypeModal}
        order={foundOrder}
        onSelect={handleBoxTypeSelect}
        onCancel={handleModalClose}
      />

      <SimpleBoxModal
        open={showSimpleBoxModal}
        onOpenChange={setShowSimpleBoxModal}
        order={foundOrder}
        onSave={handleBoxCreated}
        onCancel={handleModalClose}
      />

      <MixBoxModal
        open={showMixBoxModal}
        onOpenChange={setShowMixBoxModal}
        initialOrder={foundOrder}
        onSave={handleBoxCreated}
        onCancel={handleModalClose}
      />
    </>
  )
}
