# Lider Parfum

## O'rnatish

```bash
npm install
cp .env.example .env
```

`.env` faylida Telegram va admin parolini kiriting.

## Ishga tushirish

```bash
npm start
```

- Sayt: http://localhost:3001
- Admin: http://localhost:3001/admin

## Admin panel

1. `.env` da `ADMIN_PASSWORD` o'rnating
2. `/admin` ga kiring
3. Mahsulot qo'shing, variantlar (hid, o'lcham, narx) kiriting
4. Rasm ustiga bosing — fayl yuklang
5. **Saqlash** tugmasini bosing

Mahsulotlar `data/products.json` da saqlanadi.
Rasmlar `public/images/` papkasida.

## Telegram bot

1. [@BotFather](https://t.me/BotFather) da bot yarating
2. Token → `TELEGRAM_BOT_TOKEN`
3. Chat ID → [@userinfobot](https://t.me/userinfobot)
