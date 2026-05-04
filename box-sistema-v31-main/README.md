# Box Sistema v3 — AND BILLUR TEXTILE

Knit garment B2B uchun box management tizimi. PostgreSQL bazasi va barcode-driven workflow.

## 🚀 Asosiy xususiyatlar

- 📲 **Barcode skanerlash** — order avtomatik topiladi
- 📦 **Box numbering** — har zakaz ichida 01-50 raqamlash (zakaz orasida takrorlanishi mumkin: `600/01` va `601/01` alohida)
- 🎨 **Mix box** — 2 ta barcode skanerlanadi, har model uchun alohida razmer
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
- **CORS allowlist** — faqat `ALLOWED_ORIGINS` env'dagi domenlar
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
2. Sozlamalar:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Node Version**: 18+ (avtomatik)

### 3. Environment Variables
| O'zgaruvchi | Qiymat |
|-------------|--------|
| `DATABASE_URL` | PostgreSQL Internal URL |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://app.andbillur.com` |
| `PORT` | `3000` (Render avtomatik beradi) |

### 4. Custom Domain
1. Web Service → **Settings** → **Custom Domains**
2. `app.andbillur.com` qo'shing
3. DNS sozlash (CNAME yoki A yozuv): Render ko'rsatadigan qiymat
4. SSL avtomatik tarqatiladi (Let's Encrypt)

### 5. Birinchi kirish
- URL: `https://app.andbillur.com`
- Login: `admin`
- Parol: `admin123`
- ⚠️ **DARHOL** Profil → Parolni o'zgartirish'dan parolni almashtiring!

## 💻 Lokal ishga tushirish

```bash
# PostgreSQL ulanish
export DATABASE_URL=postgres://user:pass@localhost:5432/boxapp
export NODE_ENV=development

# Paketlarni o'rnatish
npm install

# Serverni boshlash
node server.js
```

Browser: http://localhost:3000

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
- ✅ Mix box **2× barcode skan**
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
- `ALLOWED_ORIGINS` env'da to'g'ri domain bormi?

## 📞 Texnik

- Node.js 18+
- Express 4.x
- PostgreSQL 14+
- ExcelJS (Detalniy export uchun)
- Native scrypt (qo'shimcha paket kerakmas)

---

**AND BILLUR TEXTILE** © 2025
