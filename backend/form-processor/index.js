// AWS SDK v3 - Más moderno y eficiente
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });

exports.handler = async (event) => {
    console.log('Event received:', JSON.stringify(event, null, 2));
    
    // 🔥 ORÍGENES PERMITIDOS - Actualizado para el nuevo proyecto
    const allowedOrigins = [
        'https://d1wui6q7x48uzo.cloudfront.net',  // NUEVO CloudFront (MVP)
        'https://d2kzko6trinlft.cloudfront.net',  // Proyecto anterior (opcional)
        'http://localhost:3000',
        'https://www.heralf-legal.com',
        'https://heralf-legal.com',    // ← NUEVO
        'https://admin.heralf-legal.com'                    // Desarrollo local
    ];
    
    // Determinar el origen de la solicitud
const requestOrigin = event.headers?.origin || event.headers?.Origin || '';
const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : 'https://heralf-legal.com';

// 🔥 HEADERS CORS DINÁMICOS - ACTUALIZADO 2026-03-15
const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
};
    
    // 🔥 DETECCIÓN de OPTIONS (preflight CORS)
    const isOptionsRequest = 
        event.httpMethod === 'OPTIONS' || 
        event.requestContext?.http?.method === 'OPTIONS' ||
        (event.requestContext && event.requestContext.httpMethod === 'OPTIONS');
    
    if (isOptionsRequest) {
        console.log('Handling OPTIONS preflight request for origin:', corsOrigin);
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }
    
    try {
        // Parsear body
        let body;
        try {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
        } catch (parseError) {
            console.error('Parse error:', parseError);
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    error: 'Formato de datos inválido',
                    details: 'El cuerpo de la solicitud debe ser JSON válido'
                })
            };
        }
        
        const { nombre, email, telefono, servicio, descripcion } = body;
        
        // Validar campos
        const missingFields = [];
        if (!nombre) missingFields.push('nombre');
        if (!email) missingFields.push('email');
        if (!telefono) missingFields.push('telefono');
        if (!servicio) missingFields.push('servicio');
        if (!descripcion) missingFields.push('descripcion');
        
        if (missingFields.length > 0) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    error: 'Campos requeridos faltantes',
                    missingFields: missingFields
                })
            };
        }
        
        // Validar email básico
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    error: 'Email inválido'
                })
            };
        }
        
        // Crear item para DynamoDB
        const leadId = 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        const timestamp = Date.now();
        
        const item = {
            id: { S: leadId },
            nombre: { S: nombre.trim() },
            email: { S: email.trim().toLowerCase() },
            telefono: { S: telefono.trim() },
            servicio: { S: servicio },
            descripcion: { S: descripcion.trim() },
            fecha: { S: now.split('T')[0] },
            fechaCompleta: { S: now },
            timestamp: { N: timestamp.toString() },
            status: { S: 'nuevo' },
            fuente: { S: 'formulario-web-mvp' }
        };
        
        console.log('Saving to DynamoDB:', item);
        
        // Guardar en DynamoDB
        await client.send(new PutItemCommand({
            TableName: process.env.DYNAMODB_TABLE || 'heralft-leads-mvp',  // ← Actualizado
            Item: item
        }));
        
        console.log('✅ Lead saved to DynamoDB:', leadId);
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
                success: true,
                message: '✅ Solicitud recibida correctamente. Te contactaremos en menos de 24 horas.',
                leadId: leadId,
                timestamp: timestamp
            })
        };
        
    } catch (error) {
        console.error('❌ Error:', error);
        
        let errorMessage = 'Error interno del servidor';
        let statusCode = 500;
        
        if (error.name === 'ResourceNotFoundException') {
            errorMessage = 'Tabla de DynamoDB no encontrada';
            statusCode = 503;
        } else if (error.name === 'AccessDeniedException') {
            errorMessage = 'Error de permisos en la base de datos';
            statusCode = 403;
        }
        
        return {
            statusCode: statusCode,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: errorMessage,
                details: error.message,
                code: error.name
            })
        };
    }
};
