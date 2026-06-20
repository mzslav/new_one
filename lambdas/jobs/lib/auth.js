const { CognitoJwtVerifier } = require('aws-jwt-verify');

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: process.env.COGNITO_CLIENT_ID,
});

function publicError(statusCode, publicMessage) {
  const err = new Error(publicMessage);
  err.statusCode = statusCode;
  err.publicMessage = publicMessage;
  return err;
}

function getHeader(headers = {}, name) {
  const found = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return found ? headers[found] : '';
}

async function verifyRequestUser(event) {
  const header = getHeader(event.headers, 'authorization');
  const [scheme, token] = String(header || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw publicError(401, 'Missing or invalid Authorization header');
  }

  try {
    const payload = await verifier.verify(token);
    return { userId: payload.sub, email: payload.email };
  } catch (err) {
    if (err.statusCode) throw err;
    throw publicError(401, 'Invalid or expired token');
  }
}

module.exports = { verifyRequestUser };
