# Lider Parfum — Frontend

Statik do'kon va admin panel (Vercel uchun).

## Lokal ishga tushirish

**1. Backend** (alohida terminal):

```bash
cd backend
npm install
cp .env.example .env
# .env ni to'ldiring
npm start
```

**2. Frontend**:

```bash
cd frontend
npm run dev
```

- Do'kon: http://localhost:3000
- Admin: http://localhost:3000/admin

Lokalda `public/config.js` avtomatik `http://localhost:3001` ga ulanadi.

## Vercel deploy

1. Vercel da `frontend` papkani ulang
2. **Environment Variables** qo'shing:
   - `API_URL` = Railway backend URL (masalan: `https://xxx.up.railway.app`)
3. Deploy — build avtomatik `config.js` yaratadi

## Railway (backend)

Backend sozlamalari uchun `../backend/README.md` ni o'qing.

`FRONTEND_URL` ga Vercel domeningizni qo'shing (CORS uchun).

## Struktura

```
public/
├── index.html      — do'kon
├── admin.html      — admin mahsulotlar
├── admin-catalog.html
├── config.js       — API URL (build da generatsiya)
├── api.js          — apiUrl(), imageUrl()
├── app.js
├── admin.js
└── admin-catalog.js
```
