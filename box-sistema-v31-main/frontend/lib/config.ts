/** ERP backend — zakazlar faqat ERP'da yaratiladi; BoxUI o'qiydi va scan qiladi. */
export const USE_ERP_API =
  process.env.NEXT_PUBLIC_API_SOURCE === "erp" ||
  process.env.NEXT_PUBLIC_USE_ERP === "1" ||
  process.env.NEXT_PUBLIC_USE_ERP === "true"

export const ERP_READONLY_ORDERS = USE_ERP_API
