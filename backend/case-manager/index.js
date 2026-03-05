// Versión corregida - 2026-03-03
// backend/case-manager/index.js - VERSIÓN COMPLETA
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  GetCommand, 
  UpdateCommand 
} = require("@aws-sdk/lib-dynamodb");

// Crear cliente de DynamoDB
const client = new DynamoDBClient({ region: "us-east-1" });
const dynamo = DynamoDBDocumentClient.from(client);

// Nombre de la tabla (desde variable de entorno)
const tableName = process.env.DYNAMODB_TABLE || "heralft-leads-mvp";

// Headers CORS - Permitir acceso desde tu CloudFront
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://d1wui6q7x48uzo.cloudfront.net',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

// Handler principal
exports.handler = async (event) => {
  console.log('📨 Evento recibido:', JSON.stringify(event, null, 2));
  
  // 1. Manejar OPTIONS (preflight CORS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    const path = event.resource;
    const method = event.httpMethod;
    
    console.log(`📍 Ruta: ${path}, Método: ${method}`);
    
    // ============================================
    // RUTAS DISPONIBLES
    // ============================================
    
    // GET /cases - Listar todos los casos (con filtros)
    if (path === '/cases' && method === 'GET') {
      return await listCases(event);
    }
    
    // GET /cases/{id} - Obtener un caso específico
    if (path === '/cases/{id}' && method === 'GET') {
      return await getCase(event);
    }
    
    // PUT /cases/{id}/assign - Asignar caso a abogado
    if (path === '/cases/{id}/assign' && method === 'PUT') {
      return await assignCase(event);
    }
    
    // PUT /cases/{id}/status - Actualizar estado
    if (path === '/cases/{id}/status' && method === 'PUT') {
      return await updateStatus(event);
    }
    
    // Si no coincide ninguna ruta
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Ruta no encontrada' })
    };
    
  } catch (error) {
    console.error('❌ Error general:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Error interno del servidor',
        details: error.message 
      })
    };
  }
};

// ============================================
// FUNCIÓN: listCases - Obtiene todos los casos (con filtros)
// ============================================
async function listCases(event) {
  console.log('📋 Ejecutando listCases...');
  
  try {
    const queryParams = event.queryStringParameters || {};
    const { servicio, status } = queryParams;
    
    console.log('Parámetros de filtro:', { servicio, status });
    
    // Configurar SCAN base
    let scanParams = {
      TableName: tableName,
      Limit: 100
    };
    
    // Si hay filtros, construimos la expresión
    let filterExpressions = [];
    let expressionValues = {};
    let expressionNames = {};
    
    if (servicio) {
      filterExpressions.push('servicio = :servicio');
      expressionValues[':servicio'] = servicio;
    }
    
    if (status) {
      // IMPORTANTE: Usamos alias '#st' para 'status'
      filterExpressions.push('#st = :status');
      expressionNames['#st'] = 'status';
      expressionValues[':status'] = status;
    }
    
    // Si tenemos filtros, los agregamos al scanParams
    if (filterExpressions.length > 0) {
      scanParams.FilterExpression = filterExpressions.join(' AND ');
      scanParams.ExpressionAttributeValues = expressionValues;
      
      if (Object.keys(expressionNames).length > 0) {
        scanParams.ExpressionAttributeNames = expressionNames;
      }
    }
    
    console.log('🔍 Parámetros de scan:', JSON.stringify(scanParams, null, 2));
    
    const command = new ScanCommand(scanParams);
    const result = await dynamo.send(command);
    
    console.log(`✅ Se encontraron ${result.Items?.length || 0} casos`);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        total: result.Count || 0,
        items: result.Items || []
      })
    };
    
  } catch (error) {
    console.error('❌ Error en listCases:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Error al obtener los casos',
        details: error.message 
      })
    };
  }
}

// ============================================
// FUNCIÓN 2: getCase - Obtiene un caso específico por ID
// ============================================
async function getCase(event) {
  console.log('🔍 Ejecutando getCase...');
  
  try {
    // Obtener el ID desde la ruta
    const caseId = event.pathParameters?.id;
    
    if (!caseId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'ID de caso no proporcionado' })
      };
    }
    
    console.log(`Buscando caso con ID: ${caseId}`);
    
    const command = new GetCommand({
      TableName: tableName,
      Key: { id: caseId }
    });
    
    const result = await dynamo.send(command);
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Caso no encontrado' })
      };
    }
    
    console.log('✅ Caso encontrado:', result.Item);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result.Item)
    };
    
  } catch (error) {
    console.error('❌ Error en getCase:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Error al obtener el caso',
        details: error.message 
      })
    };
  }
}

// ============================================
// FUNCIÓN 3: assignCase - Asigna un caso a un abogado
// ============================================
async function assignCase(event) {
  console.log('👨‍⚖️ Ejecutando assignCase...');
  
  try {
    const caseId = event.pathParameters?.id;
    
    if (!caseId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'ID de caso no proporcionado' })
      };
    }
    
    // Parsear el body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Body inválido' })
      };
    }
    
    const { abogadoId, abogadoNombre } = body;
    
    if (!abogadoId || !abogadoNombre) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Se requiere abogadoId y abogadoNombre' 
        })
      };
    }
    
    console.log(`Asignando caso ${caseId} a abogado: ${abogadoNombre} (${abogadoId})`);
    
    const command = new UpdateCommand({
      TableName: tableName,
      Key: { id: caseId },
      UpdateExpression: 'SET abogadoId = :abogadoId, abogadoNombre = :abogadoNombre, fechaAsignacion = :fecha, #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':abogadoId': abogadoId,
        ':abogadoNombre': abogadoNombre,
        ':fecha': new Date().toISOString(),
        ':status': 'asignado'
      },
      ReturnValues: 'ALL_NEW'
    });
    
    const result = await dynamo.send(command);
    
    console.log('✅ Caso asignado correctamente');
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Caso asignado correctamente',
        caso: result.Attributes
      })
    };
    
  } catch (error) {
    console.error('❌ Error en assignCase:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Error al asignar el caso',
        details: error.message 
      })
    };
  }
}

// ============================================
// FUNCIÓN 4: updateStatus - Actualiza el estado de un caso
// ============================================
async function updateStatus(event) {
  console.log('🔄 Ejecutando updateStatus...');
  
  try {
    const caseId = event.pathParameters?.id;
    
    if (!caseId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'ID de caso no proporcionado' })
      };
    }
    
    // Parsear el body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Body inválido' })
      };
    }
    
    const { status, notas } = body;
    
    if (!status) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Se requiere status' })
      };
    }
    
    // Validar que el status sea uno de los permitidos
    const statusPermitidos = ['nuevo', 'asignado', 'proceso', 'cerrado'];
    if (!statusPermitidos.includes(status)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Status inválido. Debe ser: nuevo, asignado, proceso, cerrado' 
        })
      };
    }
    
    console.log(`Actualizando caso ${caseId} a status: ${status}`);
    
    // Construir la expresión de actualización
    let updateExpression = 'SET #status = :status, fechaActualizacion = :fecha';
    let expressionValues = {
      ':status': status,
      ':fecha': new Date().toISOString()
    };
    
    // Si hay notas, agregarlas
    if (notas) {
      updateExpression += ', notas = :notas';
      expressionValues[':notas'] = notas;
    }
    
    const command = new UpdateCommand({
      TableName: tableName,
      Key: { id: caseId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: expressionValues,
      ReturnValues: 'ALL_NEW'
    });
    
    const result = await dynamo.send(command);
    
    console.log('✅ Status actualizado correctamente');
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Estado actualizado correctamente',
        caso: result.Attributes
      })
    };
    
  } catch (error) {
    console.error('❌ Error en updateStatus:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Error al actualizar el estado',
        details: error.message 
      })
    };
  }
}