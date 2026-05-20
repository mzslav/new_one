const express = require('express');
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../db/pool');

const router = express.Router();

const VALID_ACTIONS = new Set(['TRANSCRIBE', 'TTS', 'SUMMARIZE', 'ENHANCE', 'TRANSLATE']);
const JOB_DELAY_MS = Number(process.env.JOB_DELAY_MS) || 10000;
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL;
const MEDIA_URL = process.env.MEDIA_SERVICE_URL;
const INTERNAL_SECRET = process.env.INTERNAL_WEBHOOK_SECRET;

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

async function completeJob(jobId, userId) {
  try {
    const pending = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND status = $2',
      [jobId, 'Pending']
    );
    if (pending.rows.length === 0) return;
    const job = pending.rows[0];

    let outputFileId = null;
    let outputFileName = null;

    const { data } = await axios.post(
      `${MEDIA_URL}/api/media/internal/processed`,
      {
        fileId: job.file_id,
        jobId: job.id,
        userId,
        actionType: job.action_type,
      },
      { headers: { 'X-Internal-Secret': INTERNAL_SECRET }, timeout: 30000 }
    );

    outputFileId = data.fileId;
    outputFileName = data.originalName;

    await pool.query(
      `UPDATE jobs
       SET status = 'Completed', output_file_id = $1, output_file_name = $2, updated_at = NOW()
       WHERE id = $3`,
      [outputFileId, outputFileName, jobId]
    );

    await axios.post(
      `${NOTIFICATION_URL}/api/notifications/internal`,
      {
        userId,
        jobId: job.id,
        message: `${job.action_type} finished — download ${outputFileName}`,
        status: 'Completed',
      },
      { headers: { 'X-Internal-Secret': INTERNAL_SECRET }, timeout: 5000 }
    );
  } catch (err) {
    console.error('completeJob error', err.message);
    await pool.query(
      `UPDATE jobs SET status = 'Failed', updated_at = NOW() WHERE id = $1 AND status = 'Pending'`,
      [jobId]
    ).catch(() => {});
  }
}

router.post('/', verifyToken, async (req, res) => {
  const { fileId, actionType } = req.body || {};
  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json({ error: 'fileId is required' });
  }
  if (!actionType || !VALID_ACTIONS.has(actionType)) {
    return res.status(400).json({
      error: `actionType must be one of ${[...VALID_ACTIONS].join(', ')}`,
    });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO jobs (user_id, file_id, action_type, status)
       VALUES ($1, $2, $3, 'Pending')
       RETURNING *`,
      [req.user.userId, fileId, actionType]
    );
    const job = serializeJob(rows[0]);
    setTimeout(() => completeJob(job.id, req.user.userId), JOB_DELAY_MS);
    return res.status(201).json(job);
  } catch (err) {
    console.error('create job error', err);
    return res.status(500).json({ error: 'Failed to create job' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.user.userId]
    );
    return res.json(rows.map(serializeJob));
  } catch (err) {
    console.error('list jobs error', err);
    return res.status(500).json({ error: 'Failed to list jobs' });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    return res.json(serializeJob(rows[0]));
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Job not found' });
    console.error('get job error', err);
    return res.status(500).json({ error: 'Failed to fetch job' });
  }
});

module.exports = router;
