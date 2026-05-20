const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { verifyToken } = require('../middleware/auth');
const { getDb } = require('../db/mongo');
const { minioClient, BUCKET } = require('../storage/minio');
const { generateMockOutput } = require('../lib/generateMockOutput');

const router = express.Router();
const INTERNAL_SECRET = process.env.INTERNAL_WEBHOOK_SECRET;
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 512;
const MAX_FILE_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

router.post('/upload', verifyToken, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: `File too large. Maximum upload size is ${MAX_UPLOAD_MB} MB`,
        });
      }
      return res.status(400).json({ error: err.message || 'Invalid upload' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File field "file" is required' });
  }

  const { userId } = req.user;
  const ext = req.file.originalname.includes('.')
    ? req.file.originalname.split('.').pop()
    : 'bin';
  const objectKey = `${userId}/${crypto.randomUUID()}.${ext}`;

  try {
    await minioClient.putObject(
      BUCKET,
      objectKey,
      req.file.buffer,
      req.file.size,
      { 'Content-Type': req.file.mimetype }
    );

    const doc = {
      userId,
      originalName: req.file.originalname,
      objectKey,
      size: req.file.size,
      mimetype: req.file.mimetype,
      createdAt: new Date(),
    };
    const result = await getDb().collection('files').insertOne(doc);

    return res.status(201).json({
      fileId: result.insertedId.toString(),
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
  if (!provided || provided !== INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { fileId, jobId, userId, actionType } = req.body || {};
  if (!fileId || !jobId || !userId || !actionType) {
    return res.status(400).json({ error: 'fileId, jobId, userId and actionType are required' });
  }

  let sourceId;
  try {
    sourceId = new ObjectId(fileId);
  } catch {
    return res.status(400).json({ error: 'Invalid fileId' });
  }

  try {
    const source = await getDb().collection('files').findOne({ _id: sourceId, userId: String(userId) });
    if (!source) return res.status(404).json({ error: 'Source file not found' });

    const { buffer, processedName, mimetype, size } = generateMockOutput({
      actionType,
      sourceName: source.originalName,
      jobId: String(jobId),
      userId: String(userId),
    });

    const objectKey = `processed/${userId}/${jobId}/${processedName}`;

    await minioClient.putObject(BUCKET, objectKey, buffer, size, {
      'Content-Type': mimetype,
    });

    const doc = {
      userId: String(userId),
      originalName: processedName,
      objectKey,
      size,
      mimetype,
      sourceFileId: fileId,
      jobId: String(jobId),
      actionType: String(actionType),
      isProcessed: true,
      createdAt: new Date(),
    };
    const result = await getDb().collection('files').insertOne(doc);

    return res.status(201).json({
      fileId: result.insertedId.toString(),
      originalName: processedName,
      mimetype,
      size,
    });
  } catch (err) {
    console.error('create processed file error', err);
    return res.status(500).json({ error: 'Failed to create processed file' });
  }
});

router.get('/:id/meta', verifyToken, async (req, res) => {
  let _id;
  try {
    _id = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: 'Invalid file id' });
  }

  const file = await getDb().collection('files').findOne({ _id, userId: req.user.userId });
  if (!file) return res.status(404).json({ error: 'File not found' });

  return res.json({
    fileId: file._id.toString(),
    originalName: file.originalName,
    mimetype: file.mimetype,
    size: file.size,
    isProcessed: Boolean(file.isProcessed),
    actionType: file.actionType || null,
  });
});

router.get('/:id', verifyToken, async (req, res) => {
  let _id;
  try {
    _id = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: 'Invalid file id' });
  }

  const file = await getDb().collection('files').findOne({ _id, userId: req.user.userId });
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const stream = await minioClient.getObject(BUCKET, file.objectKey);
    const isText = String(file.mimetype || '').startsWith('text/');
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Length', String(file.size));
    res.setHeader(
      'Content-Disposition',
      `${isText ? 'attachment' : 'inline'}; filename="${encodeURIComponent(file.originalName)}"`
    );
    stream.on('error', (err) => {
      console.error('stream error', err);
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (err) {
    console.error('get file error', err);
    return res.status(500).json({ error: 'Failed to fetch file' });
  }
});

module.exports = router;
