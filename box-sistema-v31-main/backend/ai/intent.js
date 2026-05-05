function normalizeMessage(message) {
  return String(message || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function extractThreshold(message) {
  const m = String(message || "").match(/(\d{1,3})\s*%/)
  if (!m) return 70
  const n = parseInt(m[1], 10)
  if (Number.isNaN(n)) return 70
  return Math.max(1, Math.min(100, n))
}

function extractModelHint(rawMessage) {
  const msg = String(rawMessage || "").trim()
  if (!msg) return ""
  const codeLike = msg.match(/[A-Za-z]{2,}\s*[-_]?\s*\d{2,}[A-Za-z0-9-]*/g)
  if (codeLike && codeLike[0]) return codeLike[0].replace(/\s+/g, " ").trim()
  const quoted = msg.match(/"([^"]+)"/)
  if (quoted && quoted[1]) return quoted[1].trim()
  return msg
}

function detectIntent(rawMessage) {
  const message = normalizeMessage(rawMessage)
  const threshold = extractThreshold(message)
  const modelHint = extractModelHint(rawMessage)

  if (!message) {
    return { intent: "unknown", threshold, modelHint }
  }

  if (
    message.includes("mismatch") ||
    message.includes("mos kelmay") ||
    message.includes("xato") ||
    message.includes("audit")
  ) {
    return { intent: "mismatch_audit", threshold, modelHint }
  }

  if (
    message.includes("izlishka") ||
    message.includes("surplus") ||
    message.includes("qolib ket") ||
    message.includes("yuklanmay qol")
  ) {
    return { intent: "surplus_inventory", threshold, modelHint }
  }

  if (
    message.includes("bugun") && message.includes("shipment")
  ) {
    return { intent: "shipment_today_summary", threshold, modelHint }
  }

  if (
    (message.includes("shipmentga") || message.includes("yuklashga")) &&
    (message.includes("tayyor") || message.includes("ready"))
  ) {
    return { intent: "shipment_readiness", threshold, modelHint }
  }

  if (
    (message.includes("progress") || message.includes("tayyor")) &&
    message.includes("%")
  ) {
    return { intent: "order_progress", threshold, modelHint }
  }

  if (
    message.includes("razmer") ||
    message.includes("size") ||
    message.includes("qaysi razmer")
  ) {
    return { intent: "size_breakdown", threshold, modelHint }
  }

  if (
    message.includes("nechta karobka") ||
    message.includes("qaysi zakaz") ||
    message.includes("qancha qoldi") ||
    message.includes("model") ||
    message.includes("order")
  ) {
    return { intent: "model_order_search", threshold, modelHint }
  }

  return { intent: "model_order_search", threshold, modelHint }
}

module.exports = {
  detectIntent,
}
