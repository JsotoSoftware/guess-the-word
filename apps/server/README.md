# @guess-the-word/server

Backend workspace using NestJS + Socket.IO + TypeScript + Slonik.

## Database scripts
- `npm run db:migrate`
- `npm run db:seed`
- `npm run db:check`

## Word management scripts
- `npm run words:import -- ./path/to/words.txt --language es --category general`
- `npm run words:import -- ./path/to/words.json --dry-run`
- `npm run words:activate -- --word queso --language es`
- `npm run words:deactivate -- --word queso --language es`

JSON imports can include `category` and `hint` per word, for example:

```json
[
  {
    "word": "totoro",
    "category": "anime",
    "hint": "Espíritu del bosque de Studio Ghibli"
  }
]
```
