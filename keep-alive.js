const http = require('http');
const url = require('url');

// Función para verificar el estado del bot
function getBotStatus() {
    const client = global.client;
    
    if (!client) {
        return {
            status: 'disconnected',
            message: 'Bot no inicializado',
            uptime: 0,
            guilds: 0,
            timestamp: new Date().toISOString()
        };
    }
    
    return {
        status: client.isReady() ? 'connected' : 'disconnected',
        message: client.isReady() ? 'Bot operando correctamente' : 'Bot desconectado',
        uptime: Math.floor(client.uptime / 1000) || 0,
        guilds: client.guilds.cache.size || 0,
        user: client.user ? client.user.tag : 'Unknown',
        timestamp: new Date().toISOString()
    };
}

// Crear servidor HTTP para mantener el bot activo
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // Configurar headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Manejar diferentes rutas
    if (pathname === '/health') {
        // Health check endpoint
        const botStatus = getBotStatus();
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
            status: 'healthy',
            bot: botStatus,
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                pid: process.pid,
                platform: process.platform,
                node_version: process.version
            }
        }, null, 2));
        
    } else if (pathname === '/status') {
        // Status endpoint específico del bot
        const botStatus = getBotStatus();
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(botStatus, null, 2));
        
    } else if (pathname === '/ping') {
        // Ping endpoint simple
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
            message: 'pong',
            timestamp: new Date().toISOString()
        }));
        
    } else {
        // Página principal
        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200);
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>LanaMusic Bot - Keep Alive</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                    .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
                    .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
                    .connected { background: #d4edda; color: #155724; }
                    .disconnected { background: #f8d7da; color: #721c24; }
                    .info { background: #d1ecf1; color: #0c5460; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🎵 LanaMusic Bot - Keep Alive Server</h1>
                    <div class="info status">
                        <strong>Servidor activo:</strong> ${new Date().toLocaleString()}
                    </div>
                    <div class="info status">
                        <strong>Uptime del servidor:</strong> ${Math.floor(process.uptime())} segundos
                    </div>
                    <p>Este servidor mantiene el bot activo en Render.com</p>
                    <h2>Endpoints disponibles:</h2>
                    <ul>
                        <li><a href="/health">/health</a> - Estado completo del sistema</li>
                        <li><a href="/status">/status</a> - Estado del bot Discord</li>
                        <li><a href="/ping">/ping</a> - Ping simple</li>
                    </ul>
                </div>
            </body>
            </html>
        `);
    }
});

// Puerto que usará Render
const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`🌐 Keep-alive server running on port ${port}`);
});

module.exports = server;
