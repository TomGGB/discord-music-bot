// Health check específico para Render
const express = require('express');
const app = express();

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
