import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { SCHEMA_SQL, SCHEMA_VERSION } from "@/lib/db/schema";

type QueryResult<T> = { rows: T[]; affectedRows?: number; rowCount?: number | null };
type TransactionClient = {
  query<T extends Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  execute(text: string, params?: unknown[]): Promise<number>;
};

type Database = {
  query<T extends Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(text: string): Promise<void>;
  transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T>;
  mode: "pglite" | "postgres";
};

declare global {
  var __jeongseokDatabase: Promise<Database> | undefined;
  var __jeongseokDatabaseReady: Promise<void> | undefined;
}

async function createDatabase(): Promise<Database> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    return {
      mode: "postgres",
      query: async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) => pool.query<T>(text, params),
      exec: async (text: string) => {
        await pool.query(text);
      },
      transaction: async <T>(callback: (tx: TransactionClient) => Promise<T>) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await callback({
            query: async <R extends Record<string, unknown>>(text: string, params: unknown[] = []) => (await client.query<R>(text, params)).rows,
            execute: async (text: string, params: unknown[] = []) => (await client.query(text, params)).rowCount ?? 0,
          });
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
    };
  }

  const dataRoot = path.join(process.cwd(), ".data");
  await mkdir(dataRoot, { recursive: true });
  // PGlite's Node filesystem adapter expects an unescaped file path after file://.
  // pathToFileURL() percent-encodes Korean workspace names and PGlite treats the
  // encoded string as a literal directory name.
  const databaseUrl = `file://${path.join(dataRoot, "pglite")}`;
  const pglite = new PGlite(databaseUrl);
  await pglite.waitReady;
  return {
    mode: "pglite",
    query: async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) => pglite.query<T>(text, params),
    exec: async (text: string) => {
      await pglite.exec(text);
    },
    transaction: async <T>(callback: (tx: TransactionClient) => Promise<T>) => pglite.transaction(async (inner) => callback({
      query: async <R extends Record<string, unknown>>(text: string, params: unknown[] = []) => (await inner.query<R>(text, params)).rows,
      execute: async (text: string, params: unknown[] = []) => (await inner.query(text, params)).affectedRows ?? 0,
    })),
  };
}

export function getDatabase(): Promise<Database> {
  globalThis.__jeongseokDatabase ??= createDatabase();
  return globalThis.__jeongseokDatabase;
}

export async function ensureDatabase(): Promise<void> {
  globalThis.__jeongseokDatabaseReady ??= (async () => {
    const db = await getDatabase();
    await db.exec(SCHEMA_SQL);
    await db.query(
      "INSERT INTO schema_meta(version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
      [SCHEMA_VERSION],
    );
  })();
  return globalThis.__jeongseokDatabaseReady;
}

export async function query<T extends Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureDatabase();
  const db = await getDatabase();
  const result = await db.query<T>(text, params);
  return result.rows;
}

export async function execute(text: string, params: unknown[] = []): Promise<number> {
  await ensureDatabase();
  const db = await getDatabase();
  const result = await db.query(text, params);
  return result.rowCount ?? result.affectedRows ?? 0;
}

export async function databaseMode(): Promise<"pglite" | "postgres"> {
  const db = await getDatabase();
  return db.mode;
}

export async function withTransaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
  await ensureDatabase();
  const db = await getDatabase();
  return db.transaction(callback);
}
