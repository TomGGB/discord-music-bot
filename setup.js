#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🎵 Configurador del Bot de Música de Discord\n');

async function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function setup() {
    console.log('Te ayudo a configurar tu bot de música paso a paso:\n');
    
    // Verificar si existe .env
    const envPath = path.join(__dirname, '.env');
    let envExists = fs.existsSync(envPath);
    
    if (!envExists) {
        console.log('📁 Creando archivo .env...');
        fs.copyFileSync(path.join(__dirname, '.env.example'), envPath);
        console.log('✅ Archivo .env creado\n');
    }
    
    // Leer el archivo .env actual
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Configurar Discord Token
    const discordToken = await askQuestion('🤖 Ingresa el token de tu bot de Discord: ');
    if (discordToken.trim()) {
        envContent = envContent.replace(/DISCORD_TOKEN=.*/, `DISCORD_TOKEN=${discordToken.trim()}`);
        console.log('✅ Token de Discord configurado\n');
    }
    
    // Configurar canal de música
    const channelId = await askQuestion('📢 Ingresa el ID del canal de música: ');
    if (channelId.trim()) {
        envContent = envContent.replace(/MUSIC_CHANNEL_ID=.*/, `MUSIC_CHANNEL_ID=${channelId.trim()}`);
        console.log('✅ Canal de música configurado\n');
    }
    
    // Configurar Spotify (opcional)
    const useSpotify = await askQuestion('🎵 ¿Quieres configurar Spotify? (s/n): ');
    if (useSpotify.toLowerCase() === 's' || useSpotify.toLowerCase() === 'si') {
        const spotifyClientId = await askQuestion('🔑 Ingresa el Client ID de Spotify: ');
        const spotifyClientSecret = await askQuestion('🔐 Ingresa el Client Secret de Spotify: ');
        
        if (spotifyClientId.trim() && spotifyClientSecret.trim()) {
            envContent = envContent.replace(/SPOTIFY_CLIENT_ID=.*/, `SPOTIFY_CLIENT_ID=${spotifyClientId.trim()}`);
            envContent = envContent.replace(/SPOTIFY_CLIENT_SECRET=.*/, `SPOTIFY_CLIENT_SECRET=${spotifyClientSecret.trim()}`);
            console.log('✅ Spotify configurado\n');
        }
    }
    
    // Guardar configuración
    fs.writeFileSync(envPath, envContent);
    console.log('💾 Configuración guardada en .env\n');
    
    // Preguntar si quiere instalar dependencias
    const installDeps = await askQuestion('📦 ¿Quieres instalar las dependencias ahora? (s/n): ');
    if (installDeps.toLowerCase() === 's' || installDeps.toLowerCase() === 'si') {
        console.log('📦 Instalando dependencias...');
        
        const npm = spawn('npm', ['install'], { stdio: 'inherit' });
        npm.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Dependencias instaladas correctamente\n');
                
                // Preguntar si quiere ejecutar el bot
                rl.question('🚀 ¿Quieres ejecutar el bot ahora? (s/n): ', (answer) => {
                    if (answer.toLowerCase() === 's' || answer.toLowerCase() === 'si') {
                        console.log('🎵 Iniciando bot...\n');
                        spawn('npm', ['start'], { stdio: 'inherit' });
                    } else {
                        console.log('✅ Setup completado. Ejecuta "npm start" para iniciar el bot.');
                    }
                    rl.close();
                });
            } else {
                console.log('❌ Error al instalar dependencias');
                rl.close();
            }
        });
    } else {
        console.log('✅ Setup completado. Ejecuta "npm install" y luego "npm start" para iniciar el bot.');
        rl.close();
    }
}

setup().catch(console.error);
