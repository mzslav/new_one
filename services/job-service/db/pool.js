const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initSchema() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
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
}

module.exports = { pool, initSchema };
