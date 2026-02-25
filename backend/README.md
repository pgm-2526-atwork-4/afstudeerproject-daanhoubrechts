# Backend (Express + Supabase)

Express.js API met Supabase als database.

## Setup

1. Kopieer `.env.example` naar `.env`:

   ```bash
   cp .env.example .env
   ```

2. Vul je Supabase-gegevens in. Maak een project aan op [supabase.com](https://supabase.com), ga naar **Project Settings → API** en neem over:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`

3. Installeer dependencies en start de dev-server:
   ```bash
   npm install
   npm run dev
   ```

De server draait op `http://localhost:3000` (of de poort in `PORT` in `.env`).

## Scripts

- `npm run dev` – start met hot reload (`tsx watch`)
- `npm run build` – compileert TypeScript naar `dist/`
- `npm start` – start de gebouwde app (`node dist/index.js`)
