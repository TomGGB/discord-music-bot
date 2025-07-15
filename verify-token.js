// Script para verificar token de Discord
const https = require('https');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN no configurado');
    process.exit(1);
}

console.log('🔍 Verificando token de Discord...');
console.log('Token length:', DISCORD_TOKEN.length);
console.log('Token prefix:', DISCORD_TOKEN.substring(0, 20) + '...');

// Verificar token haciendo request a Discord API
const options = {
    hostname: 'discord.com',
    port: 443,
    path: '/api/v10/users/@me',
    method: 'GET',
    headers: {
        'Authorization': `Bot ${DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/TomGGB/discord-music-bot, 1.0.0)'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('📊 Status Code:', res.statusCode);
        console.log('📋 Headers:', res.headers);
        
        if (res.statusCode === 200) {
            const botInfo = JSON.parse(data);
            console.log('✅ Token válido!');
            console.log('🤖 Bot info:', {
                id: botInfo.id,
                username: botInfo.username,
                discriminator: botInfo.discriminator,
                bot: botInfo.bot,
                verified: botInfo.verified,
                public_flags: botInfo.public_flags
            });
        } else {
            console.log('❌ Token inválido o problema de autenticación');
            console.log('📄 Response:', data);
            
            if (res.statusCode === 401) {
                console.log('🔑 El token está revocado o es inválido');
                console.log('💡 Necesitas regenerar el token en Discord Developer Portal');
            }
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Error verificando token:', error);
});

req.setTimeout(10000, () => {
    console.error('❌ Timeout verificando token');
    req.destroy();
});

req.end();
