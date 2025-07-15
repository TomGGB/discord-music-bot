// Diagnóstico completo de conexión Discord
const { Client, GatewayIntentBits, Events } = require('discord.js');

console.log('🔍 DIAGNÓSTICO COMPLETO DE CONEXIÓN DISCORD');
console.log('============================================');

// Verificar variables de entorno
console.log('📋 Variables de entorno:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'CONFIGURADO' : 'NO CONFIGURADO');
console.log('  Token length:', process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.length : 'N/A');

if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN no configurado');
    process.exit(1);
}

// Test 1: Verificar token con API REST
console.log('\n🧪 Test 1: Verificando token con Discord API...');

const https = require('https');
const options = {
    hostname: 'discord.com',
    port: 443,
    path: '/api/v10/users/@me',
    method: 'GET',
    headers: {
        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json'
    }
};

const tokenTest = new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                const botInfo = JSON.parse(data);
                console.log('✅ Token válido');
                console.log('🤖 Bot:', botInfo.username + '#' + botInfo.discriminator);
                console.log('🆔 ID:', botInfo.id);
                resolve(true);
            } else {
                console.log('❌ Token inválido - Status:', res.statusCode);
                console.log('📄 Response:', data);
                resolve(false);
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('❌ Error:', error);
        reject(error);
    });
    
    req.setTimeout(5000, () => {
        console.error('❌ Timeout');
        req.destroy();
        reject(new Error('Timeout'));
    });
    
    req.end();
});

// Test 2: Verificar conexión WebSocket
console.log('\n🧪 Test 2: Probando conexión WebSocket...');

const websocketTest = new Promise((resolve, reject) => {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildVoiceStates
        ]
    });

    const timeout = setTimeout(() => {
        console.log('❌ WebSocket timeout después de 30 segundos');
        client.destroy();
        resolve(false);
    }, 30000);

    client.on('ready', () => {
        console.log('✅ WebSocket conectado exitosamente');
        console.log('🤖 Loggeado como:', client.user.tag);
        console.log('🏠 Servidores:', client.guilds.cache.size);
        clearTimeout(timeout);
        client.destroy();
        resolve(true);
    });

    client.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        clearTimeout(timeout);
        client.destroy();
        resolve(false);
    });

    client.on('disconnect', () => {
        console.log('⚠️ WebSocket desconectado');
    });

    client.on('reconnecting', () => {
        console.log('🔄 WebSocket reintentando...');
    });

    try {
        client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        console.error('❌ Error en login:', error);
        clearTimeout(timeout);
        resolve(false);
    }
});

// Ejecutar tests
async function runTests() {
    try {
        const tokenValid = await tokenTest;
        
        if (tokenValid) {
            console.log('\n🔍 Token válido, probando WebSocket...');
            const websocketValid = await websocketTest;
            
            if (websocketValid) {
                console.log('\n✅ DIAGNÓSTICO: Todo funciona correctamente');
                console.log('💡 El problema puede ser específico de Render');
            } else {
                console.log('\n❌ DIAGNÓSTICO: Problema con WebSocket');
                console.log('💡 Posibles causas:');
                console.log('   - Firewall o proxy bloqueando WebSocket');
                console.log('   - Problemas de conectividad');
                console.log('   - Bot deshabilitado en Discord');
            }
        } else {
            console.log('\n❌ DIAGNÓSTICO: Token inválido');
            console.log('💡 Necesitas:');
            console.log('   1. Regenerar token en Discord Developer Portal');
            console.log('   2. Actualizar DISCORD_TOKEN en Render');
            console.log('   3. Verificar que el bot esté habilitado');
        }
    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
    }
    
    process.exit(0);
}

runTests();
