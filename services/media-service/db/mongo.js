const { MongoClient } = require('mongodb');

let client;
let db;

async function connectMongo() {
  if (db) return db;
  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db('media_metadata_db');
  await db.collection('files').createIndex({ userId: 1, createdAt: -1 });
  return db;
}

function getDb() {
  if (!db) throw new Error('Mongo not initialized');
  return db;
}

module.exports = { connectMongo, getDb };
