const { Client } = require('minio');

const BUCKET = process.env.MINIO_BUCKET || 'media';

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: String(process.env.MINIO_USE_SSL).toLowerCase() === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

async function ensureBucket() {
  const exists = await minioClient.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
    console.log(`media-service: created MinIO bucket "${BUCKET}"`);
  }
}

module.exports = { minioClient, ensureBucket, BUCKET };
