"use client"

import { USE_ERP_API } from "./config"
import { erpApi } from "./api-erp"
import { legacyApi } from "./api-legacy"

export {
  API_BASE_URL,
  ApiError,
  getToken,
  setToken,
} from "./api-core"

/** Standalone BoxApp backend yoki BILLUR ERP — `NEXT_PUBLIC_API_SOURCE=erp` */
export const api = USE_ERP_API ? erpApi : legacyApi
