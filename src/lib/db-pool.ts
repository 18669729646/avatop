/**
 * 统一数据库连接池
 * 避免每个模块单独创建连接池，减少资源消耗
 *
 * 如果本地数据库未启动，则自动降级为“空操作”连接，避免应用启动阶段直接崩溃。
 */
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

const hasDatabaseUrl = Boolean(process.env.PGDATABASE_URL);

if (!hasDatabaseUrl && process.env.NODE_ENV === 'production') {
  console.warn('[DB Pool] Warning: PGDATABASE_URL is not configured. Database features will be unavailable.');
}

function createEmptyResult<T extends QueryResultRow = QueryResultRow>(): QueryResult<T> {
  return {
    command: 'SELECT',
    rowCount: 0,
    oid: 0,
    rows: [],
    fields: [],
  };
}

const noopPool = {
  async query<T extends QueryResultRow = QueryResultRow>(): Promise<QueryResult<T>> {
    return createEmptyResult<T>();
  },
  async connect(): Promise<PoolClient> {
    throw new Error('Database is unavailable: PGDATABASE_URL is not configured or database is unreachable');
  },
  async end(): Promise<void> {
    return undefined;
  },
  on(): void {
    return undefined;
  },
} as unknown as Pool;

// 单例连接池
const pool: Pool = hasDatabaseUrl
  ? new Pool({
      connectionString: process.env.PGDATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.PGDATABASE_URL?.includes('pooler.supabase.com')
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : noopPool;

// 监听连接池错误，避免进程崩溃
if (hasDatabaseUrl) {
  pool.on('error', (err) => {
    console.error('[DB Pool] Unexpected error on idle client:', err);
  });
}

// 导出连接池
export { pool };

// 导出类型
export type { Pool };
