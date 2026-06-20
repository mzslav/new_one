const crypto = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { GetCommand, PutCommand, DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { generateMockOutput } = require('./mockOutput');

const region = process.env.AWS_REGION || 'eu-north-1';
const filesTable = process.env.FILES_TABLE;
const bucket = process.env.S3_BUCKET;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const s3 = new S3Client({ region });

async function createProcessedFile({ fileId, jobId, userId, actionType }) {
  const { Item: source } = await ddb.send(
    new GetCommand({
      TableName: filesTable,
      Key: { userId: String(userId), id: String(fileId) },
    })
  );

  if (!source) {
    const err = new Error('Source file not found');
    err.statusCode = 404;
    throw err;
  }

  const { buffer, processedName, mimetype, size } = generateMockOutput({
    actionType,
    sourceName: source.originalName,
    jobId: String(jobId),
    userId: String(userId),
  });

  const objectKey = `processed/${userId}/${jobId}/${processedName}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentLength: size,
      ContentType: mimetype,
    })
  );

  const newFileId = crypto.randomUUID();
  const doc = {
    userId: String(userId),
    id: newFileId,
    originalName: processedName,
    objectKey,
    size,
    mimetype,
    sourceFileId: String(fileId),
    jobId: String(jobId),
    actionType: String(actionType),
    isProcessed: true,
    createdAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: filesTable, Item: doc }));

  return { fileId: newFileId, originalName: processedName, mimetype, size };
}

module.exports = { createProcessedFile };
