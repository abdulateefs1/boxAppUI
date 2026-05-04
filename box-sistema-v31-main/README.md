# Box Sistema v3 — AND BILLUR TEXTILE

Knit garment B2B uchun box management tizimi. PostgreSQL bazasi va barcode-driven workflow.

## Loyiha tuzilishi

```
box-sistema-v31-main/
├── backend/                 ← Express API (PostgreSQL, /api, splash)
│   ├── server.js
│   ├── db.js
│   ├── package.json
│   └── public/
├── frontend/                ← Next.js + Tailwind UI
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   └── out/                   ← production build (STATIC_EXPORT=1)
├── package.json             ← umumiy skriptlar (dev:stack, build)
└── README.md
```

- **Backend** — `backend/`: `node backend/server.js` yoki ildizdan `npm start`.
- **Frontend** — `frontend/`: `npm run dev:web` yoki `cd frontend && npm run dev`.

## 🚀 Asosiy xususiyatlar

- 📲 **Barcode skanerlash** — order avtomatik topiladi
- 📦 **Box numbering** — har zakaz ichida 01-50 raqamlash (zakaz orasida takrorlanishi mumkin: `600/01` va `601/01` alohida)
- 🎨 **Mix box** — bir nechta model (2+), har model uchun alohida razmer
- 🚛 **Shipment** — open/close oqim, transactional
- 📋 **Detalniy hisobot** — Excel formatida eksport
- 🏆 **Bugungi reyting** — ishchilar bo'yicha
- 👥 **3 rol** — Admin / Omborchi / Ishchi
- 📜 **Audit log** — barcha amallar IP bilan

## 🔒 Xavfsizlik

- **scrypt** parol hashlash (har user uchun random salt, `crypto.timingSafeEqual`)
- **Rate limit** — 15 daqiqada 10 noto'g'ri urinishdan keyin IP ban
- **CSP, HSTS, X-Frame-Options** headerlari
- **HttpOnly + Secure + SameSite=Strict** cookielar (production)
- **CORS allowlist** — production'da faqat `ALLOWED_ORIGIN` dagi domen (`https://…`)
- Avtomatik **HTTP→HTTPS** redirect production'da
- **Eski SHA-256 → scrypt** avtomatik migratsiya
- Parol o'zgartirilganda **boshqa sessionlar yopiladi**
- Audit log'da IP yoziladi

## 📦 Render'ga deploy qilish (app.andbillur.com)

### 1. PostgreSQL yaratish
1. Render dashboard → **New** → **PostgreSQL**
2. Name: `boxapp-db`, Region: Frankfurt yoki yaqin
3. Plan: Starter (Free) yoki Pro
4. Yaratilgach **Internal Database URL**ni nusxa oling

### 2. Web Service yaratish
1. **New** → **Web Service** → GitHub'dan repo tanlang
2. **Monorepo** (`boxAppUI` → `box-sistema-v31-main/`): **Settings → Root Directory** = `box-sistema-v31-main` (bo‘lmasa `frontend/out` yig‘ilmaydi va splash chiqadi).
3. Sozlamalar:
   - **Build Command** (qat’iy): `npm install --prefix backend && npm run build --prefix backend` (`npm install && npm run build` — noto‘g‘ri; root `package.json` xato kombinatsiyada NPM xatolari berishi mumkin).
   - **Start Command**: `node backend/server.js`
   - **Node:** `NODE_VERSION` = `20.18.1` yoki `.nvmrc` (`20`) — Render default Node 24 ba’zan npm bilan muammo qiladi.

Dashboarddagi Build Command blueprintdan **ustun** turadi — eski buyruq qolsa, Render’da **qo‘lda yangilang** yoki “Apply Blueprint”.

### 3. Environment Variables
| O'zgaruvchi | Qiymat |
|-------------|--------|
| `DATABASE_URL` | PostgreSQL Internal URL |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGIN` | `https://app.andbillur.com` (bir nechta: vergul bilan) |
| `PORT` | `3000` (Render avtomatik beradi) |
| `NODE_VERSION` | `20.18.1` (tavsiya) |

Paketlar: **npm** (`frontend/pnpm-lock.yaml` olib tashlangan — CI aralasha pnpm/npm ishlatmasin).

### 4. Custom Domain
1. Web Service → **Settings** → **Custom Domains**
2. `app.andbillur.com` qo'shing
3. DNS sozlash (CNAME yoki A yozuv): Render ko'rsatadigan qiymat
4. SSL avtomatik tarqatiladi (Let's Encrypt)

### Split deploy (UI alohida + API alohida)

Agar **frontend** masalan `https://app.andbillur.com`, **API** esa `https://boxapp-ww9m.onrender.com` bo‘lsa:

1. **Frontendni qayta build** qiling (`STATIC_EXPORT=1`) — build oldidan:
   - `NEXT_PUBLIC_API_BASE_URL=https://boxapp-ww9m.onrender.com`  
   (sizning backend URL; **oxirida `/` qo‘ymang**.)
2. Backend (API) servisida **`ALLOWED_ORIGIN=https://app.andbillur.com`** (aniq shu, `https://` bilan).
3. Brauzer **Network** → login so‘rovi **`boxapp-...onrender.com/api/login`** ga ketyaptimi yoki **`app.andbillur.com/api/...`** ga? Agar ikkinchisi bo‘lsa — `NEXT_PUBLIC_API_BASE_URL` buildga kirmagan.
4. **`/api/login` 500** — odatda PostgreSQL: API servisida **`DATABASE_URL`** ulanganini va Render **Logs** dagi `Login error:` qatorini tekshiring.

### 5. Birinchi kirish
- URL: `https://app.andbillur.com`
- Login: `admin`
- Parol: `admin123`
- ⚠️ **DARHOL** Profil → Parolni o'zgartirish'dan parolni almashtiring!

## 💻 Lokal ishga tushirish

Frontend — **Next.js** (`frontend/`); API — **Express** (`backend/server.js`). Odatda ikki yo‘l:

**Bitta port (tavsiya):** API + proxy orqali Next dev

```bash
cd box-sistema-v31-main
export DATABASE_URL=postgres://user:pass@localhost:5432/boxapp
export NODE_ENV=development
npm install
npm run dev:stack
```

Brauzer: **http://localhost:3000** (`FRONTEND_MODE=proxy`, Next dev `3001` orqasi).

**Ikki terminal:** faqat API yoki faqat UI

```bash
cd box-sistema-v31-main
npm install
# Terminal 1
npm run dev:api
# Terminal 2
npm run dev:web   # http://localhost:3001 — rewrites: API → Express :3000
```

Production: `npm run build` (ildizda), keyin `NODE_ENV=production node backend/server.js` — `frontend/out` + `/api`.

`frontend/.env.example` — `API_TARGET`, `NEXT_PUBLIC_API_BASE_URL`.

## 🗄 Database schema

```
users        — id, username, password (scrypt), role, name
orders       — id, model, color, barcode (UNIQUE), total
boxes        — uid, box_num, zakaz, type, kg, status, model, color, sizes/items
               UNIQUE(zakaz, box_num)  ← zakaz ichida unique
shipments    — id, truck_info, status, box_uids, snapshot
sessions     — token, user_data (8 soat TTL)
audit_logs   — type, by_user, details, ip, at
```

## 📋 Rollar

| Rol | Imkoniyatlari |
|-----|---------------|
| 👑 Admin | Hammasi: order CRUD, user CRUD, audit log, parol reset |
| 🏭 Omborchi | Box → ombor o'tkazish, shipment ochish/yopish, detalniy |
| 👷 Ishchi | Barcode skan + box yaratish, o'z reytingini ko'rish |

## 🔄 Box status oqimi

```
packed (qadoqlandi) → warehouse (omborda) → shipping (shipmentda) → shipped (yuborilgan)
```

- Ishchi: faqat `packed` yaratadi
- Omborchi: `packed → warehouse`, undo (2 daq)
- Shipment ochilgan: `warehouse → shipping`
- Shipment yopilgan: `shipping → shipped`

## 🆕 v2 dan v3 ga o'zgarishlar

- ✅ JSON fayl o'rniga **PostgreSQL**
- ✅ Box raqami **zakaz ichida** unique (eski: global unique edi)
- ✅ Order'da **barcode** maydoni qo'shildi
- ✅ Mix box **2+ model / barcode oqimi**
- ✅ Yangi UI, mobile-friendly
- ✅ Security hardening (scrypt, rate limit, CSP, HSTS, va h.k.)

## ❓ Muammolar

**Login ishlamayapti?**
- DATABASE_URL to'g'rimi? `/health` endpoint'ni tekshiring
- Render PostgreSQL ulangan emas → Internal URL bering
- Eski parolni unuttingizmi → Render Shell'dan: `psql $DATABASE_URL` → `DELETE FROM users WHERE username='admin';` → server restart (yangi admin/admin123 yaratiladi)

**"DATABASE_URL topilmadi"?**
- Web Service → Environment → DATABASE_URL qo'shing

**CORS xato?**
- `ALLOWED_ORIGIN` env'da to'g'ri domain bormi?

## 📞 Texnik

- Node.js 18+
- Express 4.x
- PostgreSQL 14+
- ExcelJS (Detalniy export uchun)
- Native scrypt (qo'shimcha paket kerakmas)

---

**AND BILLUR TEXTILE** © 2025
