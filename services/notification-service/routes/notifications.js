const express = require('express');
const { ObjectId } = require('mongodb');
const { verifyToken } = require('../middleware/auth');
const { getDb } = require('../db/mongo');

const router = express.Router();

router.post('/internal', async (req, res) => {
  const provided = req.headers['x-internal-secret'];
  if (!provided || provided !== process.env.INTERNAL_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { userId, jobId, message, status } = req.body || {};
  if (!userId || !jobId || !message) {
    return res.status(400).json({ error: 'userId, jobId and message are required' });
  }

  try {
    const doc = {
      userId: String(userId),
      jobId: String(jobId),
      message: String(message),
      status: status ? String(status) : 'info',
      read: false,
      createdAt: new Date(),
    };
    const result = await getDb().collection('notifications').insertOne(doc);
    return res.status(201).json({ id: result.insertedId.toString() });
  } catch (err) {
    console.error('save notification error', err);
    return res.status(500).json({ error: 'Failed to save notification' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const items = await getDb()
      .collection('notifications')
      .find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return res.json(
      items.map((n) => ({
        id: n._id.toString(),
        jobId: n.jobId,
        message: n.message,
        status: n.status,
        read: Boolean(n.read),
        createdAt: n.createdAt,
      }))
    );
  } catch (err) {
    console.error('list notifications error', err);
    return res.status(500).json({ error: 'Failed to load notifications' });
  }
});

router.patch('/read-all', verifyToken, async (req, res) => {
  try {
    const result = await getDb()
      .collection('notifications')
      .updateMany(
        { userId: req.user.userId, read: { $ne: true } },
        { $set: { read: true, readAt: new Date() } }
      );
    return res.json({ updated: result.modifiedCount });
  } catch (err) {
    console.error('mark all read error', err);
    return res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

router.patch('/:id/read', verifyToken, async (req, res) => {
  let _id;
  try {
    _id = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: 'Invalid notification id' });
  }

  try {
    const result = await getDb()
      .collection('notifications')
      .updateOne(
        { _id, userId: req.user.userId },
        { $set: { read: true, readAt: new Date() } }
      );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('mark read error', err);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

module.exports = router;
