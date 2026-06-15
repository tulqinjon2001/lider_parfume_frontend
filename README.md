# Lider Parfum

## O'rnatish

```bash
npm install
cp .env.example .env
```

`.env` faylida Telegram, admin paroli va Supabase kalitlarini kiriting.

## Supabase sozlash

1. [supabase.com](https://supabase.com) da loyiha yarating
2. **SQL Editor** da `supabase/schema.sql` faylini to'liq nusxalab **RUN** bosing
3. **Project Settings → API** dan oling:
   - `SUPABASE_URL` → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` → **service_role** (secret) — `sb_publishable_` emas!

`PGRST205` xatosi — jadvallar hali yaratilmagan. `schema.sql` ni qayta ishga tushiring.

## Ishga tushirish

```bash
npm start
```

- Sayt: http://localhost:3001
- Admin: http://localhost:3001/admin

## Admin panel

1. `.env` da `ADMIN_PASSWORD` o'rnating
2. `/admin` ga kiring
3. Brend va kategoriya qo'shing
4. Mahsulot qo'shing, variantlar (hid, o'lcham) kiriting
5. Rasm yuklang (fayl yoki link)
6. **Saqlash** tugmasini bosing

Mahsulotlar Supabase da saqlanadi.
Rasmlar `public/images/` papkasida (yoki tashqi link).

## Telegram bot

1. [@BotFather](https://t.me/BotFather) da bot yarating
2. Token → `TELEGRAM_BOT_TOKEN`
3. Chat ID → [@userinfobot](https://t.me/userinfobot)
