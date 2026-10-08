import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

// The common base of the client and its transactions, so repos work inside db.transaction().
export type Db = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;
