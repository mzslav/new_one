const { SendMessageCommand, SQSClient } = require('@aws-sdk/client-sqs');
const { verifyRequestUser } = require('./lib/auth');
const { initSchema, pool, serializeJob } = require('./lib/db');
const { jsonResponse, parseJsonBody, parsePathId } = require('./lib/http');
const { createProcessedFile } = require('./lib/media');
const { publishJobCompleted } = require('./lib/notifications');

const VALID_ACTIONS = new Set(['TRANSCRIBE', 'TTS', 'SUMMARIZE', 'ENHANCE', 'TRANSLATE']);
const JOBS_QUEUE_URL = process.env.JOBS_QUEUE_URL;
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'eu-north-1' });

async function enqueueJob(job) {
  if (!JOBS_QUEUE_URL) {
    throw new Error('JOBS_QUEUE_URL is not configured');
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: JOBS_QUEUE_URL,
      MessageBody: JSON.stringify({ jobId: job.id, userId: job.userId }),
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: 'JOB_CREATED',
        },
      },
    })
  );
}

async function createJob(event, context) {
  context.callbackWaitsForEmptyEventLoop = false;
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, null);

  try {
    const user = await verifyRequestUser(event);
    const { fileId, actionType } = parseJsonBody(event);

    if (!fileId || typeof fileId !== 'string') {
      return jsonResponse(400, { error: 'fileId is required' });
    }
    if (!actionType || !VALID_ACTIONS.has(actionType)) {
      return jsonResponse(400, { error: `actionType must be one of ${[...VALID_ACTIONS].join(', ')}` });
    }

    await initSchema();
    const { rows } = await pool.query(
      `INSERT INTO jobs (user_id, file_id, action_type, status)
       VALUES ($1, $2, $3, 'Pending')
       RETURNING *`,
      [user.userId, fileId, actionType]
    );
    const job = serializeJob(rows[0]);
    await enqueueJob(job);

    return jsonResponse(201, job);
  } catch (err) {
    console.error('createJob error', err);
    return jsonResponse(err.statusCode || 500, { error: err.publicMessage || 'Failed to create job' });
  }
}

async function listJobs(event, context) {
  context.callbackWaitsForEmptyEventLoop = false;
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, null);

  try {
    const user = await verifyRequestUser(event);
    await initSchema();
    const { rows } = await pool.query(
      'SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [user.userId]
    );

    return jsonResponse(200, rows.map(serializeJob));
  } catch (err) {
    console.error('listJobs error', err);
    return jsonResponse(err.statusCode || 500, { error: err.publicMessage || 'Failed to list jobs' });
  }
}

async function getJob(event, context) {
  context.callbackWaitsForEmptyEventLoop = false;
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, null);

  try {
    const user = await verifyRequestUser(event);
    const id = parsePathId(event.path || '');
    if (!id) return jsonResponse(404, { error: 'Job not found' });

    await initSchema();
    const { rows } = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND user_id = $2',
      [id, user.userId]
    );
    if (rows.length === 0) return jsonResponse(404, { error: 'Job not found' });

    return jsonResponse(200, serializeJob(rows[0]));
  } catch (err) {
    if (err.code === '22P02') return jsonResponse(404, { error: 'Job not found' });
    console.error('getJob error', err);
    return jsonResponse(err.statusCode || 500, { error: err.publicMessage || 'Failed to fetch job' });
  }
}

async function completeJob(jobId, userId) {
  await initSchema();
  const pending = await pool.query(
    'SELECT * FROM jobs WHERE id = $1 AND user_id = $2 AND status = $3',
    [jobId, userId, 'Pending']
  );
  if (pending.rows.length === 0) return;

  const job = pending.rows[0];

  try {
    const output = await createProcessedFile({
      fileId: job.file_id,
      jobId: job.id,
      userId,
      actionType: job.action_type,
    });

    await pool.query(
      `UPDATE jobs
       SET status = 'Completed', output_file_id = $1, output_file_name = $2, updated_at = NOW()
       WHERE id = $3`,
      [output.fileId, output.originalName, jobId]
    );

    await publishJobCompleted({
      userId,
      job,
      outputFileName: output.originalName,
    });
  } catch (err) {
    console.error('processJob complete error', err);
    await pool.query(
      `UPDATE jobs SET status = 'Failed', updated_at = NOW() WHERE id = $1 AND status = 'Pending'`,
      [jobId]
    ).catch(() => {});
    throw err;
  }
}

async function processJob(event, context) {
  context.callbackWaitsForEmptyEventLoop = false;

  for (const record of event.Records || []) {
    const body = JSON.parse(record.body || '{}');
    if (!body.jobId || !body.userId) {
      throw new Error('Job queue message requires jobId and userId');
    }
    await completeJob(String(body.jobId), String(body.userId));
  }
}

module.exports = { createJob, listJobs, getJob, processJob };
