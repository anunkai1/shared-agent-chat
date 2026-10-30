import { createDb, type Database } from "@alook/shared"

export { withD1Retry } from "@alook/shared"

export function getDb(d1: D1Database, consistency: "first-primary" | "first-unconstrained" = "first-unconstrained"): Database {
  const session = d1.withSession(consistency)
  return createDb(session as unknown as Parameters<typeof createDb>[0])
}

export function getPrimaryDb(d1: D1Database): Database {
  return getDb(d1, "first-primary")
}
