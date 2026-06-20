const { TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { getDb } = require('../db/dynamo');

const TABLE_NAME = process.env.NOTIFICATIONS_TABLE || 'fluxon-notifications';
const MARKER_USER_PREFIX = '__event__#';

function assertString(value, field) {
  if (!value || typeof value !== 'string') {
    throw new Error(`${field} is required`);
  }
  return value;
}

function normalizeEvent(input = {}) {
  const eventId = assertString(input.eventId, 'eventId');
  const userId = assertString(input.userId, 'userId');
  const jobId = assertString(input.jobId, 'jobId');
  const message = assertString(input.message, 'message');
  const status = input.status ? String(input.status) : 'info';
  const occurredAt = input.createdAt ? String(input.createdAt) : new Date().toISOString();

  return {
    eventId,
    userId: String(userId),
    jobId: String(jobId),
    message: String(message),
    status,
    occurredAt,
  };
}

function isDuplicateEventError(err) {
  return err?.name === 'TransactionCanceledException';
}

async function saveNotificationEvent(input) {
  const event = normalizeEvent(input);
  const notification = {
    userId: event.userId,
    createdAt: `${event.occurredAt}#${event.eventId}`,
    occurredAt: event.occurredAt,
    id: event.eventId,
    eventId: event.eventId,
    jobId: event.jobId,
    message: event.message,
    status: event.status,
    read: false,
  };
  const marker = {
    userId: `${MARKER_USER_PREFIX}${event.eventId}`,
    createdAt: 'marker',
    eventId: event.eventId,
    notificationUserId: event.userId,
    processedAt: new Date().toISOString(),
  };

  try {
    await getDb().send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE_NAME,
              Item: marker,
              ConditionExpression: 'attribute_not_exists(userId)',
            },
          },
          {
            Put: {
              TableName: TABLE_NAME,
              Item: notification,
              ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(createdAt)',
            },
          },
        ],
      })
    );

    return { duplicate: false, id: notification.id };
  } catch (err) {
    if (isDuplicateEventError(err)) {
      return { duplicate: true, id: notification.id };
    }
    throw err;
  }
}

module.exports = { saveNotificationEvent };
