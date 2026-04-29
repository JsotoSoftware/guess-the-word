import { sql } from 'slonik'

export function unsafeRawSql(rawSql: string) {
  const raw = Object.freeze([rawSql])
  const parts = Object.freeze(Object.assign([rawSql], { raw }))

  return sql.unsafe(parts)
}
