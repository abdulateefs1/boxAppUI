const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

function buildPrompt(payload) {
  const { message, intent, rows } = payload
  return [
    "Sen And Billur Teks Box App uchun ombor assistantisan.",
    "Faqat berilgan real database context asosida javob ber.",
    "Taxmin qilma, sonlarni o'ylab topma.",
    "Javobni Uzbek tilida, aniq va qisqa ber.",
    "Agar data bo'sh bo'lsa: Bu model bo'yicha ma'lumot topilmadi.",
    `Intent: ${intent}`,
    `User savoli: ${message}`,
    "Context rows (JSON):",
    JSON.stringify(rows || [], null, 2),
  ].join("\n")
}

async function askGemini(payload) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY topilmadi")
    err.status = 500
    throw err
  }

  const prompt = buildPrompt(payload)
  const url = `${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 700,
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json?.error?.message || "Gemini javob qaytarmadi")
    err.status = res.status
    throw err
  }

  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text || !String(text).trim()) {
    const err = new Error("Gemini bo'sh javob qaytardi")
    err.status = 502
    throw err
  }
  return String(text).trim()
}

module.exports = {
  askGemini,
}
