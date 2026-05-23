const { Client: MinioClient } = require('minio');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

const BUCKET = process.env.S3_BUCKET || process.env.MINIO_BUCKET || 'media';
const useS3 = Boolean(process.env.S3_BUCKET);

let s3Client;
let minioClient;

if (useS3) {
  s3Client = new S3Client({ region: process.env.AWS_REGION || 'eu-north-1' });
} else {
  minioClient = new MinioClient({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: Number(process.env.MINIO_PORT) || 9000,
    useSSL: String(process.env.MINIO_USE_SSL).toLowerCase() === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
  });
}

async function ensureBucket() {
  if (useS3) {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
      console.log(`media-service: S3 bucket "${BUCKET}" is reachable`);
    } catch (err) {
      console.warn(`media-service: S3 bucket check failed (${err.message}). Create the bucket in Terraform.`);
    }
    return;
  }

  try {
    const exists = await minioClient.bucketExists(BUCKET);
    if (!exists) {
      await minioClient.makeBucket(BUCKET, process.env.AWS_REGION || 'eu-north-1');
      console.log(`media-service: created bucket "${BUCKET}"`);
    }
  } catch (err) {
    if (err.code === 'BucketAlreadyOwnedByYou') return;
    throw err;
  }
}

async function putObject(objectKey, buffer, size, contentType) {
  if (useS3) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: objectKey,
        Body: buffer,
        ContentLength: size,
        ContentType: contentType,
      })
    );
    return;
  }
  await minioClient.putObject(BUCKET, objectKey, buffer, size, { 'Content-Type': contentType });
}

async function getObjectStream(objectKey) {
  if (useS3) {
    const out = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: objectKey }));
    return out.Body;
  }
  return minioClient.getObject(BUCKET, objectKey);
}

module.exports = { BUCKET, ensureBucket, putObject, getObjectStream, useS3 };
