import "server-only";

import { Pool, type QueryResultRow } from "pg";

const globalForPostgres = globalThis as typeof globalThis & {
  lecturerStudentsPool?: Pool;
};

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL chưa được cấu hình cho các API PostgreSQL của lecturer.",
    );
  }

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on("error", (error) => {
    console.error("PostgreSQL pool error:", error);
  });

  return pool;
}

function getPool(): Pool {
  if (!globalForPostgres.lecturerStudentsPool) {
    globalForPostgres.lecturerStudentsPool = createPool();
  }

  return globalForPostgres.lecturerStudentsPool;
}

export async function query<Row extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<Row[]> {
  const result = await getPool().query<Row>(text, values);
  return result.rows;
}
