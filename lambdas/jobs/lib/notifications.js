const { SendMessageCommand, SQSClient } = require('@aws-sdk/client-sqs');

const queueUrl = process.env.NOTIFICATIONS_QUEUE_URL;
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'eu-north-1' });

async function publishJobCompleted({ userId, job, outputFileName }) {
  if (!queueUrl) {
    throw new Error('NOTIFICATIONS_QUEUE_URL is not configured');
  }

  const event = {
    eventId: `job:${job.id}:completed`,
    type: 'JOB_COMPLETED',
    userId: String(userId),
    jobId: String(job.id),
    message: `${job.action_type} finished - download ${outputFileName}`,
    status: 'Completed',
    createdAt: new Date().toISOString(),
  };

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(event),
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: event.type,
        },
      },
    })
  );
}

module.exports = { publishJobCompleted };
