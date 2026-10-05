# Claude / OpenCode Instructions for Step Challenge

## Project overview

This is a server-rendered step-tracking application running on Cloudflare Workers.

- **Framework:** Hono (TypeScript)
- **Database:** Cloudflare D1 (SQLite)
- **Sessions:** Cloudflare KV
- **Image uploads:** Cloudflare R2
- **Styling:** Tailwind CSS via CDN
- **Config:** `wrangler.jsonc`

## Coding conventions

- Use TypeScript for all source files.
- Prefer Web Crypto APIs for hashing/tokens.
- Keep logic modular: routes live in `src/routes/`, DB helpers in `src/db.ts`, auth in `src/auth.ts`, templates in `src/templates.ts`.
- Escape all dynamic values in HTML templates using the existing `escapeHtml` helper.
- Store secrets in Wrangler Secrets / `.dev.vars`, never hardcode them.
- Re-run `wrangler types` after changing `wrangler.jsonc` bindings.

## Database changes

Use D1 migrations in the `migrations/` directory. Do not edit already-applied migrations.

```bash
npx wrangler d1 migrations create stepchallenge <name>
npm run db:migrate:local   # local
npm run db:migrate:remote  # production
```

## Git workflow

**Default rule:** For any new feature or change, create a feature branch and work there. Do not commit directly to `main`, and do not merge directly to `main`.

If the developer explicitly asks you to override this directive and merge or commit directly to `main`, you may do so.

## Before deploying

1. Run `npx tsc --noEmit`.
2. Run local smoke tests with `npm run dev`.
3. Apply remote migrations if needed.
4. Deploy with `npm run deploy`.
