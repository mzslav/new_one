const express = require('express');
const crypto = require('crypto');
const { PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { verifyToken } = require('../middleware/auth');
const { getDb } = require('../db/dynamo');

const router = express.Router();
const TABLE_NAME = process.env.NOTIFICATIONS_TABLE || 'fluxon-notifications';

const snsClient = new SNSClient({ region: process.env.AWS_REGION });

router.post('/internal', async (req, res) => {
  const provided = req.headers['x-internal-secret'];
  if (!provided || provided !== process.env.INTERNAL_WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const { userId, jobId, message, status } = req.body || {};
  if (!userId || !jobId || !message) return res.status(400).json({ error: 'Required fields missing' });

  try {
    const doc = {
      userId: String(userId),
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID(),
      jobId: String(jobId),
      message: String(message),
      status: status ? String(status) : 'info',
      read: false,
    };
    
    await getDb().send(new PutCommand({ TableName: TABLE_NAME, Item: doc }));

    if (process.env.SNS_TOPIC_ARN) {
      await snsClient.send(new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Message: JSON.stringify({ userId, jobId, message, status }),
        Subject: 'New Notification from Fluxon',
      }));
    }

    return res.status(201).json({ id: doc.id });
  } catch (err) {
    console.error('save notification error', err);
    return res.status(500).json({ error: 'Failed to save notification' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const { Items } = await getDb().send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': String(req.user.userId) },
      ScanIndexForward: false,
      Limit: 50
    }));

    return res.json(Items.map((n) => ({
      id: n.id,
      jobId: n.jobId,
      message: n.message,
      status: n.status,
      read: Boolean(n.read),
      createdAt: n.createdAt,
    })));
  } catch (err) {
    console.error('list notifications error', err);
    return res.status(500).json({ error: 'Failed to load notifications' });
  }
});

router.patch('/read-all', verifyToken, async (req, res) => {
  try {
    const { Items } = await getDb().send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': String(req.user.userId) }
    }));

    const unread = Items.filter(i => !i.read);
    
    for (const item of unread) {
      await getDb().send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { userId: item.userId, createdAt: item.createdAt },
        UpdateExpression: 'set #r = :true, readAt = :now',
        ExpressionAttributeNames: { '#r': 'read' },
        ExpressionAttributeValues: { ':true': true, ':now': new Date().toISOString() }
      }));
    }
    
    return res.json({ updated: unread.length });
  } catch (err) {
    console.error('mark all read error', err);
    return res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    const { Items } = await getDb().send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': String(req.user.userId) }
    }));

    const target = Items.find(i => i.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'Notification not found' });

    await getDb().send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { userId: target.userId, createdAt: target.createdAt },
      UpdateExpression: 'set #r = :true, readAt = :now',
      ExpressionAttributeNames: { '#r': 'read' },
      ExpressionAttributeValues: { ':true': true, ':now': new Date().toISOString() }
    }));

    return res.json({ ok: true });
  } catch (err) {
    console.error('mark read error', err);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

module.exports = router;