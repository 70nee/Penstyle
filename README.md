# Penstyle

Penstyle is a private, paper-inspired notebook for handwritten and book-style notes. It supports rich text, movable images and text boxes, voice typing, customizable paper, editable `.pen` books, sharing, reading mode, and multi-format export.

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

The local app opens at `http://localhost:3000` by default.

## Environment

Copy `.env.example` to `.env.local` and provide:

- `NEXT_PUBLIC_SUPABASE_URL` — the public Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the browser-safe publishable key.
- `SUPABASE_SECRET_KEY` — the server-only secret used to verify authenticated API requests.

Never commit `.env.local`, provider client secrets, service-role keys, or the local `credentials` file. They are excluded by `.gitignore`.

## Storage model

- Supabase handles social authentication only.
- Cloudflare D1 stores a small ownership index for each account.
- Cloudflare R2 stores the latest private workspace and read-only share snapshots.
- A per-user browser cache protects in-progress writing and restores the last open book and page immediately.

Private workspace APIs verify the signed-in Supabase user on the server and derive storage keys from the verified user ID. Client-provided account identifiers are never trusted.

## Commands

```bash
npm test
npm run build
npm run lint
```

## Discord OAuth

Penstyle uses Supabase as the OAuth callback handler. In the Discord Developer Portal, add the callback URL shown in Supabase under **Authentication → Sign In / Providers → Discord**. Application return URLs such as localhost and the production domain belong in Supabase's redirect allow list, not in Discord's callback field.
