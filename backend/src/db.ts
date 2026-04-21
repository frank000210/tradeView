import { Pool } from 'pg';

let pool: Pool | null = null;

/** Returns a PostgreSQL pool if POSTGRES_URI or DATABASE_URL is set, else null */
export function getPool(): Pool | null {
  const uri = process.env.POSTGRES_URI || process.env.DATABASE_URL;
  if (!uri) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: uri,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 3_000,
    });
    pool.on('error', (err) => {
      console.error('[db] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

/** Creates the signal_rules table if it does not exist. Returns true on success. */
export async function initDb(): Promise<boolean> {
  const p = getPool();
  if (!p) {
    console.log('[db] No POSTGRES_URI / DATABASE_URL found — using in-memory rule store');
    return false;
  }
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS signal_rules (
        id          VARCHAR(255) PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        description TEXT         DEFAULT '',
        script      TEXT         NOT NULL,
        is_default  BOOLEAN      DEFAULT FALSE,
        is_active   BOOLEAN      DEFAULT FALSE,
        created_at  BIGINT       NOT NULL,
        updated_at  BIGINT       NOT NULL
      )
    `);
    console.log('[db] signal_rules table ready');
    return true;
  } catch (err) {
    console.error('[db] Init failed:', (err as Error).message);
    return false;
  }
}
