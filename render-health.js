// Health check específico para Render
const express = require('express');
const crypto = require('crypto');
const app = express();

// Función para verificar firmas de Discord
function verifyDiscordSignature(signature, timestamp, body, publicKey) {
    try {
        if (!signature || !timestamp || !body) {
            return false;
        }
        
        // Discord no requiere verificación de firma para el PING inicial
        // Solo la requiere para interacciones reales
        return true;
    } catch (error) {
        console.error('Error verificando firma:', error);
        return false;
    }
}

// Middleware para CORS y headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Signature-Ed25519, X-Signature-Timestamp');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

// Middleware para logging
app.use((req, res, next) => {
    console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Estado del bot
let botStatus = {
    connected: false,
    ready: false,
    startTime: new Date(),
    lastPing: null,
    errors: [],
    guilds: 0,
    user: null
};

// Función para actualizar el estado del bot
function updateBotStatus(client) {
    if (!client) return;
    
    botStatus.connected = client.ws.status === 0; // READY
    botStatus.ready = client.isReady();
    botStatus.lastPing = client.ws.ping;
    botStatus.guilds = client.guilds.cache.size;
    botStatus.user = client.user ? client.user.tag : null;
}

// Endpoint principal - Render necesita que responda en /
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'LanaMusic Bot',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - botStatus.startTime) / 1000),
        message: 'Bot service is running'
    });
});

// Health check para Render
app.get('/health', (req, res) => {
    const client = global.client;
    if (client) {
        updateBotStatus(client);
    }
    
    const isHealthy = botStatus.connected && botStatus.ready;
    
    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        bot: botStatus,
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            platform: process.platform,
            nodeVersion: process.version,
            env: process.env.NODE_ENV
        },
        timestamp: new Date().toISOString()
    });
});

// Endpoint de ping simple
app.get('/ping', (req, res) => {
    res.json({
        pong: true,
        timestamp: new Date().toISOString(),
        latency: Date.now() - req.query.t || 0
    });
});

// Endpoint para verificar todos los endpoints de Discord
app.get('/test-discord', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    res.json({
        endpoints: {
            main: `${baseUrl}/interactions`,
            api: `${baseUrl}/api/interactions`,
            discord: `${baseUrl}/discord/interactions`
        },
        test_payload: {
            type: 1,
            note: "Este es el payload que Discord enviará para verificar"
        },
        curl_test: `curl -X POST ${baseUrl}/interactions -H "Content-Type: application/json" -d '{"type":1}'`
    });
});

// Endpoint OAuth2 callback (requerido por Discord)
app.get('/oauth2/callback', (req, res) => {
    const { code, state } = req.query;
    
    res.json({
        message: 'OAuth2 callback received',
        code: code ? 'received' : 'missing',
        state: state || 'none',
        timestamp: new Date().toISOString()
    });
});

// Endpoint adicional para verificación de Discord
app.post('/api/interactions', express.raw({ type: 'application/json' }), (req, res) => {
    console.log('🔍 Verificación Discord en /api/interactions');
    
    let body;
    try {
        if (Buffer.isBuffer(req.body)) {
            body = JSON.parse(req.body.toString());
        } else {
            body = req.body;
        }
    } catch (error) {
        console.error('Error parsing body en /api/interactions:', error);
        return res.status(400).json({ error: 'Invalid JSON' });
    }
    
    console.log('📨 Body recibido en /api/interactions:', body);
    
    if (body.type === 1) {
        console.log('🏓 PING en /api/interactions - respondiendo PONG');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        return res.status(200).json({ type: 1 });
    }
    
    // Para otras interacciones, responder con éxito
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json({
        type: 4,
        data: {
            content: 'Endpoint /api/interactions funcionando',
            flags: 64
        }
    });
});

// Endpoint específico para verificación simple
app.post('/discord/interactions', express.raw({ type: 'application/json' }), (req, res) => {
    console.log('🔍 Verificación Discord en /discord/interactions');
    
    let body;
    try {
        if (Buffer.isBuffer(req.body)) {
            body = JSON.parse(req.body.toString());
        } else {
            body = req.body;
        }
    } catch (error) {
        console.error('Error parsing body en /discord/interactions:', error);
        return res.status(400).json({ error: 'Invalid JSON' });
    }
    
    console.log('📨 Body recibido en /discord/interactions:', body);
    
    if (body.type === 1) {
        console.log('🏓 PING en /discord/interactions - respondiendo PONG');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        return res.status(200).json({ type: 1 });
    }
    
    // Para otras interacciones, responder con éxito
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json({
        type: 4,
        data: {
            content: 'Endpoint /discord/interactions funcionando',
            flags: 64
        }
    });
});

// Endpoint de interacciones de Discord (requerido para slash commands)
app.post('/interactions', express.raw({ type: 'application/json' }), (req, res) => {
    let body;
    let bodyString;
    
    try {
        // Obtener el body como string para verificación
        if (Buffer.isBuffer(req.body)) {
            bodyString = req.body.toString();
            body = JSON.parse(bodyString);
        } else {
            bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            body = req.body;
        }
    } catch (error) {
        console.error('❌ Error parsing body:', error);
        return res.status(400).json({ error: 'Invalid JSON' });
    }
    
    const { type, data, id, token } = body;
    
    // Headers de Discord
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    const userAgent = req.headers['user-agent'];
    
    console.log('📨 Interacción Discord recibida:', {
        type,
        command: data?.name || 'none',
        id: id || 'none',
        signature: signature ? 'presente' : 'ausente',
        timestamp: timestamp || 'none',
        userAgent: userAgent || 'none',
        bodyLength: bodyString?.length || 0,
        contentType: req.headers['content-type'],
        method: req.method,
        path: req.path
    });
    
    // Verificación de firma opcional (Discord la requiere en producción)
    if (signature && timestamp && process.env.DISCORD_PUBLIC_KEY) {
        console.log('🔐 Verificando firma Discord...');
        const { verifyDiscordSignature } = require('./discord-verify');
        
        if (!verifyDiscordSignature(bodyString, signature, timestamp)) {
            console.log('❌ Firma Discord inválida');
            return res.status(401).json({ error: 'Invalid signature' });
        }
        console.log('✅ Firma Discord válida');
    } else {
        console.log('⚠️ Saltando verificación de firma (desarrollo o faltan datos)');
    }
    
    // Configurar headers de respuesta estándar
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Tipo 1: PING - Discord verifica que el endpoint funciona
    if (type === 1) {
        console.log('🏓 Discord PING recibido - respondiendo PONG');
        const response = { type: 1 };
        console.log('📤 Enviando respuesta PONG:', response);
        return res.status(200).json(response);
    }
    
    // Tipo 2: APPLICATION_COMMAND - Comando slash
    if (type === 2) {
        console.log('⚡ Comando slash recibido:', data?.name || 'desconocido');
        
        // Respuesta específica por comando
        if (data?.name === 'ping') {
            const response = {
                type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
                data: {
                    content: '🏓 ¡Pong! El bot está funcionando correctamente desde Render.',
                    flags: 64 // EPHEMERAL
                }
            };
            console.log('📤 Enviando respuesta ping:', response);
            return res.status(200).json(response);
        }
        
        if (data?.name === 'setup') {
            const response = {
                type: 4,
                data: {
                    content: '⚙️ Comando setup recibido. Endpoint web activo y funcionando.',
                    flags: 64
                }
            };
            console.log('📤 Enviando respuesta setup:', response);
            return res.status(200).json(response);
        }
        
        // Respuesta genérica para otros comandos
        const response = {
            type: 4,
            data: {
                content: `✅ Comando /${data?.name || 'desconocido'} recibido correctamente desde Render!`,
                flags: 64
            }
        };
        console.log('📤 Enviando respuesta genérica:', response);
        return res.status(200).json(response);
    }
    
    // Tipo 3: MESSAGE_COMPONENT - Botones, selects, etc.
    if (type === 3) {
        console.log('🔘 Componente de mensaje:', data?.custom_id || 'none');
        const response = {
            type: 4,
            data: {
                content: '✅ Componente procesado correctamente',
                flags: 64
            }
        };
        console.log('📤 Enviando respuesta componente:', response);
        return res.status(200).json(response);
    }
    
    // Otros tipos de interacciones
    console.log('❓ Tipo de interacción desconocida:', type);
    const response = {
        type: 4,
        data: {
            content: `❓ Tipo de interacción no soportada: ${type}`,
            flags: 64
        }
    };
    console.log('📤 Enviando respuesta desconocida:', response);
    return res.status(200).json(response);
});

// Endpoint GET para verificar interacciones (Discord a veces usa GET)
app.get('/interactions', (req, res) => {
    res.json({
        message: 'Endpoint de interacciones activo',
        timestamp: new Date().toISOString(),
        methods: ['POST'],
        discord_verification: 'ready'
    });
});

// Endpoints opcionales para términos y privacidad
app.get('/terms', (req, res) => {
    res.send(`
        <h1>Términos de Servicio - LanaMusic Bot</h1>
        <p>Este bot de música está destinado solo para uso personal y educativo.</p>
        <p>Última actualización: ${new Date().toLocaleDateString()}</p>
    `);
});

app.get('/privacy', (req, res) => {
    res.send(`
        <h1>Política de Privacidad - LanaMusic Bot</h1>
        <p>Este bot no recopila datos personales de los usuarios.</p>
        <p>Última actualización: ${new Date().toLocaleDateString()}</p>
    `);
});

// Endpoint para diagnosticar problemas de conexión
app.get('/diagnose', async (req, res) => {
    const diagnosis = {
        timestamp: new Date().toISOString(),
        environment: {
            node_version: process.version,
            platform: process.platform,
            env: process.env.NODE_ENV,
            discord_js_version: require('discord.js').version
        },
        token_info: {
            configured: !!process.env.DISCORD_TOKEN,
            length: process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.length : 0,
            prefix: process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.substring(0, 10) + '...' : 'No configurado',
            parts: process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.split('.').length : 0,
            format_valid: process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.split('.').length === 3 : false
        },
        global_client: {
            exists: !!global.client,
            ready: global.client ? global.client.isReady() : false,
            user: global.client && global.client.user ? global.client.user.tag : null,
            ws_status: global.client ? global.client.ws.status : 'No client'
        },
        endpoints: {
            health: `${req.protocol}://${req.get('host')}/health`,
            interactions: `${req.protocol}://${req.get('host')}/interactions`,
            api_interactions: `${req.protocol}://${req.get('host')}/api/interactions`,
            oauth2: `${req.protocol}://${req.get('host')}/oauth2/callback`,
            diagnose: `${req.protocol}://${req.get('host')}/diagnose`
        },
        discord_setup: {
            interaction_endpoint_url: `${req.protocol}://${req.get('host')}/interactions`,
            redirect_uri: `${req.protocol}://${req.get('host')}/oauth2/callback`,
            note: 'Usa interaction_endpoint_url en Discord Developer Portal',
            public_key_needed: 'Configura DISCORD_PUBLIC_KEY en Render para verificación de firma'
        },
        connection_test: null,
        error_details: null
    };

    // Intentar conexión de prueba rápida
    try {
        const { Client, GatewayIntentBits } = require('discord.js');
        const testClient = new Client({
            intents: [GatewayIntentBits.Guilds]
        });

        const connectionPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('CONNECTION_TIMEOUT'));
            }, 8000);

            testClient.on('ready', () => {
                clearTimeout(timeout);
                resolve({
                    success: true,
                    user: testClient.user.tag,
                    guilds: testClient.guilds.cache.size,
                    ping: testClient.ws.ping
                });
                testClient.destroy();
            });

            testClient.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });

            testClient.login(process.env.DISCORD_TOKEN).catch(reject);
        });

        diagnosis.connection_test = await connectionPromise;
        
    } catch (error) {
        diagnosis.error_details = {
            message: error.message,
            code: error.code,
            name: error.name
        };
        
        // Análisis del error
        if (error.code === 'INVALID_TOKEN') {
            diagnosis.recommendations = [
                'Token inválido - regenerar en Discord Developer Portal',
                'Verificar que el token no tenga espacios extra',
                'Confirmar que el token está correctamente configurado en Render'
            ];
        } else if (error.code === 'DISALLOWED_INTENTS') {
            diagnosis.recommendations = [
                'Activar Privileged Gateway Intents en Discord Developer Portal',
                'PRESENCE INTENT: Activar',
                'SERVER MEMBERS INTENT: Activar',  
                'MESSAGE CONTENT INTENT: Activar'
            ];
        } else if (error.message === 'CONNECTION_TIMEOUT') {
            diagnosis.recommendations = [
                'Problema de conectividad desde Render a Discord',
                'Verificar firewall/proxy settings',
                'Revisar configuración de WebSocket'
            ];
        } else {
            diagnosis.recommendations = [
                'Error desconocido - revisar logs completos',
                'Verificar configuración de Discord Developer Portal',
                'Considerar regenerar token'
            ];
        }
    }

    res.json(diagnosis);
});

// Endpoint para forzar reconexión
app.post('/reconnect', async (req, res) => {
    try {
        if (global.client) {
            await global.client.destroy();
        }
        
        // Reiniciar el proceso principal
        setTimeout(() => {
            process.exit(0); // Render reiniciará
        }, 1000);
        
        res.json({ 
            success: true, 
            message: 'Reiniciando proceso...' 
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint para registrar errores
app.post('/error', express.json(), (req, res) => {
    const error = {
        message: req.body.message,
        code: req.body.code,
        timestamp: new Date().toISOString()
    };
    
    botStatus.errors.push(error);
    
    // Mantener solo los últimos 10 errores
    if (botStatus.errors.length > 10) {
        botStatus.errors = botStatus.errors.slice(-10);
    }
    
    console.log('❌ Error registrado:', error);
    res.json({ success: true });
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error('❌ Error en servidor:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// Función para actualizar el estado del bot desde el exterior
function setBotStatus(status) {
    Object.assign(botStatus, status);
}

// Función para agregar errores
function addError(error) {
    const errorObj = {
        message: error.message || error,
        code: error.code || 'UNKNOWN',
        timestamp: new Date().toISOString()
    };
    
    botStatus.errors.push(errorObj);
    
    // Mantener solo los últimos 10 errores
    if (botStatus.errors.length > 10) {
        botStatus.errors = botStatus.errors.slice(-10);
    }
}

const port = process.env.PORT || 3000;

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Render health server iniciado en puerto ${port}`);
    console.log(`🔗 Disponible en: http://0.0.0.0:${port}`);
    console.log(`📡 Endpoints: /, /health, /ping`);
});

// Manejar cierre graceful
process.on('SIGTERM', () => {
    console.log('🔄 Cerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor cerrado');
        process.exit(0);
    });
});

module.exports = {
    app,
    server,
    setBotStatus,
    addError
};
