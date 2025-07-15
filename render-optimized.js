const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// Configuración de variables de entorno
require('dotenv').config();

console.log('🔍 Verificando variables de entorno...');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'CONFIGURADO' : '❌ NO CONFIGURADO');

// Verificar que el token existe
if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN no está configurado');
    process.exit(1);
}

// Configuración del cliente Discord optimizada para Render
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    // Configuración específica para Render
    ws: {
        compression: 'zlib-stream',
        connectionTimeout: 30000,
        handshakeTimeout: 30000,
        heartbeatInterval: 41250,
        identifyTimeout: 5000,
        version: 10,
        encoding: 'json'
    },
    // Configuración de REST API
    rest: {
        timeout: 30000,
        retries: 5,
        rejectOnRateLimit: false
    },
    shards: 'auto',
    allowedMentions: {
        parse: ['users', 'roles'],
        repliedUser: false
    }
});

// Servidor Express para health checks
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware básico
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    const status = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        bot: {
            ready: client.readyAt !== null,
            user: client.user ? client.user.tag : 'Not logged in',
            guilds: client.guilds.cache.size,
            ping: client.ws.ping
        },
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
    };
    res.json(status);
});

// Endpoint raíz
app.get('/', (req, res) => {
    res.json({ 
        message: 'LanaMusic Bot is running!',
        status: client.readyAt ? 'online' : 'starting...',
        user: client.user ? client.user.tag : 'Not logged in'
    });
});

// Endpoint de ping
app.get('/ping', (req, res) => {
    res.json({ 
        pong: true, 
        timestamp: new Date().toISOString(),
        ping: client.ws.ping
    });
});

// Manejar errores del cliente
client.on('error', (error) => {
    console.error('❌ Error del cliente Discord:', error);
});

client.on('warn', (warning) => {
    console.warn('⚠️ Advertencia del cliente Discord:', warning);
});

client.on('debug', (debug) => {
    // Solo mostrar debug importante
    if (debug.includes('Heartbeat') || debug.includes('Identifying') || debug.includes('Ready')) {
        console.log('🔧 DEBUG:', debug);
    }
});

// Evento cuando el bot se conecta
client.on('ready', () => {
    console.log('✅ Bot conectado exitosamente!');
    console.log(`🤖 Loggeado como: ${client.user.tag}`);
    console.log(`🏠 Servidores: ${client.guilds.cache.size}`);
    console.log(`📡 Ping: ${client.ws.ping}ms`);
    
    // Establecer actividad del bot
    client.user.setActivity('música 🎵', { type: 2 }); // type 2 = LISTENING
    
    // Log de servidores
    client.guilds.cache.forEach(guild => {
        console.log(`📍 Servidor: ${guild.name} (${guild.id}) - Miembros: ${guild.memberCount}`);
    });
});

// Eventos de conexión
client.on('disconnect', (event) => {
    console.warn('⚠️ Bot desconectado:', event);
});

client.on('reconnecting', () => {
    console.log('🔄 Bot reconectando...');
});

client.on('guildCreate', (guild) => {
    console.log(`📍 Unido al servidor: ${guild.name} (${guild.id})`);
});

client.on('guildDelete', (guild) => {
    console.log(`📤 Salió del servidor: ${guild.name} (${guild.id})`);
});

// Manejo básico de mensajes
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Comando de ping
    if (message.content === '!ping') {
        await message.reply(`🏓 Pong! Latencia: ${client.ws.ping}ms`);
    }
    
    // Comando de info
    if (message.content === '!info') {
        const embed = {
            color: 0x00ff00,
            title: '🎵 LanaMusic Bot',
            description: 'Bot de música para Discord',
            fields: [
                { name: '📡 Ping', value: `${client.ws.ping}ms`, inline: true },
                { name: '🏠 Servidores', value: `${client.guilds.cache.size}`, inline: true },
                { name: '⏰ Uptime', value: `${Math.floor(client.uptime / 1000)}s`, inline: true }
            ],
            timestamp: new Date().toISOString()
        };
        await message.reply({ embeds: [embed] });
    }
});

// Iniciar servidor Express
app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Servidor Express iniciado');
    console.log(`🔗 Disponible en: http://0.0.0.0:${PORT}`);
    console.log('📡 Endpoints: /, /health, /ping');
});

// Función para conectar el bot con reintentos
async function connectBot() {
    console.log('🔐 Iniciando conexión del bot...');
    
    try {
        await client.login(process.env.DISCORD_TOKEN);
        console.log('✅ Login exitoso');
    } catch (error) {
        console.error('❌ Error durante el login:', error);
        
        // Reintentar después de 10 segundos
        setTimeout(() => {
            console.log('🔄 Reintentando conexión...');
            connectBot();
        }, 10000);
    }
}

// Manejo de errores del proceso
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

// Manejo de señales de terminación
process.on('SIGINT', () => {
    console.log('📴 Cerrando bot...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('📴 Terminando bot...');
    client.destroy();
    process.exit(0);
});

// Iniciar el bot
connectBot();
