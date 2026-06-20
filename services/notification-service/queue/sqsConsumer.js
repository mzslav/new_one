const {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} = require('@aws-sdk/client-sqs');
const { saveNotificationEvent } = require('../lib/notificationEvents');

const QUEUE_URL = process.env.NOTIFICATIONS_QUEUE_URL;
const WAIT_TIME_SECONDS = Number(process.env.SQS_WAIT_TIME_SECONDS) || 20;
const VISIBILITY_TIMEOUT_SECONDS = Number(process.env.SQS_VISIBILITY_TIMEOUT_SECONDS) || 60;
const MAX_MESSAGES = Number(process.env.SQS_MAX_MESSAGES) || 5;
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'eu-north-1' });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseMessage(message) {
  try {
    return JSON.parse(message.Body || '{}');
  } catch {
    throw new Error('SQS message body is not valid JSON');
  }
}

function startNotificationConsumer() {
  if (!QUEUE_URL) {
    console.warn('notification-service: NOTIFICATIONS_QUEUE_URL is not configured; SQS consumer is disabled');
    return { stop() {} };
  }

  let running = true;

  async function deleteMessage(message) {
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      })
    );
  }

  async function handleMessage(message) {
    const event = parseMessage(message);
    const result = await saveNotificationEvent(event);
    await deleteMessage(message);

    if (result.duplicate) {
      console.log(`notification-service: skipped duplicate notification event ${event.eventId}`);
    } else {
      console.log(`notification-service: processed notification event ${event.eventId}`);
    }
  }

  async function poll() {
    console.log('notification-service: SQS consumer started');

    while (running) {
      try {
        const response = await sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: QUEUE_URL,
            MaxNumberOfMessages: MAX_MESSAGES,
            WaitTimeSeconds: WAIT_TIME_SECONDS,
            VisibilityTimeout: VISIBILITY_TIMEOUT_SECONDS,
            MessageAttributeNames: ['All'],
          })
        );

        for (const message of response.Messages || []) {
          try {
            await handleMessage(message);
          } catch (err) {
            console.error('notification-service: failed to process SQS message', err.message);
          }
        }
      } catch (err) {
        console.error('notification-service: SQS polling error', err.message);
        await sleep(5000);
      }
    }
  }

  poll().catch((err) => console.error('notification-service: SQS consumer stopped unexpectedly', err));

  return {
    stop() {
      running = false;
    },
  };
}

module.exports = { startNotificationConsumer };
