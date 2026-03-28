// backend/authorizer/index.js - VERSIÓN DE PRUEBA (SIN VALIDACIÓN DE DYNAMODB)
const { CognitoJwtVerifier } = require("aws-jwt-verify");

// Verificador de JWT de Cognito
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID,
  tokenUse: "id", // Cambiamos a "id" para usar IdToken
  clientId: process.env.CLIENT_ID,
});

exports.handler = async (event) => {
  console.log("Authorizer event:", JSON.stringify(event, null, 2));

  try {
    // 1. Obtener el token del header Authorization
    const token = event.authorizationToken?.replace("Bearer ", "");
    if (!token) {
      console.log("No token provided");
      return generatePolicy(null, "Deny", event.methodArn);
    }

    // 2. Validar el token con Cognito (SOLO ESTO)
    const payload = await verifier.verify(token);
    const email = payload.email;

    console.log("Token válido para:", email);
    
    // 3. ✅ SIEMPRE PERMITIR (sin verificar DynamoDB)
    return generatePolicy(email, "Allow", event.methodArn);

  } catch (error) {
    console.error("Error en authorizer:", error.message);
    return generatePolicy(null, "Deny", event.methodArn);
  }
};

function generatePolicy(principalId, effect, resource) {
  const authResponse = {
    principalId: principalId || "unauthorized"
  };

  if (effect && resource) {
    authResponse.policyDocument = {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource
        }
      ]
    };
  }

  return authResponse;
}