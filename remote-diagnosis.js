// Diagnóstico remoto para troubleshooting
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
app.use(express.json());

// Endpoint para diagnosticar el problema
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
            user: global.client && global.client.user ? global.client.user.tag : null
        },
        connection_test: null,
        error_details: null
    };

    // Intentar conexión de prueba
    try {
        const testClient = new Client({
            intents: [GatewayIntentBits.Guilds]
        });

        const connectionPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('CONNECTION_TIMEOUT'));
            }, 10000);

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
            name: error.name,
            stack: error.stack
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
            process.exit(0); // PM2 o Render reiniciará
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

// Endpoint para obtener logs en tiempo real
app.get('/logs', (req, res) => {
    const logs = global.botLogs || [];
    res.json({
        logs: logs.slice(-50), // Últimos 50 logs
        count: logs.length
    });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`🔧 Diagnóstico remoto disponible en puerto ${port}`);
});

module.exports = app;
