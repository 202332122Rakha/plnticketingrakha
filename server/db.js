import pg from 'pg';
import dotenv from 'dotenv';
import { buildDbConfig, databaseErrorMessage } from './config.js';
import { prepareQuery } from './sql.js';

dotenv.config({ quiet: true });
export const dbConfig = buildDbConfig();
export const pool = new pg.Pool(dbConfig);
pool.on('error', (error) => console.error('PostgreSQL pool:', databaseErrorMessage(error), error.code || 'UNKNOWN'));

export function query(text, params = []) {
  const statement = prepareQuery(text, params);
  return pool.query(statement.text, statement.values);
}

/** All statements on this connection remain on the same PostgreSQL session. */
export async function connect() {
  const client = await pool.connect();
  return {
    query(text, params = []) {
      const statement = prepareQuery(text, params);
      return client.query(statement.text, statement.values);
    },
    release: () => client.release(),
  };
}

export async function transaction(work) {
  const client = await connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

export async function testDatabaseConnection() {
  try {
    const result = await query('SELECT NOW() AS now, current_database() AS name, version() AS version');
    return { ok: true, ...result.rows[0] };
  } catch (error) {
    return { ok: false, message: databaseErrorMessage(error), code: error.code || 'CONNECTION_FAILED' };
  }
}
