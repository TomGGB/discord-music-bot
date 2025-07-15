// Implementación de streaming de audio optimizada para Render usando play-dl, ytdl-core-discord y ytdl-core como fallbacks
const { createAudioResource, StreamType } = require('@discordjs/voice');
const play = require('play-dl');
const ytdl = require('ytdl-core');
const ytdlDiscord = require('ytdl-core-discord');
const { PassThrough } = require('stream');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');

// Configuración específica para Render
const isRender = process.env.RENDER === 'true' || process.env.IS_RENDER === 'true';

// Configurar play-dl para entorno de Render si es necesario
if (isRender) {
    console.log('🔧 Configurando play-dl para entorno de Render...');
    try {
        // Intentar configurar play-dl para Render con opciones optimizadas
        play.setToken({
            useragent: [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36'
            ]
        });
        
        // Configurar opciones adicionales para play-dl
        play.setPlayOptions({
            seek: 0,
            quality: 1,       // Calidad más baja pero estable
            htmldata: false,  // No necesitamos datos HTML
            disableFormatSelection: true, // Deshabilitar selección de formato para mayor velocidad
            backupIfNoAudio: true // Usar respaldo si no hay audio
        });
        
        console.log('✅ play-dl configurado para Render con opciones optimizadas');
    } catch (error) {
        console.error('⚠️ Error al configurar play-dl para Render:', error.message);
    }
}

/**
 * Crea un stream de audio usando play-dl, optimizado para funcionar en Render
 * @param {string} url - URL de YouTube a reproducir
 * @returns {Promise<Object>} - Objeto con stream y tipo para crear AudioResource
 */
async function createStreamWithPlayDl(url) {
    try {
        console.log('🔧 Intentando crear stream con play-dl (optimizado para Render)...');
        console.log('🔧 Entorno de Render detectado:', isRender ? 'Sí' : 'No');
        
        // Verificar si la URL es válida (básico)
        if (!url || typeof url !== 'string') {
            throw new Error('URL inválida o no proporcionada');
        }
        
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
        console.log('🔍 URL limpia para play-dl:', cleanUrl);
        
        // Verificar si play-dl puede obtener información del video
        let videoInfo;
        try {
            console.log('🔍 Verificando disponibilidad del video con play-dl...');
            videoInfo = await play.video_info(cleanUrl);
            console.log('✅ Información del video obtenida:', videoInfo.video_details.title);
            
            // Verificar si el video está disponible
            if (!videoInfo.video_details.available) {
                throw new Error('El video no está disponible según play-dl');
            }
            
            // Verificar si hay formatos de audio disponibles
            const formats = await videoInfo.format();
            const audioFormats = formats.filter(format => format.mimeType?.includes('audio'));
            
            if (audioFormats.length === 0) {
                throw new Error('No se encontraron formatos de audio disponibles');
            }
            
            console.log(`✅ Formatos de audio disponibles: ${audioFormats.length}`);
        } catch (infoError) {
            console.error('⚠️ Error al obtener información del video con play-dl:', infoError.message);
            // Si estamos en Render y hay un error al obtener info, pasamos directamente a ytdl-core-discord
            if (isRender) {
                console.log('🔄 Saltando play-dl en Render debido a error de información, intentando con ytdl-core-discord...');
                return await createStreamWithYtdlDiscord(url);
            } else {
                // Si no estamos en Render, intentamos con ytdl-core-discord de todos modos
                console.log('🔄 Error con play-dl, intentando con ytdl-core-discord...');
                return await createStreamWithYtdlDiscord(url);
            }
        }
        
        // Configurar opciones de stream según el entorno
        const streamOptions = {
            discordPlayerCompatibility: true
        };
        
        if (isRender) {
            // Opciones optimizadas para Render
            streamOptions.quality = 1;       // Calidad más baja pero estable
            streamOptions.opusEncoded = true; // Solicitar stream ya codificado en Opus si está disponible
        } else {
            // Opciones para entorno local
            streamOptions.quality = 0;       // Mejor calidad disponible
        }
        
        // Usar el método más simple y directo de play-dl con opciones específicas
        console.log('🔄 Obteniendo stream con play-dl...', streamOptions);
        
        // Establecer un timeout para la operación de streaming
        const streamPromise = play.stream(cleanUrl, streamOptions);
        
        // Crear una promesa con timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout al obtener stream con play-dl')), 15000);
        });
        
        // Esperar a que se complete la primera promesa (stream o timeout)
        const stream = await Promise.race([streamPromise, timeoutPromise]);
        
        console.log('✅ Stream obtenido con play-dl');
        console.log('🎵 Tipo de recurso:', stream.type);
        
        // Verificar que el stream sea válido
        if (!stream || !stream.stream) {
            console.error('⚠️ Stream inválido obtenido de play-dl');
            throw new Error('Stream inválido obtenido de play-dl');
        }
        
        // Añadir manejo de errores al stream
        stream.stream.on('error', (error) => {
            console.error('❌ Error en stream de play-dl:', error.message);
        });
        
        if (isRender) {
            // Añadir logging de eventos para debugging en Render
            stream.stream.on('end', () => {
                console.log('✅ Stream de play-dl finalizado correctamente');
            });
            
            stream.stream.on('close', () => {
                console.log('✅ Stream de play-dl cerrado');
            });
        }
        
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
        console.log('🔧 Creando recurso de audio para URL:', url);
        
        // Intentar obtener el stream con la función principal
        const stream = await createStreamWithPlayDl(url);
        
        console.log('🔧 Configurando recurso de audio con tipo:', stream.type);
        
        // Configurar opciones del recurso de audio según el entorno
        const resourceOptions = {
            inputType: stream.type,
            inlineVolume: true
        };
        
        if (isRender) {
            // Optimizaciones para Render
            resourceOptions.silencePaddingFrames = 5; // Aumentar padding para mayor estabilidad en Render
        } else {
            // Configuración para entorno local
            resourceOptions.silencePaddingFrames = 3; // Menos padding para menor latencia
        }
        
        // Crear el recurso de audio usando el stream y tipo proporcionados
        console.log('🔧 Creando recurso de audio con opciones:', resourceOptions);
        const resource = createAudioResource(stream.stream, resourceOptions);
        
        // Establecer volumen por defecto más bajo para evitar distorsión
        if (resource.volume) {
            const volumen = isRender ? 0.25 : 0.3; // Volumen más bajo en Render para evitar distorsión
            resource.volume.setVolume(volumen);
            console.log(`✅ Volumen establecido a ${volumen}`);
        }
        
        // Verificar que el recurso se haya creado correctamente
        if (!resource) {
            throw new Error('No se pudo crear el recurso de audio');
        }
        
        console.log('✅ Recurso de audio creado exitosamente');
        return resource;
    } catch (error) {
        console.error('❌ Error creando recurso de audio:', error.message);
        
        // Si estamos en Render, intentar una última vez con configuración mínima
        if (isRender) {
            try {
                console.log('🔄 Intentando crear recurso con configuración mínima...');
                
                // Intentar con ytdl-core directamente como último recurso
                const fallbackStream = ytdl(url, {
                    filter: 'audioonly',
                    quality: 'lowestaudio',
                    highWaterMark: 1 << 24
                });
                
                const fallbackResource = createAudioResource(fallbackStream, {
                    inputType: StreamType.Arbitrary,
                    inlineVolume: true
                });
                
                if (fallbackResource.volume) {
                    fallbackResource.volume.setVolume(0.2); // Volumen aún más bajo para el fallback
                }
                
                console.log('✅ Recurso de audio creado con configuración mínima');
                return fallbackResource;
            } catch (fallbackError) {
                console.error('❌ Error en último intento de crear recurso:', fallbackError.message);
                throw fallbackError;
            }
        } else {
            throw error;
        }
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
        
        // Extraer el ID del video para usar una URL limpia
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
        console.log('🔍 URL limpia para FFmpeg:', cleanUrl);
        
        // Verificar si podemos obtener información del video primero
        try {
            console.log('🔍 Verificando disponibilidad del video con ytdl-core...');
            const info = await ytdl.getBasicInfo(cleanUrl);
            console.log(`✅ Información básica obtenida: ${info.videoDetails.title}`);
        } catch (infoError) {
            console.error('⚠️ Error al obtener información básica:', infoError.message);
            throw new Error(`No se pudo verificar la disponibilidad del video: ${infoError.message}`);
        }
        
        // Obtener stream con ytdl-core con opciones optimizadas
        console.log('🔄 Obteniendo stream con ytdl-core para FFmpeg...');
        const ytStream = ytdl(cleanUrl, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25, // ~32MB buffer
        });
        
        // Crear un PassThrough para el resultado final
        const passthrough = new PassThrough({
            highWaterMark: 1 << 25 // ~32MB buffer
        });
        
        // Configurar FFmpeg para transcodificar a Opus
        console.log('🔧 Configurando FFmpeg para transcodificación a Opus...');
        
        // Opciones de FFmpeg optimizadas para Render
        const ffmpegOptions = [
            '-i', 'pipe:0',
            '-f', 'opus',
            '-acodec', 'libopus',
            '-ar', '48000',
            '-ac', '2'
        ];
        
        // Añadir opciones adicionales según el entorno
        if (isRender) {
            // Configuración más ligera para Render
            ffmpegOptions.push(
                '-b:a', '96k',              // Bitrate más bajo para Render
                '-compression_level', '8',   // Nivel de compresión un poco menor
                '-application', 'audio',     // Optimizado para audio
                '-frame_duration', '60',     // Frames más largos (menos sobrecarga)
                '-vbr', 'on'                // Bitrate variable
            );
        } else {
            // Configuración completa para entornos locales
            ffmpegOptions.push(
                '-b:a', '128k',             // Bitrate estándar
                '-compression_level', '10',  // Máxima compresión
                '-application', 'audio',     // Optimizado para audio
                '-frame_duration', '20',     // Duración de frame en ms
                '-packet_loss', '5',         // Tolerancia a pérdida de paquetes
                '-vbr', 'on',                // Bitrate variable
                '-af', 'bass=g=2,dynaudnorm=f=200' // Filtros de audio
            );
        }
        
        ffmpegOptions.push('pipe:1');
        
        const ffmpeg = spawn(ffmpegPath, ffmpegOptions, {
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // Conectar el stream de ytdl-core a la entrada de FFmpeg
        ytStream.pipe(ffmpeg.stdin);
        
        // Conectar la salida de FFmpeg al PassThrough
        ffmpeg.stdout.pipe(passthrough);
        
        // Manejar errores de FFmpeg
        ffmpeg.stderr.on('data', (data) => {
            const message = data.toString().trim();
            // Solo registrar mensajes importantes para reducir ruido en los logs
            if (message.includes('Error') || message.includes('error') || message.includes('Warning') || message.includes('warning')) {
                console.log(`🔧 FFmpeg: ${message}`);
            }
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
            console.error('❌ Error en stream original:', error.message);
            ffmpeg.kill();
            passthrough.destroy(error);
        });
        
        // Manejar eventos de progreso para debugging
        if (isRender) {
            let lastLogTime = Date.now();
            ytStream.on('progress', (chunkLength, downloaded, total) => {
                // Limitar logs a cada 5 segundos para no saturar la consola
                const now = Date.now();
                if (now - lastLogTime > 5000) {
                    const percent = downloaded / total * 100;
                    console.log(`🔄 Progreso de FFmpeg: ${percent.toFixed(2)}% (${(downloaded / 1024 / 1024).toFixed(2)}MB de ${(total / 1024 / 1024).toFixed(2)}MB)`);
                    lastLogTime = now;
                }
            });
        }
        
        // Establecer un timeout para detectar si FFmpeg se queda atascado
        const ffmpegTimeout = setTimeout(() => {
            console.error('⚠️ FFmpeg parece estar atascado (timeout de 30s)...');
            if (isRender) {
                console.log('🔄 Intentando continuar de todos modos...');
            } else {
                console.log('❌ Abortando proceso de FFmpeg...');
                ffmpeg.kill();
                passthrough.destroy(new Error('FFmpeg timeout después de 30 segundos'));
            }
        }, 30000);
        
        // Limpiar el timeout cuando FFmpeg termine correctamente
        ffmpeg.on('close', () => {
            clearTimeout(ffmpegTimeout);
        });
        
        console.log('✅ Stream con FFmpeg creado exitosamente');
        
        // Devolver un objeto similar al que devuelve play.stream()
        return {
            stream: passthrough,
            type: StreamType.Opus
        };
    } catch (error) {
        console.error('❌ Error con ytdl-core + FFmpeg:', error.message);
        
        // Si estamos en Render, intentar una última opción con configuración mínima
        if (isRender) {
            try {
                console.log('🔄 Intentando última opción con configuración mínima...');
                // Intentar crear un stream con configuración mínima como último recurso
                return {
                    stream: ytdl(url, {
                        filter: 'audioonly',
                        quality: 'lowestaudio', // Usar calidad más baja como último recurso
                        highWaterMark: 1 << 24  // Buffer más pequeño
                    }),
                    type: StreamType.Arbitrary // Usar tipo arbitrario que requiere menos procesamiento
                };
            } catch (lastError) {
                console.error('❌ Error en último intento:', lastError.message);
                throw lastError;
            }
        } else {
            throw error;
        }
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
        
        // Extraer el ID del video para usar una URL limpia
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
        console.log('🔍 URL limpia para ytdl-core-discord:', cleanUrl);
        
        // Verificar si podemos obtener información del video primero
        try {
            console.log('🔍 Verificando disponibilidad del video con ytdl-core...');
            const info = await ytdl.getBasicInfo(cleanUrl);
            console.log(`✅ Información básica obtenida: ${info.videoDetails.title}`);
        } catch (infoError) {
            console.error('⚠️ Error al obtener información básica:', infoError.message);
            // Si estamos en Render y hay un error, intentamos con ytdl-core directamente
            if (isRender) {
                console.log('🔄 Saltando ytdl-core-discord en Render debido a error de información, intentando con ytdl-core...');
                return await createStreamWithYtdl(url);
            }
        }
        
        // ytdl-core-discord devuelve directamente un stream Opus compatible con Discord.js
        console.log('🔄 Obteniendo stream Opus con ytdl-core-discord...');
        const stream = await ytdlDiscord(cleanUrl, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25, // ~32MB buffer
            opusEncoded: true,
        });
        
        console.log('✅ Stream Opus obtenido con ytdl-core-discord');
        
        // Verificar que el stream sea válido
        if (!stream) {
            console.error('⚠️ Stream inválido obtenido de ytdl-core-discord');
            throw new Error('Stream inválido obtenido de ytdl-core-discord');
        }
        
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
        
        // Extraer el ID del video para usar una URL limpia
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
        console.log('🔍 URL limpia para ytdl-core:', cleanUrl);
        
        // Obtener información del video primero para verificar disponibilidad
        console.log('🔍 Obteniendo información del video con ytdl-core...');
        const info = await ytdl.getInfo(cleanUrl).catch(err => {
            console.error('❌ Error al obtener información del video:', err.message);
            throw new Error(`No se pudo obtener información del video: ${err.message}`);
        });
        
        console.log(`✅ Información obtenida para: ${info.videoDetails.title}`);
        
        // Crear un PassThrough para mayor estabilidad
        const passthrough = new PassThrough({
            highWaterMark: 1 << 25 // Buffer grande (~32MB)
        });
        
        // Obtener stream con ytdl-core con opciones optimizadas
        console.log('🔄 Descargando audio con ytdl-core...');
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
        
        // Manejar eventos de progreso para debugging
        if (isRender) {
            stream.on('progress', (chunkLength, downloaded, total) => {
                const percent = downloaded / total * 100;
                console.log(`🔄 Progreso de descarga: ${percent.toFixed(2)}% (${(downloaded / 1024 / 1024).toFixed(2)}MB de ${(total / 1024 / 1024).toFixed(2)}MB)`);
            });
        }
        
        // Manejar fin de stream
        stream.on('end', () => {
            console.log('✅ Descarga de audio completada');
        });
        
        console.log('✅ Stream obtenido con ytdl-core');
        
        // Devolver un objeto similar al que devuelve play.stream()
        return {
            stream: passthrough,
            type: StreamType.Arbitrary // ytdl-core no devuelve Opus, necesita FFmpeg
        };
    } catch (error) {
        console.error('❌ Error con ytdl-core:', error.message);
        
        // Si estamos en Render y ytdl-core falla, intentar con FFmpeg como último recurso
        if (isRender) {
            console.log('🔄 Intentando método alternativo con FFmpeg como último recurso...');
            try {
                return await createStreamWithPlayDlAndFfmpeg(url);
            } catch (ffmpegError) {
                console.error('❌ Error con FFmpeg:', ffmpegError.message);
                throw ffmpegError;
            }
        } else {
            throw error;
        }
    }
}

module.exports = {
    createStreamWithPlayDl,
    createStreamWithYtdlDiscord,
    createStreamWithYtdl,
    createStreamWithPlayDlAndFfmpeg,
    createAudioResourceFromUrl
};