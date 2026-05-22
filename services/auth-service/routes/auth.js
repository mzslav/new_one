const { CognitoIdentityProviderClient, SignUpCommand, InitiateAuthCommand } = require("@aws-sdk/client-cognito-identity-provider");

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;

router.post('/register', async (req, res) => {
    const { username, password, email } = req.body;
    const command = new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: username,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }]
    });
    await client.send(command);
    res.status(201).json({ message: "User registered in Cognito" });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: { USERNAME: username, PASSWORD: password }
    });
    const result = await client.send(command);
    res.json(result.AuthenticationResult); 
});