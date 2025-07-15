// Script para verificar la configuración del bot
const { Client, GatewayIntentBits } = require('discord.js');

// Verificar variables de entorno
console.log('🔍 Verificando configuración...');
console.log('================================');

// 1. Verificar token
const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error('❌ DISCORD_TOKEN no está configurado');
    process.exit(1);
}

console.log('✅ DISCORD_TOKEN configurado');
console.log('📝 Token empieza con:', token.substring(0, 20) + '...');
console.log('📝 Token length:', token.length);

// Verificar formato del token
const tokenParts = token.split('.');
if (tokenParts.length !== 3) {
    console.error('❌ Token tiene formato incorrecto');
    console.error('   El token debe tener 3 partes separadas por puntos');
    process.exit(1);
}

console.log('✅ Token tiene formato válido (3 partes)');

// 2. Crear cliente simplificado para prueba
console.log('\n🤖 Creando cliente de prueba...');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 3. Configurar eventos
let connected = false;
let errorOccurred = false;

client.on('ready', () => {
    console.log('✅ BOT CONECTADO EXITOSAMENTE');
    console.log('📋 Usuario:', client.user.tag);
    console.log('📋 ID:', client.user.id);
    console.log('📋 Servidores:', client.guilds.cache.size);
    console.log('📋 Ping:', client.ws.ping + 'ms');
    
    connected = true;
    
    setTimeout(() => {
        console.log('\n🎯 CONEXIÓN EXITOSA - Bot funcionando correctamente');
        process.exit(0);
    }, 2000);
});

client.on('error', (error) => {
    console.error('❌ ERROR DE CONEXIÓN:', error.message);
    console.error('🔍 Código de error:', error.code);
    
    errorOccurred = true;
    
    // Errores comunes y soluciones
    if (error.code === 'INVALID_TOKEN') {
        console.error('\n🚨 SOLUCIÓN: Token inválido');
        console.error('   1. Ve a https://discord.com/developers/applications');
        console.error('   2. Selecciona tu aplicación');
        console.error('   3. Ve a "Bot" > "Token"');
        console.error('   4. Haz clic en "Reset Token"');
        console.error('   5. Copia el nuevo token COMPLETO');
        console.error('   6. Actualiza la variable DISCORD_TOKEN en Render');
    } else if (error.code === 'DISALLOWED_INTENTS') {
        console.error('\n🚨 SOLUCIÓN: Intents no permitidos');
        console.error('   1. Ve a https://discord.com/developers/applications');
        console.error('   2. Selecciona tu aplicación');
        console.error('   3. Ve a "Bot" > "Privileged Gateway Intents"');
        console.error('   4. Activa TODOS los intents:');
        console.error('      - PRESENCE INTENT');
        console.error('      - SERVER MEMBERS INTENT');
        console.error('      - MESSAGE CONTENT INTENT');
        console.error('   5. Guarda los cambios');
    } else if (error.code === 'TOKEN_INVALID') {
        console.error('\n🚨 SOLUCIÓN: Token mal formateado');
        console.error('   1. Verifica que el token no tenga espacios');
        console.error('   2. Debe empezar con MTxxxxxxxxx');
        console.error('   3. Debe tener exactamente 3 partes separadas por puntos');
    }
    
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// 4. Timeout de conexión
setTimeout(() => {
    if (!connected && !errorOccurred) {
        console.error('❌ TIMEOUT: No se pudo conectar en 30 segundos');
        console.error('\n🚨 POSIBLES CAUSAS:');
        console.error('   1. Token inválido o revocado');
        console.error('   2. Intents no activados en Discord Developer Portal');
        console.error('   3. Problemas de red/firewall');
        console.error('   4. Bot deshabilitado en Discord');
        
        console.error('\n🔧 PASOS A SEGUIR:');
        console.error('   1. Verifica el token en Discord Developer Portal');
        console.error('   2. Activa todos los Privileged Gateway Intents');
        console.error('   3. Asegúrate de que PUBLIC BOT esté activado');
        console.error('   4. Regenera el token si es necesario');
        
        process.exit(1);
    }
}, 30000);

// 5. Intentar conexión
console.log('🔌 Intentando conectar...');
client.login(token).catch(error => {
    console.error('❌ Error al hacer login:', error.message);
    errorOccurred = true;
});
