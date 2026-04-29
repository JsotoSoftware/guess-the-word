# Database foundation

This directory contains plain SQL migrations and seed files for the server workspace.

## Structure
- `migrations/` — schema changes applied in order
- `seeds/` — idempotent seed data files

## Scripts
Run from the repository root:
- `npm run db:migrate --workspace @guess-the-word/server`
- `npm run db:seed --workspace @guess-the-word/server`
- `npm run db:check --workspace @guess-the-word/server`

Or from `apps/server`:
- `npm run db:migrate`
- `npm run db:seed`
- `npm run db:check`
