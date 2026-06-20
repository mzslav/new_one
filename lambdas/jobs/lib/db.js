const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || '';
const useSsl = connectionString.includes('rds.amazonaws.com');

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

let schemaReady = false;

async function initSchema() {
  if (schemaReady) return;

  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs (user_id, created_at DESC);
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS output_file_id TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS output_file_name TEXT;
  `);

  schemaReady = true;
}

function serializeJob(row) {
  return {
    id: row.id,
    userId: row.user_id,
    fileId: row.file_id,
    outputFileId: row.output_file_id || null,
    outputFileName: row.output_file_name || null,
    actionType: row.action_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { initSchema, pool, serializeJob };
