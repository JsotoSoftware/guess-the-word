# @guess-the-word/server

Backend workspace using NestJS + Socket.IO + TypeScript + Slonik.

## Database scripts
- `npm run db:migrate`
- `npm run db:seed`
- `npm run db:check`

## Word management scripts
- `npm run words:import -- ./path/to/words.txt --language es --difficulty facil --category general`
- `npm run words:import -- ./path/to/words.json --dry-run`
- `npm run words:activate -- --word queso --language es`
- `npm run words:deactivate -- --word queso --language es`
