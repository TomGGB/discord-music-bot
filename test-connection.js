#!/usr/bin/env node

// Script simple para probar conexión a Discord
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

console.log('🔍 Probando conexión a Discord...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'CONFIGURADO' : 'NO CONFIGURADO');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => {
    console.log('✅ Bot conectado exitosamente como:', client.user.tag);
    console.log('🎮 ID del bot:', client.user.id);
    console.log('📊 Servidores:', client.guilds.cache.size);
    process.exit(0);
});

client.on('error', (error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});

// Timeout
setTimeout(() => {
    console.error('❌ Timeout: No se pudo conectar en 15 segundos');
    process.exit(1);
}, 15000);

client.login(process.env.DISCORD_TOKEN)
    .catch(error => {
        console.error('❌ Error en login:', error);
        process.exit(1);
    });
