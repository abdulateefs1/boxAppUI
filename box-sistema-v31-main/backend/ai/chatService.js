const { detectIntent } = require("./intent")
const { runIntentQuery } = require("./repository")
const { askGemini } = require("./geminiClient")

function buildSuggestions(intent) {
  const map = {
    model_order_search: [
      "Shu model qaysi zakazlarda ko'proq qolgan?",
      "Shu model bo'yicha faqat ombordagi qoldiqni chiqar",
    ],
    size_breakdown: [
      "Eng ko'p qolgan 3 ta razmerni ayt",
      "Qaysi razmerlar shipmentga tayyor?",
    ],
    order_progress: [
      "80% dan oshgan orderlarni ham ko'rsat",
      "100% tayyor bo'lgan orderlarni ajrat",
    ],
    shipment_readiness: [
      "Tayyor orderlardan qaysi biri hali jo'natilmagan?",
      "Shipment bo'yicha ustuvor ro'yxat ber",
    ],
    shipment_today_summary: [
      "Bugungi shipmentlar bo'yicha risklarni ayt",
      "Qaysi shipmentda box soni eng ko'p?",
    ],
    surplus_inventory: [
      "Qaysi model/rang eng ko'p izlishka bo'lib qolgan?",
      "Izlishka bo'yicha top-10 ro'yxat ber",
    ],
    mismatch_audit: [
      "Eng katta farqli orderlarni birinchi ko'rsat",
      "Mismatch sababini tekshirish uchun keyingi qadamlarni ayt",
    ],
  }
  return map[intent] || []
}

function fallbackAnswer(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "Bu model bo'yicha ma'lumot topilmadi."
  }
  return `Topildi: ${rows.length} ta yozuv. Quyidagi jadvalda ko'rishingiz mumkin.`
}

async function processAiChat({ pool, message }) {
  const parsed = detectIntent(message)
  const rows = await runIntentQuery(pool, parsed)
  const limitedRows = (rows || []).slice(0, 50)
  if (!limitedRows.length) {
    return {
      intent: parsed.intent,
      answer: "Bu model bo'yicha ma'lumot topilmadi.",
      data: [],
      suggestions: buildSuggestions(parsed.intent),
    }
  }

  let answer = ""
  try {
    answer = await askGemini({
      message,
      intent: parsed.intent,
      rows: limitedRows,
    })
  } catch {
    answer = fallbackAnswer(limitedRows)
  }

  return {
    intent: parsed.intent,
    answer,
    data: limitedRows,
    suggestions: buildSuggestions(parsed.intent),
  }
}

module.exports = {
  processAiChat,
}
