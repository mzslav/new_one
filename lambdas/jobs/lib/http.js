const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Content-Type': 'application/json',
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: body === null ? '' : JSON.stringify(body),
    isBase64Encoded: false,
  };
}

function parseJsonBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  return JSON.parse(raw);
}

function parsePathId(path) {
  const parts = String(path).split('/').filter(Boolean);
  return parts.length >= 3 ? parts[2] : '';
}

module.exports = { jsonResponse, parseJsonBody, parsePathId };
