const { Client } = require('minio');

const BUCKET = process.env.MINIO_BUCKET || 'media';

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: String(process.env.MINIO_USE_SSL).toLowerCase() === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  region: process.env.AWS_REGION || 'eu-north-1',
});

async function ensureBucket() {
  try {
    await minioClient.bucketExists(BUCKET);
  } catch (err) {
    try {
      await minioClient.makeBucket(BUCKET, process.env.AWS_REGION || 'eu-north-1');
      console.log(`media-service: created bucket "${BUCKET}"`);
    } catch (createErr) {
      if (createErr.message.includes('already own it') || createErr.code === 'BucketAlreadyOwnedByYou') {
        console.log(`media-service: bucket "${BUCKET}" already exists and is owned by you.`);
        return;
      }
      throw createErr;
    }
  }
}

module.exports = { minioClient, ensureBucket, BUCKET };