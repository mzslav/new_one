const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

let docClient;

function connectDynamo() {
  if (docClient) return docClient;

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "eu-north-1",
  });

  docClient = DynamoDBDocumentClient.from(client);
  
  console.log("DynamoDB client initialized");
  return docClient;
}

function getDb() {
  if (!docClient) {
    return connectDynamo(); 
  }
  return docClient;
}

module.exports = { connectDynamo, getDb };