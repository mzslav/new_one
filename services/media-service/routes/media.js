const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { verifyToken } = require('../middleware/auth');
const { getDb } = require('../db/dynamo');
const { putObject, getObjectStream } = require('../storage');
const { generateMockOutput } = require('../lib/generateMockOutput');

const router = express.Router();
const INTERNAL_SECRET = process.env.INTERNAL_WEBHOOK_SECRET;
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 512;
const MAX_FILE_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const TABLE_NAME = process.env.FILES_TABLE || 'fluxon-files';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

router.post('/upload', verifyToken, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File too large. Maximum upload size is ${MAX_UPLOAD_MB} MB` });
      }
      return res.status(400).json({ error: err.message || 'Invalid upload' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File field "file" is required' });

  const { userId } = req.user;
  const ext = req.file.originalname.includes('.') ? req.file.originalname.split('.').pop() : 'bin';
  const fileId = crypto.randomUUID();
  const objectKey = `${userId}/${fileId}.${ext}`;

  try {
    await putObject(objectKey, req.file.buffer, req.file.size, req.file.mimetype);

    const doc = {
      userId: String(userId),
      id: fileId,
      originalName: req.file.originalname,
      objectKey,
      size: req.file.size,
      mimetype: req.file.mimetype,
      createdAt: new Date().toISOString(),
    };

    await getDb().send(new PutCommand({ TableName: TABLE_NAME, Item: doc }));

    return res.status(201).json({
      fileId,
      originalName: doc.originalName,
      size: doc.size,
      mimetype: doc.mimetype,
    });
  } catch (err) {
    console.error('upload error', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

router.post('/internal/processed', async (req, res) => {
  const provided = req.headers['x-internal-secret'];
  if (!provided || provided !== INTERNAL_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId, jobId, userId, actionType } = req.body || {};
  if (!fileId || !jobId || !userId || !actionType) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const { Item: source } = await getDb().send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { userId: String(userId), id: String(fileId) },
    }));

    if (!source) return res.status(404).json({ error: 'Source file not found' });

    const { buffer, processedName, mimetype, size } = generateMockOutput({
      actionType, sourceName: source.originalName, jobId: String(jobId), userId: String(userId),
    });

    const objectKey = `processed/${userId}/${jobId}/${processedName}`;
    await putObject(objectKey, buffer, size, mimetype);

    const newFileId = crypto.randomUUID();
    const doc = {
      userId: String(userId),
      id: newFileId,
      originalName: processedName,
      objectKey,
      size,
      mimetype,
      sourceFileId: fileId,
      jobId: String(jobId),
      actionType: String(actionType),
      isProcessed: true,
      createdAt: new Date().toISOString(),
    };

    await getDb().send(new PutCommand({ TableName: TABLE_NAME, Item: doc }));

    return res.status(201).json({ fileId: newFileId, originalName: processedName, mimetype, size });
  } catch (err) {
    console.error('create processed file error', err);
    return res.status(500).json({ error: 'Failed to create processed file' });
  }
});

router.get('/:id/meta', verifyToken, async (req, res) => {
  const { Item: file } = await getDb().send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { userId: String(req.user.userId), id: String(req.params.id) },
  }));

  if (!file) return res.status(404).json({ error: 'File not found' });

  return res.json({
    fileId: file.id,
    originalName: file.originalName,
    mimetype: file.mimetype,
    size: file.size,
    isProcessed: Boolean(file.isProcessed),
    actionType: file.actionType || null,
  });
});

router.get('/:id', verifyToken, async (req, res) => {
  const { Item: file } = await getDb().send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { userId: String(req.user.userId), id: String(req.params.id) },
  }));

  if (!file) return res.status(404).json({ error: 'File not found' });

  try {
    const stream = await getObjectStream(file.objectKey);
    const isText = String(file.mimetype || '').startsWith('text/');
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Length', String(file.size));
    res.setHeader('Content-Disposition', `${isText ? 'attachment' : 'inline'}; filename="${encodeURIComponent(file.originalName)}"`);
    stream.pipe(res);
  } catch (err) {
    console.error('get file error', err);
    return res.status(500).json({ error: 'Failed to fetch file' });
  }
});

module.exports = router;
