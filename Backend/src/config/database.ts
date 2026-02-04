import { Pool, PoolConfig, PoolClient, QueryResult, QueryResultRow } from 'pg';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: SSLConfig | boolean;
  pool: PoolSettings;
}

export interface SSLConfig {
  rejectUnauthorized: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

export interface PoolSettings {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  maxUses: number;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface QueryOptions {
  timeout?: number;
  rowMode?: 'array';
}

// ===========================================
// CONFIGURATION
// ===========================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

const getSSLConfig = (): SSLConfig | boolean => {
  const sslMode = process.env.DB_SSL_MODE || 'disable';

  switch (sslMode) {
    case 'disable':
      return false;

    case 'require':
      // Require SSL but don't verify certificate (not recommended for production)
      return {
        rejectUnauthorized: false,
      };

    case 'verify-ca':
    case 'verify-full':
      // Full SSL verification - required for HIPAA compliance in production
      return {
        rejectUnauthorized: true,
        ca: process.env.DB_SSL_CA || undefined,
        cert: process.env.DB_SSL_CERT || undefined,
        key: process.env.DB_SSL_KEY || undefined,
      };

    default:
      return false;
  }
};

const getDatabaseConfig = (): DatabaseConfig => {
  // Support both individual settings and connection string
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    // Parse connection string and extract settings
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      database: url.pathname.slice(1),
      user: url.username,
      password: url.password,
      ssl: getSSLConfig(),
      pool: {
        min: parseInt(process.env.DB_POOL_MIN || '2', 10),
        max: parseInt(process.env.DB_POOL_MAX || '10', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        maxUses: 7500, // Close connections after this many queries (prevents memory leaks)
      },
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'home_health_care_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: getSSLConfig(),
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      maxUses: 7500,
    },
  };
};

// ===========================================
// DATABASE POOL CLASS
// ===========================================

class Database {
  private pool: Pool | null = null;
  private config: DatabaseConfig;
  private retryConfig: RetryConfig;
  private isConnecting: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(config?: Partial<DatabaseConfig>, retryConfig?: Partial<RetryConfig>) {
    this.config = { ...getDatabaseConfig(), ...config };
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Get the connection pool configuration for pg
   */
  private getPoolConfig(): PoolConfig {
    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl,
      min: this.config.pool.min,
      max: this.config.pool.max,
      idleTimeoutMillis: this.config.pool.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.pool.connectionTimeoutMillis,
      maxUses: this.config.pool.maxUses,

      // HIPAA-compliant settings
      application_name: 'HomeHealthCareAIAssistant',
      statement_timeout: 30000, // 30 second query timeout
      query_timeout: 30000,

      // Connection lifecycle logging for audit purposes
      log: (msg: string) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[DB Pool] ${msg}`);
        }
      },
    };
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate delay with exponential backoff
   */
  private getRetryDelay(attempt: number): number {
    const delay = this.retryConfig.initialDelayMs *
      Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Initialize the connection pool with retry logic
   */
  async connect(): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.pool) {
      return;
    }

    this.isConnecting = true;
    this.connectionPromise = this.connectWithRetry();

    try {
      await this.connectionPromise;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  /**
   * Internal connection method with retry logic
   */
  private async connectWithRetry(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        console.log(`[Database] Connection attempt ${attempt}/${this.retryConfig.maxAttempts}...`);

        this.pool = new Pool(this.getPoolConfig());

        // Set up pool event handlers
        this.setupPoolEventHandlers();

        // Test the connection
        const client = await this.pool.connect();

        // Verify connection with a simple query
        await client.query('SELECT NOW()');
        client.release();

        console.log('[Database] Connected successfully');
        console.log(`[Database] Pool size: min=${this.config.pool.min}, max=${this.config.pool.max}`);

        // Log SSL status for compliance verification
        if (this.config.ssl) {
          console.log('[Database] SSL: Enabled');
        } else {
          console.warn('[Database] SSL: Disabled (not recommended for production)');
        }

        return;
      } catch (error) {
        lastError = error as Error;

        // Clean up failed pool
        if (this.pool) {
          await this.pool.end().catch(() => {});
          this.pool = null;
        }

        console.error(`[Database] Connection attempt ${attempt} failed:`, lastError.message);

        if (attempt < this.retryConfig.maxAttempts) {
          const delay = this.getRetryDelay(attempt);
          console.log(`[Database] Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Failed to connect to database after ${this.retryConfig.maxAttempts} attempts. ` +
      `Last error: ${lastError?.message}`
    );
  }

  /**
   * Set up event handlers for pool monitoring and HIPAA audit logging
   */
  private setupPoolEventHandlers(): void {
    if (!this.pool) return;

    this.pool.on('connect', (client: PoolClient) => {
      // Set session parameters for HIPAA compliance
      client.query("SET statement_timeout = '30s'").catch(() => {});

      if (process.env.NODE_ENV === 'development') {
        console.log('[Database] New client connected to pool');
      }
    });

    this.pool.on('acquire', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Database] Client acquired from pool');
      }
    });

    this.pool.on('release', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Database] Client released to pool');
      }
    });

    this.pool.on('remove', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Database] Client removed from pool');
      }
    });

    this.pool.on('error', (err: Error) => {
      console.error('[Database] Unexpected pool error:', err.message);

      // Log for HIPAA audit trail
      this.logAuditEvent('DATABASE_ERROR', {
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Log audit events for HIPAA compliance
   */
  private logAuditEvent(eventType: string, details: Record<string, unknown>): void {
    // TODO: Implement proper audit logging service
    const auditLog = {
      eventType,
      timestamp: new Date().toISOString(),
      service: 'database',
      ...details,
    };

    if (process.env.AUDIT_LOG_ENABLED === 'true') {
      console.log('[AUDIT]', JSON.stringify(auditLog));
    }
  }

  /**
   * Execute a query with automatic connection handling
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
    options?: QueryOptions
  ): Promise<QueryResult<T>> {
    await this.connect();

    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const start = Date.now();

    try {
      const result = await this.pool.query<T>({
        text,
        values: params,
        ...options,
      });

      const duration = Date.now() - start;

      // Log slow queries for performance monitoring
      if (duration > 1000) {
        console.warn(`[Database] Slow query (${duration}ms):`, text.substring(0, 100));
      }

      return result;
    } catch (error) {
      const err = error as Error;
      console.error('[Database] Query error:', err.message);
      console.error('[Database] Query:', text.substring(0, 200));
      throw error;
    }
  }

  /**
   * Get a client from the pool for transaction support
   */
  async getClient(): Promise<PoolClient> {
    await this.connect();

    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();

    // Wrap release to add logging
    const originalRelease = client.release.bind(client);
    let released = false;

    client.release = () => {
      if (released) {
        console.warn('[Database] Client already released');
        return;
      }
      released = true;
      return originalRelease();
    };

    return client;
  }

  /**
   * Execute a function within a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get pool statistics for monitoring
   */
  getPoolStats(): {
    total: number;
    idle: number;
    waiting: number;
  } | null {
    if (!this.pool) {
      return null;
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Health check for the database connection
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latencyMs: number;
    poolStats: ReturnType<typeof this.getPoolStats>;
    error?: string;
  }> {
    const start = Date.now();

    try {
      await this.query('SELECT 1');

      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
        poolStats: this.getPoolStats(),
      };
    } catch (error) {
      const err = error as Error;
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        poolStats: this.getPoolStats(),
        error: err.message,
      };
    }
  }

  /**
   * Gracefully close all connections
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      console.log('[Database] Closing connection pool...');
      await this.pool.end();
      this.pool = null;
      console.log('[Database] Connection pool closed');
    }
  }

  /**
   * Check if the pool is connected
   */
  isConnected(): boolean {
    return this.pool !== null;
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

const database = new Database();

// ===========================================
// EXPORTS
// ===========================================

export { database, Database };
export default database;
