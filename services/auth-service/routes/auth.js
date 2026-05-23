const express = require('express');
const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  AdminConfirmSignUpCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const router = express.Router();
const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

async function confirmUser(email) {
  await client.send(
    new AdminConfirmSignUpCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    })
  );
}

function toUserResponse(authResult) {
  const idToken = authResult.IdToken;
  const part = idToken.split('.')[1];
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const payload = JSON.parse(Buffer.from(padded, 'base64').toString());
  return {
    token: idToken,
    user: {
      userId: payload.sub,
      email: payload.email || payload['cognito:username'] || '',
    },
  };
}

async function loginWithEmail(email, password) {
  const result = await client.send(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    })
  );
  if (!result.AuthenticationResult?.IdToken) {
    throw new Error('Login failed');
  }
  return toUserResponse(result.AuthenticationResult);
}

router.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    await client.send(
      new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }],
      })
    );
    await confirmUser(email);
    const data = await loginWithEmail(email, password);
    return res.status(201).json(data);
  } catch (err) {
    if (err.name === 'UsernameExistsException') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    if (err.name === 'NotAuthorizedException' && err.message?.includes('confirmed')) {
      return res.status(400).json({
        error: 'Account created but email is not confirmed yet. Check your inbox or disable confirmation in Cognito for dev.',
      });
    }
    console.error('register error', err);
    return res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const data = await loginWithEmail(email, password);
    return res.json(data);
  } catch (err) {
    if (err.name === 'NotAuthorizedException' && /not confirmed/i.test(err.message || '')) {
      try {
        await confirmUser(email);
        const data = await loginWithEmail(email, password);
        return res.json(data);
      } catch (confirmErr) {
        console.error('login confirm error', confirmErr.message);
      }
    }
    console.error('login error', err.message);
    return res.status(401).json({ error: 'Invalid email or password' });
  }
});

module.exports = router;
