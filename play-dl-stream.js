// Implementación de streaming de audio optimizada para Render usando play-dl, ytdl-core-discord y ytdl-core como fallbacks
const { createAudioResource, StreamType } = require('@discordjs/voice');
const play = require('play-dl');
const ytdl = require('ytdl-core');
const ytdlDiscord = require('ytdl-core-discord');
const { PassThrough } = require('stream');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');

/**
 * Crea un stream de audio usando play-dl, optimizado para funcionar en Render
 * @param {string} url - URL de YouTube a reproducir
 * @returns {Promise<Object>} - Objeto con stream y tipo para crear AudioResource
 */
async function createStreamWithPlayDl(url) {
    try {
        console.log('🔧 Intentando crear stream con play-dl (optimizado para Render)...');
        
        // Verificar si la URL es válida (básico)
        if (!url || typeof url !== 'string') {
            throw new Error('URL inválida o no proporcionada');
        }
        
        console.log('🔄 Intentando obtener stream directamente...');
        
        // Extraer el ID del video de YouTube de la URL
        let videoId = '';
        if (url.includes('youtube.com/watch?v=')) {
            videoId = url.split('v=')[1];
            if (videoId.includes('&')) {
                videoId = videoId.split('&')[0];
            }
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1];
            if (videoId.includes('?')) {
                videoId = videoId.split('?')[0];
            }
        }
        
        if (!videoId) {
            throw new Error('No se pudo extraer el ID del video de YouTube');
        }
        
        // Construir una URL limpia
        const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
        console.log('🔍 URL limpia:', cleanUrl);
        
        // Usar el método más simple y directo de play-dl con opciones específicas
        const stream = await play.stream(cleanUrl, {
            discordPlayerCompatibility: true,
            quality: 0  // Mejor calidad disponible
        });
        
        console.log('✅ Stream obtenido con play-dl');
        console.log('🎵 Tipo de recurso:', stream.type);
        
        // Devolver el objeto stream directamente para usar con createAudioResource
        return stream;
    } catch (error) {
        console.error('❌ Error con play-dl:', error.message);
        
        // Intentar con ytdl-core-discord como primera alternativa
        try {
            console.log('🔄 Intentando alternativa con ytdl-core-discord...');
            return await createStreamWithYtdlDiscord(url);
        } catch (ytdlDiscordError) {
            console.error('❌ Error con ytdl-core-discord:', ytdlDiscordError.message);
            
            // Si ytdl-core-discord falla, intentar con ytdl-core
            try {
                console.log('🔄 Intentando alternativa con ytdl-core...');
                return await createStreamWithYtdl(url);
            } catch (ytdlError) {
                console.error('❌ Error con ytdl-core:', ytdlError.message);
                
                // Si ytdl-core falla, intentar con FFmpeg como última opción
                console.log('🔄 Intentando método alternativo con FFmpeg...');
                return await createStreamWithPlayDlAndFfmpeg(url);
            }
        }
    }
}

/**
 * Crea un recurso de audio a partir de una URL de YouTube
 * @param {string} url - URL de YouTube a reproducir
 * @returns {Promise<AudioResource>} - Recurso de audio para discord.js
 */
async function createAudioResourceFromUrl(url) {
    try {
        const stream = await createStreamWithPlayDl(url);
        
        // Crear el recurso de audio usando el stream y tipo proporcionados por play-dl
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            inlineVolume: true,
            silencePaddingFrames: 3 // Reducir padding para menos latencia
        });
        
        // Establecer volumen por defecto más bajo para evitar distorsión
        resource.volume?.setVolume(0.3);
        
        return resource;
    } catch (error) {
        console.error('❌ Error creando recurso de audio:', error.message);
        throw error;
    }
}

/**
 * Método alternativo usando FFmpeg para casos donde play-dl y ytdl-core fallan
 * @param {string} url - URL de YouTube a reproducir
 * @returns {Promise<Object>} - Objeto con stream y tipo para crear AudioResource
 */
async function createStreamWithPlayDlAndFfmpeg(url) {
    try {
        console.log('🔧 Intentando crear stream con ytdl-core + FFmpeg...');
        
        // Verificar si la URL es válida para YouTube
        if (!ytdl.validateURL(url)) {
            throw new Error('URL de YouTube inválida');
        }
        
        // Obtener stream con ytdl-core con opciones optimizadas
        const ytStream = ytdl(url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25, // ~32MB buffer
        });
        
        // Crear un PassThrough para el resultado final
        const passthrough = new PassThrough({
            highWaterMark: 1 << 25 // Buffer grande
        });
        
        // Configurar FFmpeg para transcodificar a Opus
        const ffmpeg = spawn(ffmpegPath, [
            '-i', 'pipe:0',
            '-f', 'opus',
            '-acodec', 'libopus',
            '-ar', '48000',
            '-ac', '2',
            '-b:a', '128k',
            '-compression_level', '10',     // Nivel de compresión (0-10)
            '-application', 'audio',        // Optimizado para audio
            '-frame_duration', '20',        // Duración de frame en ms
            '-packet_loss', '5',            // Tolerancia a pérdida de paquetes
            '-vbr', 'on',                   // Bitrate variable
            '-af', 'bass=g=2,dynaudnorm=f=200', // Filtros de audio (más graves y normalización)
            'pipe:1'
        ], {
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // Conectar el stream de ytdl-core a la entrada de FFmpeg
        ytStream.pipe(ffmpeg.stdin);
        
        // Conectar la salida de FFmpeg al PassThrough
        ffmpeg.stdout.pipe(passthrough);
        
        // Manejar errores de FFmpeg
        ffmpeg.stderr.on('data', (data) => {
            console.log(`🔧 FFmpeg: ${data.toString().trim()}`);
        });
        
        // Manejar cierre de FFmpeg
        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                console.error(`❌ FFmpeg cerró con código ${code}`);
                passthrough.destroy(new Error(`FFmpeg cerró con código ${code}`));
            } else {
                console.log('✅ FFmpeg completó la transcodificación');
                passthrough.end();
            }
        });
        
        // Manejar errores en el stream original
        ytStream.on('error', (error) => {
            console.error('❌ Error en stream original:', error);
            ffmpeg.kill();
            passthrough.destroy(error);
        });
        
        console.log('✅ Stream con FFmpeg creado exitosamente');
        
        // Devolver un objeto similar al que devuelve play.stream()
        return {
            stream: passthrough,
            type: StreamType.Opus
        };
    } catch (error) {
        console.error('❌ Error con ytdl-core + FFmpeg:', error.message);
        throw error;
    }
}

/**
 * Crea un stream de audio usando ytdl-core-discord como alternativa a play-dl
 * @param {string} url - URL de YouTube a reproducir
 * @returns {Promise<Object>} - Objeto con stream y tipo para crear AudioResource
 */
async function createStreamWithYtdlDiscord(url) {
    try {
        console.log('🔧 Intentando crear stream con ytdl-core-discord...');
        
        // Verificar si la URL es válida para YouTube
        if (!ytdl.validateURL(url)) {
            throw new Error('URL de YouTube inválida');
        }
        
        // ytdl-core-discord devuelve directamente un stream Opus compatible con Discord.js
        const stream = await ytdlDiscord(url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25, // ~32MB buffer
            opusEncoded: true,
        });
        
        console.log('✅ Stream Opus obtenido con ytdl-core-discord');
        
        // Devolver un objeto similar al que devuelve play.stream()
        return {
            stream: stream,
            type: StreamType.Opus
        };
    } catch (error) {
        console.error('❌ Error con ytdl-core-discord:', error.message);
        throw error;
    }
}

/**
 * Crea un stream de audio usando ytdl-core como alternativa a play-dl
 * @param {string} url - URL de YouTube a reproducir
 * @returns {Promise<Object>} - Objeto con stream y tipo para crear AudioResource
 */
async function createStreamWithYtdl(url) {
    try {
        console.log('🔧 Intentando crear stream con ytdl-core...');
        
        // Verificar si la URL es válida para YouTube
        if (!ytdl.validateURL(url)) {
            throw new Error('URL de YouTube inválida');
        }
        
        // Obtener información del video primero para verificar disponibilidad
        const info = await ytdl.getInfo(url).catch(err => {
            console.error('❌ Error al obtener información del video:', err.message);
            throw new Error(`No se pudo obtener información del video: ${err.message}`);
        });
        
        console.log(`✅ Información obtenida para: ${info.videoDetails.title}`);
        
        // Crear un PassThrough para mayor estabilidad
        const passthrough = new PassThrough({
            highWaterMark: 1 << 25 // Buffer grande
        });
        
        // Obtener stream con ytdl-core con opciones optimizadas
        const stream = ytdl.downloadFromInfo(info, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25, // ~32MB buffer
            dlChunkSize: 0, // Descargar en un solo chunk
        });
        
        // Conectar el stream al PassThrough
        stream.pipe(passthrough);
        
        // Manejar errores
        stream.on('error', (error) => {
            console.error('❌ Error en ytdl-core stream:', error.message);
            passthrough.destroy(error);
        });
        
        console.log('✅ Stream obtenido con ytdl-core');
        
        // Devolver un objeto similar al que devuelve play.stream()
        return {
            stream: passthrough,
            type: StreamType.Arbitrary // ytdl-core no devuelve Opus, necesita FFmpeg
        };
    } catch (error) {
        console.error('❌ Error con ytdl-core:', error.message);
        throw error;
    }
}

module.exports = {
    createStreamWithPlayDl,
    createStreamWithYtdlDiscord,
    createStreamWithYtdl,
    createStreamWithPlayDlAndFfmpeg,
    createAudioResourceFromUrl
};