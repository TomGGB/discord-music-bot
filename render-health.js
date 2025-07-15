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
