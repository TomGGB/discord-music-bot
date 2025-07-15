#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// En producción, usar variables de entorno del sistema
if (process.env.NODE_ENV === 'production') {
    console.log('🌐 Modo producción detectado - usando variables de entorno del sistema');
    
    // Verificar variables requeridas en producción
    const requiredVars = ['DISCORD_TOKEN'];
    const missingVars = [];

    for (const varName of requiredVars) {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    }

    if (missingVars.length > 0) {
        console.log('❌ Error: Faltan variables de entorno en producción:');
        missingVars.forEach(varName => {
            console.log(`   - ${varName}`);
        });
        process.exit(1);
    }
    
    // Iniciar directamente en producción
    startBot();
    return;
}

// Verificar archivo .env (solo en desarrollo)
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.log('❌ Error: No se encontró el archivo .env');
    console.log('💡 Ejecuta "npm run setup" para configurar el bot');
    process.exit(1);
}

// Leer variables de entorno
require('dotenv').config();

// Verificar variables requeridas
const requiredVars = ['DISCORD_TOKEN', 'MUSIC_CHANNEL_ID'];
const missingVars = [];

for (const varName of requiredVars) {
    if (!process.env[varName] || process.env[varName].includes('_aqui')) {
        missingVars.push(varName);
    }
}

if (missingVars.length > 0) {
    console.log('❌ Error: Faltan variables de entorno:');
    missingVars.forEach(varName => {
        console.log(`   - ${varName}`);
    });
    console.log('💡 Ejecuta "npm run setup" para configurar el bot');
    process.exit(1);
}

// Verificar FFmpeg
const { spawn } = require('child_process');
const ffmpeg = spawn('ffmpeg', ['-version'], { stdio: 'pipe' });

ffmpeg.on('error', (error) => {
    console.log('⚠️  Advertencia: FFmpeg no está instalado o no está en el PATH');
    console.log('   El bot puede tener problemas para reproducir audio');
    console.log('   Instala FFmpeg desde: https://ffmpeg.org/download.html\n');
    startBot();
});

ffmpeg.on('close', (code) => {
    if (code === 0) {
        console.log('✅ FFmpeg encontrado');
    }
    startBot();
});

function startBot() {
    console.log('🎵 Iniciando Bot de Música de Discord...\n');
    
    // Importar y ejecutar el bot principal
    require('./index.js');
}

// Manejar errores no capturados
process.on('unhandledRejection', (reason, promise) => {
    console.log('❌ Error no manejado:', reason);
    console.log('En:', promise);
});

process.on('uncaughtException', (error) => {
    console.log('❌ Excepción no capturada:', error);
    process.exit(1);
});
