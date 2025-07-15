// Cargar variables de entorno (opcional en producción)
try {
    require('dotenv').config();
} catch (error) {
    console.log('📝 Archivo .env no encontrado, usando variables de entorno del sistema');
}

// Diagnóstico de variables de entorno
console.log('🔍 Verificando variables de entorno...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'CONFIGURADO' : 'NO CONFIGURADO');
console.log('SPOTIFY_CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID ? 'CONFIGURADO' : 'NO CONFIGURADO');
console.log('SPOTIFY_CLIENT_SECRET:', process.env.SPOTIFY_CLIENT_SECRET ? 'CONFIGURADO' : 'NO CONFIGURADO');

// Cargar y configurar biblioteca Opus (con fallback a opusscript)
const { loadOpusLibrary, setupOpusForDiscordVoice } = require('./opus-fallback');
loadOpusLibrary();
setupOpusForDiscordVoice();
console.log('🎵 Sistema de audio configurado con soporte para fallback a opusscript');

const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const play = require('play-dl');
const yts = require('youtube-sr').default;
const ytpl = require('ytpl');
const SpotifyWebApi = require('spotify-web-api-node');
const youtubedl = require('youtube-dl-exec');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const ffmpegPath = require('ffmpeg-static');

// Configurar Spotify API
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

// Importar módulos personalizados
const config = require('./config');
const { processCommand, handleControlPanelReaction } = require('./commands');
const { getMusicChannelId, setMusicChannel } = require('./server-config');
const {
    formatDuration,
    createQueueEmbed,
    createNowPlayingEmbed,
    createErrorEmbed,
    createControlPanelEmbed,
    createSongAddedEmbed,
    createPlaylistAddedEmbed,
    createAlbumAddedEmbed,
    createArtistAddedEmbed,
    createSpotifySongAddedEmbed,
    createYouTubeSongAddedEmbed,
    createYouTubeArtistAddedEmbed,
    createRadioModeEmbed,
    extractSongTitle,
    isSpotifyUrl,
    isYouTubeUrl,
    isSpotifyPlaylistUrl,
    isYouTubePlaylistUrl,
    isSpotifyAlbumUrl,
    isSpotifyArtistUrl,
    isYouTubeSongUrl,
    isYouTubeArtistUrl,
    extractSpotifyTrackId,
    extractSpotifyPlaylistId,
    extractYouTubePlaylistId,
    extractSpotifyAlbumId,
    extractSpotifyArtistId,
    extractYouTubeChannelId,
    cleanSearchText
} = require('./utils');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildIntegrations
    ],
    // Configuración específica para Render (optimizada)
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
    },
    // Configuraciones de caché más simples para evitar warnings
    makeCache: require('discord.js').Options.cacheWithLimits({
        MessageManager: {
            maxSize: 50,
            keepOverLimit: item => item.author.id === client.user.id
        },
        GuildManager: {
            maxSize: 50
        },
        UserManager: {
            maxSize: 50
        }
    }),
    // Configuración de presence simple
    presence: {
        status: 'online',
        activities: [{
            name: 'música en Render 🎵',
            type: 2
        }]
    }
});

// Configuración de Spotify
console.log('🎵 Configurando Spotify API...');

// Configurar play-dl
(async () => {
    try {
        // Establecer cookies de YouTube (opcional pero recomendado)
        await play.setToken({
            youtube: {
                cookie: process.env.YOUTUBE_COOKIE || ''
            }
        });
        console.log('🎵 Play-dl configurado correctamente');
    } catch (error) {
        console.log('⚠️  Play-dl: usando configuración por defecto');
    }
})();

// Verificar que las credenciales de Spotify estén configuradas
if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.log('⚠️  Advertencia: Credenciales de Spotify no configuradas');
    console.log('   El bot funcionará solo con YouTube');
}

// Estado del bot
const botState = {
    connection: null,
    player: null,
    queue: [],
    isPlaying: false,
    isPaused: false,
    currentSong: null,
    musicChannels: new Map(), // Almacenar canales de música por servidor
    controlPanelMessages: new Map(), // Almacenar mensajes del panel por servidor
    radioMode: {
        enabled: false,
        lastSong: null,
        isSearching: false,
        songsHistory: [] // Historial de canciones para evitar repetir
    }
};

// Función para obtener token de Spotify
async function getSpotifyToken() {
    try {
        console.log('🔑 Obteniendo token de Spotify...');
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body['access_token']);
        console.log(config.messages.spotifyTokenObtained);
    } catch (error) {
        console.error('❌ Error obteniendo token de Spotify:', error.message);
        console.error('🔍 Verifica que SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET estén configurados correctamente');
    }
}

// Función para buscar en Spotify
async function searchSpotify(query) {
    try {
        const results = await spotifyApi.searchTracks(query, { limit: config.spotify.searchLimit });
        if (results.body.tracks.items.length > 0) {
            const track = results.body.tracks.items[0];
            return {
                title: track.name,
                artist: track.artists[0].name,
                duration: Math.floor(track.duration_ms / 1000),
                thumbnail: track.album.images[0]?.url || null,
                searchQuery: `${track.name} ${track.artists[0].name}`
            };
        }
        return null;
    } catch (error) {
        console.error('Error al buscar en Spotify:', error);
        return null;
    }
}

// Función para obtener información de una canción de Spotify por ID
async function getSpotifyTrackById(trackId) {
    try {
        const track = await spotifyApi.getTrack(trackId);
        if (track.body) {
            console.log(`Canción encontrada en Spotify: ${track.body.name} por ${track.body.artists[0].name}`);
            return {
                title: track.body.name,
                artist: track.body.artists[0].name,
                duration: Math.floor(track.body.duration_ms / 1000),
                thumbnail: track.body.album.images[0]?.url || null,
                searchQuery: `${track.body.name} ${track.body.artists[0].name}`
            };
        }
        return null;
    } catch (error) {
        console.error('Error al obtener información de Spotify:', error);
        return null;
    }
}

// Función para buscar en YouTube
async function searchYouTube(query, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Buscando en YouTube: "${query}" (intento ${attempt}/${retries})`);
            
            // Añadir un pequeño delay entre intentos
            if (attempt > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
            
            const results = await yts.search(query, { limit: config.audio.searchLimit });
            
            if (results.length > 0) {
                // Buscar el mejor resultado (priorizando resultados oficiales)
                let bestResult = results[0];
                
                for (const video of results) {
                    // Verificar que el video tenga URL válida
                    if (!video.url || !video.id) continue;
                    
                    // Priorizar videos con cierta duración (no muy cortos ni muy largos)
                    if (video.duration && video.duration > 30 && video.duration < 600) {
                        // Priorizar resultados que contengan palabras clave musicales
                        const title = video.title.toLowerCase();
                        if (title.includes('official') || title.includes('music video') || 
                            title.includes('lyric') || title.includes('audio')) {
                            bestResult = video;
                            break;
                        }
                    }
                }
                
                const video = bestResult;
                console.log(`Resultado encontrado: ${video.title} - ${video.channel?.name}`);
                
                // Verificar que la URL sea válida antes de devolverla
                if (video.url && video.id) {
                    // Asegurar URL válida de YouTube
                    let validUrl = video.url;
                    
                    // Si no tiene URL válida, construir una con el ID
                    if (!validUrl || validUrl === 'undefined') {
                        validUrl = `https://www.youtube.com/watch?v=${video.id}`;
                    }
                    
                    // Validar con play-dl
                    const urlType = play.yt_validate(validUrl);
                    if (urlType === 'video') {
                        // Convertir duración a segundos si viene en formato de tiempo
                        let durationInSeconds = video.duration;
                        
                        if (typeof video.duration === 'string') {
                            // Si viene en formato mm:ss o hh:mm:ss
                            const timeParts = video.duration.split(':').map(Number);
                            if (timeParts.length === 2) {
                                durationInSeconds = timeParts[0] * 60 + timeParts[1];
                            } else if (timeParts.length === 3) {
                                durationInSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
                            }
                        } else if (typeof video.duration === 'number') {
                            // Si es número, verificar si está en milisegundos
                            if (video.duration > 10000) {
                                // Probablemente esté en milisegundos
                                durationInSeconds = Math.floor(video.duration / 1000);
                            } else {
                                durationInSeconds = video.duration;
                            }
                        }
                        
                        // Validar que todos los campos sean válidos antes de devolver
                        const songData = {
                            title: video.title || 'Título desconocido',
                            url: validUrl,
                            duration: durationInSeconds || 0,
                            thumbnail: video.thumbnail?.url || null,
                            channel: video.channel?.name || 'Desconocido'
                        };
                        
                        console.log('Datos de la canción validados:', {
                            title: songData.title,
                            url: songData.url,
                            duration: songData.duration,
                            hasValidUrl: !!songData.url && songData.url !== 'undefined'
                        });
                        
                        return songData;
                    }
                }
            }
            
            console.log('No se encontraron resultados válidos en YouTube');
            return null;
        } catch (error) {
            console.error(`Error al buscar en YouTube (intento ${attempt}/${retries}):`, error.message);
            
            // Si es el último intento, devolver null
            if (attempt === retries) {
                console.error('Se agotaron los intentos de búsqueda en YouTube');
                return null;
            }
            
            // Si es un error de red, esperar más tiempo antes del siguiente intento
            if (error.message.includes('fetch failed') || error.message.includes('redirect count exceeded')) {
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }
    
    return null;
}

// Función para obtener una playlist de YouTube
async function getYouTubePlaylist(playlistId) {
    try {
        console.log(`Obteniendo playlist de YouTube: ${playlistId}`);
        
        // Usar youtube-sr para obtener información básica de la playlist
        const playlistInfo = await yts.getPlaylist(playlistId);
        
        if (playlistInfo && playlistInfo.videos) {
            console.log(`Playlist encontrada en YouTube: ${playlistInfo.title} (${playlistInfo.videos.length} videos)`);
            
            // Limitar a 50 canciones para evitar sobrecarga
            const videos = playlistInfo.videos.slice(0, 50);
            
            const tracks = videos
                .filter(video => video && video.title && video.url)
                .map(video => {
                    let durationInSeconds = 0;
                    
                    if (video.duration) {
                        if (typeof video.duration === 'string') {
                            const timeParts = video.duration.split(':').map(Number);
                            if (timeParts.length === 2) {
                                durationInSeconds = timeParts[0] * 60 + timeParts[1];
                            } else if (timeParts.length === 3) {
                                durationInSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
                            }
                        } else if (typeof video.duration === 'number') {
                            durationInSeconds = video.duration > 10000 ? Math.floor(video.duration / 1000) : video.duration;
                        }
                    }
                    
                    return {
                        title: video.title,
                        url: video.url,
                        duration: durationInSeconds,
                        thumbnail: video.thumbnail?.url || null,
                        channel: video.channel?.name || 'Desconocido',
                        source: 'YouTube Playlist'
                    };
                });
            
            return {
                name: playlistInfo.title,
                description: playlistInfo.description || '',
                trackCount: tracks.length,
                tracks: tracks
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error al obtener playlist de YouTube:', error);
        return null;
    }
}

// Función para reproducir música
async function playMusic(voiceChannel, textChannel) {
    const { queue } = botState;
    
    if (queue.length === 0) {
        botState.isPlaying = false;
        botState.currentSong = null;
        botState.isPaused = false;
        await updateControlPanel(voiceChannel.guild.id);
        return;
    }

    const song = queue[0];
    botState.isPlaying = true;

    try {
        // Conectar al canal de voz si no está conectado
        if (!botState.connection) {
            botState.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });
        }

        // Crear el reproductor si no existe o si fue detenido
        if (!botState.player || botState.player.state.status === 'destroyed') {
            // Destruir el reproductor anterior si existe
            if (botState.player) {
                try {
                    botState.player.stop();
                    botState.player.removeAllListeners();
                } catch (error) {
                    console.log('Error al limpiar reproductor anterior:', error.message);
                }
            }
            
            botState.player = createAudioPlayer({
                behaviors: {
                    noSubscriber: 'pause',
                    maxMissedFrames: Math.round(config.audio.maxMissedFrames || 5)
                }
            });
            botState.connection.subscribe(botState.player);
            
            // Configurar eventos del reproductor una sola vez
            botState.player.on(AudioPlayerStatus.Idle, async () => {
                console.log('Canción terminada, reproduciendo siguiente...');
                
                // Actualizar el estado del modo radio con la canción terminada
                if (botState.radioMode.enabled && botState.currentSong) {
                    botState.radioMode.lastSong = botState.currentSong;
                }
                
                botState.queue.shift(); // Remover la canción actual de la cola
                if (botState.queue.length > 0) {
                    await playMusic(voiceChannel, textChannel); // Reproducir la siguiente canción
                } else {
                    botState.isPlaying = false;
                    botState.currentSong = null;
                    botState.isPaused = false;
                    await updateControlPanel(voiceChannel.guild.id);
                }
            });

            botState.player.on('error', async (error) => {
                console.error('Error en el reproductor:', error);
                botState.queue.shift();
                if (botState.queue.length > 0) {
                    await playMusic(voiceChannel, textChannel);
                } else {
                    botState.isPlaying = false;
                    botState.currentSong = null;
                    botState.isPaused = false;
                    await updateControlPanel(voiceChannel.guild.id);
                }
            });
        }

        // Resolver la canción si no tiene URL de YouTube
        let resolvedSong = song;
        if (!song.url) {
            console.log(`Resolviendo canción: ${song.title}`);
            
            // Buscar en YouTube según el tipo de canción
            let searchQuery = '';
            if (song.platform === 'spotify') {
                searchQuery = `${song.title} ${song.artist || ''}`;
            } else {
                searchQuery = song.title;
            }
            
            const youtubeResult = await searchYouTube(searchQuery);
            if (youtubeResult && youtubeResult.url) {
                resolvedSong = {
                    ...song,
                    url: youtubeResult.url,
                    duration: youtubeResult.duration || song.duration,
                    thumbnail: youtubeResult.thumbnail || song.thumbnail,
                    channel: youtubeResult.channel
                };
                
                // Actualizar la canción en la cola
                botState.queue[0] = resolvedSong;
            } else {
                console.error(`No se pudo resolver la canción: ${song.title}`);
                botState.queue.shift();
                if (botState.queue.length > 0) {
                    return playMusic(voiceChannel, textChannel);
                }
                return;
            }
        }

        botState.currentSong = resolvedSong;

        // Crear el recurso de audio con play-dl (optimizado para Render)
        let stream;
        try {
            console.log(`Creando stream para: ${resolvedSong.title}`);
            console.log(`URL a usar: ${resolvedSong.url}`);
            console.log(`Tipo de URL: ${typeof resolvedSong.url}`);
            console.log(`URL válida: ${resolvedSong.url !== undefined && resolvedSong.url !== 'undefined'}`);
            
            // Validar la URL antes de crear el stream
            if (!resolvedSong.url || resolvedSong.url === 'undefined' || resolvedSong.url === undefined) {
                throw new Error(`URL inválida: ${resolvedSong.url}`);
            }
            
            // Asegurar que la URL sea string y esté bien formateada
            const urlString = String(resolvedSong.url).trim();
            console.log(`URL como string: ${urlString}`);
            
            // Importar la implementación optimizada para Render
            const { createStreamWithPlayDl, createStreamWithPlayDlAndFfmpeg } = require('./play-dl-stream');
            
            // Intentar crear stream con play-dl (optimizado para Render)
            console.log('🎵 Usando play-dl como método principal (optimizado para Render)...');
            
            try {
                // Intentar primero con play-dl directo
                stream = await createStreamWithPlayDl(urlString);
                console.log('✅ Stream creado exitosamente con play-dl');
            } catch (error) {
                console.log('⚠️ Error con play-dl directo, intentando con FFmpeg:', error.message);
                
                try {
                    // Intentar con play-dl + FFmpeg como fallback
                    stream = await createStreamWithPlayDlAndFfmpeg(urlString);
                    console.log('✅ Stream creado exitosamente con play-dl + FFmpeg');
                } catch (fallbackError) {
                    console.error('❌ Error creando stream con todos los métodos:', fallbackError.message);
                    botState.queue.shift();
                    if (botState.queue.length > 0) {
                        return playMusic(voiceChannel, textChannel);
                    }
                    return;
                }
            }
            
            console.log('Stream obtenido exitosamente');
            
            // Verificar si stream es un objeto con propiedad stream (formato {stream, type})
            if (stream && typeof stream === 'object' && stream.stream) {
                // Mejorar el manejo del stream para evitar entrecortado
                stream.stream.on('error', (error) => {
                    console.error('Error en el stream:', error);
                });
                
                // Reducir el tiempo de espera para el stream
                await new Promise((resolve, reject) => {
                    stream.stream.once('readable', resolve);
                    stream.stream.once('error', reject);
                    setTimeout(() => reject(new Error('Stream timeout')), 5000); // Reducido de 10s a 5s
                });
            } else {
                console.log('⚠️ El stream no tiene el formato esperado {stream, type}');
            }
            
        } catch (streamError) {
            console.error('Error al crear el stream:', streamError);
            botState.queue.shift();
            if (botState.queue.length > 0) {
                return playMusic(voiceChannel, textChannel);
            }
            return;
        }

        // Usar la función de creación de recurso de audio optimizada para Render
        let resource;
        try {
            const { createAudioResourceFromUrl } = require('./play-dl-stream');
            resource = await createAudioResourceFromUrl(urlString);
            console.log('✅ Recurso de audio creado con configuración optimizada para Render');
        } catch (resourceError) {
            // Fallback a la creación de recurso tradicional
            console.log('⚠️ Usando método alternativo para crear recurso de audio');
            
            // Verificar si stream es un objeto con propiedad stream (formato {stream, type})
            if (stream && typeof stream === 'object' && stream.stream) {
                resource = createAudioResource(stream.stream, {
                    inputType: stream.type || StreamType.OggOpus,
                    inlineVolume: true,
                    silencePaddingFrames: 3 // Reducir padding para menos latencia
                });
            } else {
                // Si es un stream directo
                resource = createAudioResource(stream, {
                    inputType: StreamType.OggOpus, // Usar OggOpus para mejor compatibilidad con Render
                    inlineVolume: true,
                    silencePaddingFrames: 3 // Reducir padding para menos latencia
                });
            }
        }

        // Establecer volumen por defecto más bajo para evitar distorsión
        resource.volume?.setVolume(0.3);

        // Reproducir la canción
        console.log(`Reproduciendo: ${resolvedSong.title}`);
        botState.player.play(resource);
        botState.isPlaying = true;
        botState.isPaused = false;
        botState.currentSong = resolvedSong;

        // Actualizar el panel de control
        await updateControlPanel(voiceChannel.guild.id);

        // Activar modo radio si está habilitado y la cola está baja
        if (config.radio.enabled && botState.radioMode.enabled && botState.queue.length <= config.radio.minQueueSize) {
            console.log('🔄 Activando modo radio automático...');
            await activateRadioMode(voiceChannel, textChannel);
        }

        // No enviar mensaje temporal de "reproduciendo ahora" para mantener el canal limpio
        // El usuario puede ver la información en el panel de control

    } catch (error) {
        console.error('Error al reproducir música:', error);
        botState.queue.shift();
        if (botState.queue.length > 0) {
            playMusic(voiceChannel, textChannel);
        } else {
            botState.isPlaying = false;
            botState.currentSong = null;
        }
    }
}

// Función para procesar el mensaje
async function processMessage(message) {
    const content = cleanSearchText(message.content);
    
    // Ignorar mensajes vacíos
    if (!content) return;

    // Verificar límite de cola
    if (botState.queue.length >= config.audio.maxQueueSize) {
        const embed = createErrorEmbed(`${config.messages.queueFull} ${config.audio.maxQueueSize}`);
        return message.reply({ embeds: [embed] });
    }

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
        message.react(config.bot.reactions.error);
        return message.reply(config.messages.notInVoiceChannel);
    }

    try {
        // ===== PASO 1: DETECTAR SI ES URL O TEXTO =====
        
        const isURL = content.includes('http://') || content.includes('https://') || content.includes('www.') || content.includes('youtube.com') || content.includes('youtu.be') || content.includes('spotify.com') || content.includes('open.spotify.com');
        
        if (!isURL) {
            // ===== ES TEXTO - BUSCAR EN YOUTUBE =====
            console.log(`� Búsqueda por texto: "${content}"`);
            
            const songInfo = await searchYouTube(content);
            
            if (songInfo) {
                songInfo.source = 'YouTube (búsqueda)';
                
                // Agregar a la cola
                botState.queue.push(songInfo);
                
                // Enviar mensaje temporal de confirmación
                const tempEmbed = createYouTubeSongAddedEmbed(
                    songInfo.title, 
                    songInfo.channel, 
                    botState.queue.length
                );
                const tempMessage = await message.channel.send({ embeds: [tempEmbed] });
                
                // Eliminar mensajes después de 2 segundos
                setTimeout(async () => {
                    try {
                        await tempMessage.delete();
                        await message.delete();
                    } catch (error) {
                        console.log('No se pudo eliminar los mensajes:', error.message);
                    }
                }, 2000);
                
                // Actualizar panel de control
                await updateControlPanel(message.guild.id);
                
                // Reproducir si no está reproduciendo
                if (!botState.isPlaying) {
                    playMusic(voiceChannel, message.channel);
                }
                
                return;
            } else {
                const embed = createErrorEmbed('❌ No se encontraron resultados para la búsqueda.');
                const errorMessage = await message.channel.send({ embeds: [embed] });
                
                setTimeout(async () => {
                    try {
                        await errorMessage.delete();
                        await message.delete();
                    } catch (error) {
                        console.log('No se pudo eliminar los mensajes:', error.message);
                    }
                }, 3000);
                
                return;
            }
        }
        
        // ===== PASO 2: ES URL - DETERMINAR PLATAFORMA =====
        
        let platform = '';
        
        if (content.includes('youtube.com') || content.includes('youtu.be') || content.includes('music.youtube.com')) {
            platform = 'youtube';
        } else if (content.includes('spotify.com') || content.includes('open.spotify.com')) {
            platform = 'spotify';
        } else {
            const embed = createErrorEmbed('❌ Plataforma no soportada. Solo se admiten URLs de YouTube y Spotify.');
            const errorMessage = await message.channel.send({ embeds: [embed] });
            
            setTimeout(async () => {
                try {
                    await errorMessage.delete();
                    await message.delete();
                } catch (error) {
                    console.log('No se pudo eliminar los mensajes:', error.message);
                }
            }, 3000);
            
            return;
        }
        
        // ===== PASO 3: DETERMINAR TIPO DE CONTENIDO =====
        
        let contentType = '';
        
        if (platform === 'youtube') {
            if (isYouTubePlaylistUrl(content)) {
                contentType = 'playlist';
            } else if (isYouTubeArtistUrl(content)) {
                contentType = 'artist';
            } else if (isYouTubeSongUrl(content)) {
                contentType = 'song';
            } else {
                contentType = 'unknown';
            }
        } else if (platform === 'spotify') {
            if (isSpotifyPlaylistUrl(content)) {
                contentType = 'playlist';
            } else if (isSpotifyAlbumUrl(content)) {
                contentType = 'album';
            } else if (isSpotifyArtistUrl(content)) {
                contentType = 'artist';
            } else if (isSpotifyUrl(content)) {
                contentType = 'song';
            } else {
                contentType = 'unknown';
            }
        }
        
        // ===== PASO 4: PROCESAR SEGÚN PLATAFORMA Y TIPO =====
        
        console.log(`🎵 Detectado: ${platform.toUpperCase()} - ${contentType.toUpperCase()}`);
        
        if (platform === 'youtube') {
            switch (contentType) {
                case 'song':
                    console.log(`🎵 Canción de YouTube: ${content}`);
                    await processYouTubeTrack(content, message, voiceChannel);
                    break;
                    
                case 'playlist':
                    console.log(`� Playlist de YouTube: ${content}`);
                    const playlistId = extractYouTubePlaylistId(content);
                    if (playlistId) {
                        await processYouTubePlaylist(playlistId, message, voiceChannel);
                    }
                    break;
                    
                case 'artist':
                    console.log(`🎤 Canal de YouTube: ${content}`);
                    const channelId = extractYouTubeChannelId(content);
                    if (channelId) {
                        await processYouTubeChannel(channelId, message, voiceChannel);
                    }
                    break;
                    
                default:
                    const embed = createErrorEmbed('❌ Tipo de contenido de YouTube no reconocido.');
                    const errorMessage = await message.channel.send({ embeds: [embed] });
                    
                    setTimeout(async () => {
                        try {
                            await errorMessage.delete();
                            await message.delete();
                        } catch (error) {
                            console.log('No se pudo eliminar los mensajes:', error.message);
                        }
                    }, 3000);
                    break;
            }
        } else if (platform === 'spotify') {
            switch (contentType) {
                case 'song':
                    console.log(`🎵 Canción de Spotify: ${content}`);
                    const trackId = extractSpotifyTrackId(content);
                    if (trackId) {
                        await processSpotifyTrack(trackId, message, voiceChannel);
                    }
                    break;
                    
                case 'playlist':
                    console.log(`📋 Playlist de Spotify: ${content}`);
                    const playlistId = extractSpotifyPlaylistId(content);
                    if (playlistId) {
                        await processSpotifyPlaylist(playlistId, message, voiceChannel);
                    }
                    break;
                    
                case 'album':
                    console.log(`💿 Álbum de Spotify: ${content}`);
                    const albumId = extractSpotifyAlbumId(content);
                    if (albumId) {
                        await processSpotifyAlbum(albumId, message, voiceChannel);
                    }
                    break;
                    
                case 'artist':
                    console.log(`🎤 Artista de Spotify: ${content}`);
                    const artistId = extractSpotifyArtistId(content);
                    if (artistId) {
                        await processSpotifyArtist(artistId, message, voiceChannel);
                    }
                    break;
                    
                default:
                    const embed = createErrorEmbed('❌ Tipo de contenido de Spotify no reconocido.');
                    const errorMessage = await message.channel.send({ embeds: [embed] });
                    
                    setTimeout(async () => {
                        try {
                            await errorMessage.delete();
                            await message.delete();
                        } catch (error) {
                            console.log('No se pudo eliminar los mensajes:', error.message);
                        }
                    }, 3000);
                    break;
            }
        }

    } catch (error) {
        console.error('Error al procesar mensaje:', error);
        message.react(config.bot.reactions.error);
        const embed = createErrorEmbed('❌ Error al procesar el contenido solicitado.');
        message.reply({ embeds: [embed] });
    }
    
    // Eliminar el mensaje del usuario al final
    try {
        await message.delete();
    } catch (error) {
        console.log('No se pudo eliminar el mensaje del usuario:', error.message);
    }
}

/**
 * Limpia todos los mensajes del canal excepto el panel de control
 * @param {TextChannel} channel - Canal a limpiar
 * @param {string} guildId - ID del servidor
 */
async function cleanChannel(channel, guildId) {
    try {
        const controlPanelMessage = botState.controlPanelMessages.get(guildId);
        
        if (channel.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            const messages = await channel.messages.fetch({ limit: 100 });
            
            for (const message of messages.values()) {
                // No eliminar el panel de control
                if (controlPanelMessage && message.id === controlPanelMessage.id) {
                    continue;
                }
                
                try {
                    await message.delete();
                } catch (error) {
                    // Ignorar errores de mensajes ya eliminados
                    if (error.code !== 10008) {
                        console.error('Error al eliminar mensaje:', error);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error al limpiar canal:', error);
    }
}

/**
 * Actualiza el panel de control persistente
 * @param {string} guildId - ID del servidor
 */
async function updateControlPanel(guildId) {
    const controlPanelMessage = botState.controlPanelMessages.get(guildId);
    const musicChannel = botState.musicChannels.get(guildId);
    
    if (!controlPanelMessage || !musicChannel) return;
    
    try {
        const embed = createControlPanelEmbed(botState);
        await controlPanelMessage.edit({ embeds: [embed] });
    } catch (error) {
        console.error('Error al actualizar panel de control:', error);
        // Si el mensaje fue eliminado, crear uno nuevo
        await createControlPanel(guildId);
    }
}

/**
 * Crea el panel de control persistente para un servidor
 * @param {string} guildId - ID del servidor
 */
async function createControlPanel(guildId) {
    const musicChannel = botState.musicChannels.get(guildId);
    if (!musicChannel) return;
    
    try {
        // Limpiar el canal antes de crear el panel
        await cleanChannel(musicChannel, guildId);
        
        const embed = createControlPanelEmbed(botState);
        const message = await musicChannel.send({ embeds: [embed] });
        
        // Agregar reacciones para el control
        const reactions = ['⏸️', '⏹️', '⏭️', '📋', '🔄', '🔀', '🗑️', '📻'];
        for (const reaction of reactions) {
            await message.react(reaction);
        }
        
        botState.controlPanelMessages.set(guildId, message);
        console.log(`Panel de control creado exitosamente para el servidor ${guildId}`);
    } catch (error) {
        console.error('Error al crear panel de control:', error);
    }
}

/**
 * Envía un mensaje temporal que se elimina automáticamente
 * @param {TextChannel} channel - Canal donde enviar el mensaje
 * @param {Object} content - Contenido del mensaje (embed, texto, etc.)
 * @param {number} deleteAfter - Tiempo en milisegundos antes de eliminar (por defecto 5000ms)
 */
// Eventos del bot
client.on('ready', async () => {
    console.log(`${config.messages.botConnected} ${client.user.tag}`);
    console.log('🎮 Bot listo y conectado a Discord');
    
    // Pequeño retraso para asegurar que todo esté completamente inicializado
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Registrar comandos slash (ahora que el bot está listo)
    await registerSlashCommands();
    
    // Obtener token de Spotify
    await getSpotifyToken();
    
    // Renovar token cada 50 minutos
    setInterval(getSpotifyToken, config.spotify.tokenRefreshInterval);
    
    // Cargar configuraciones existentes de servidores
    console.log('📁 Cargando configuraciones de servidores...');
    for (const guild of client.guilds.cache.values()) {
        const musicChannelId = getMusicChannelId(guild.id);
        if (musicChannelId) {
            const channel = guild.channels.cache.get(musicChannelId);
            if (channel) {
                botState.musicChannels.set(guild.id, channel);
                console.log(`Canal de música cargado para ${guild.name}: ${channel.name}`);
                
                // Crear panel de control si no existe
                await createControlPanel(guild.id);
            }
        }
    }
    
    console.log('Bot listo. Usa /setup para configurar el canal de música en cada servidor.');
});

// Evento para manejar mensajes
client.on('messageCreate', async (message) => {
    // Ignorar mensajes del bot
    if (message.author.bot) return;
    
    // Verificar si el canal está configurado para este servidor
    const musicChannelId = getMusicChannelId(message.guild.id);
    if (!musicChannelId || message.channel.id !== musicChannelId) {
        return;
    }
    
    // Procesar comandos especiales
    if (processCommand(message, botState)) {
        return;
    }
    
    // Procesar como búsqueda de música
    await processMessage(message);
});

// Evento para manejar reacciones en el panel de control
client.on('messageReactionAdd', async (reaction, user) => {
    // Verificar si es una reacción en el panel de control
    const controlPanelMessage = botState.controlPanelMessages.get(reaction.message.guild.id);
    if (controlPanelMessage && reaction.message.id === controlPanelMessage.id) {
        await handleControlPanelReaction(reaction, user, botState, (guildId) => updateControlPanel(guildId));
    }
});

// Evento para manejar comandos de aplicación (slash commands)
client.on('interactionCreate', async (interaction) => {
    console.log('🔧 Interacción recibida:', {
        type: interaction.type,
        commandName: interaction.commandName,
        user: interaction.user.tag,
        guild: interaction.guild?.name || 'DM'
    });
    
    if (!interaction.isChatInputCommand()) {
        console.log('⚠️ No es un comando de chat input');
        return;
    }
    
    if (interaction.commandName === 'setup') {
        console.log('✅ Comando /setup recibido');
        const channel = interaction.options.getChannel('canal');
        console.log('📋 Canal seleccionado:', channel?.name);
        
        // Responder inmediatamente para evitar timeout
        try {
            await interaction.reply({
                content: '⏳ Configurando canal de música...',
                ephemeral: true
            });
            console.log('✅ Respuesta inicial enviada');
        } catch (error) {
            console.error('❌ Error al enviar respuesta inicial:', error);
            return;
        }
        
        try {
            // Verificar que el usuario tenga permisos de administrador
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await interaction.editReply({
                    content: '❌ Necesitas permisos de administrador para usar este comando.'
                });
                return;
            }
            
            // Verificar que el canal sea de texto
            if (channel.type !== 0) {
                await interaction.editReply({
                    content: '❌ El canal debe ser un canal de texto.'
                });
                return;
            }
            
            // Verificar permisos del bot en el canal
            const permissions = channel.permissionsFor(interaction.guild.members.me);
            if (!permissions.has(PermissionsBitField.Flags.SendMessages) || 
                !permissions.has(PermissionsBitField.Flags.ManageMessages) ||
                !permissions.has(PermissionsBitField.Flags.AddReactions)) {
                await interaction.editReply({
                    content: '❌ El bot necesita permisos de "Enviar mensajes", "Gestionar mensajes" y "Agregar reacciones" en ese canal.'
                });
                return;
            }
            
            // Configurar el canal de música
            setMusicChannel(interaction.guild.id, channel.id);
            botState.musicChannels.set(interaction.guild.id, channel);
            console.log('✅ Canal configurado:', channel.name);
            
            // Crear el panel de control en el nuevo canal
            await createControlPanel(interaction.guild.id);
            console.log('✅ Panel de control creado');
            
            await interaction.editReply({
                content: `✅ Canal de música configurado correctamente en ${channel}.\n\n` +
                         `**Instrucciones:**\n` +
                         `• Escribe el nombre de una canción o pega una URL de YouTube/Spotify\n` +
                         `• Usa los emojis del panel de control para controlar la música\n` +
                         `• Todos los mensajes se eliminarán automáticamente para mantener el canal limpio`
            });
            
            console.log('✅ Configuración completada exitosamente');
            
        } catch (error) {
            console.error('❌ Error en comando /setup:', error);
            console.error('🔍 Stack trace:', error.stack);
            try {
                await interaction.editReply({
                    content: '❌ Ocurrió un error al configurar el canal. Inténtalo de nuevo.'
                });
            } catch (editError) {
                console.error('❌ Error al editar respuesta:', editError);
            }
        }
    }
    
    // Comando de prueba
    if (interaction.commandName === 'ping') {
        console.log('✅ Comando /ping recibido');
        await interaction.reply({
            content: '🏓 ¡Pong! El bot está funcionando correctamente.',
            ephemeral: true
        });
    }
});

// Función para registrar comandos slash
async function registerSlashCommands() {
    const commands = [
        {
            name: 'setup',
            description: 'Configura el canal de música del bot',
            options: [
                {
                    name: 'canal',
                    description: 'Canal donde el bot recibirá las canciones',
                    type: 7, // CHANNEL type
                    required: true,
                    channel_types: [0] // TEXT channel only
                }
            ]
        },
        {
            name: 'ping',
            description: 'Verifica que el bot esté funcionando'
        }
    ];

    const { REST, Routes } = require('discord.js');
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('🔧 Registrando comandos slash...');
        console.log('📋 Cliente ID:', client.user.id);
        console.log('🎮 Usuario del bot:', client.user.tag);
        
        // Intentar registrar tanto globalmente como localmente
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        
        console.log('✅ Comandos slash registrados exitosamente');
        
        // Verificar que los comandos se registraron
        const registeredCommands = await rest.get(Routes.applicationCommands(client.user.id));
        console.log('📋 Comandos registrados:', registeredCommands.length);
        
    } catch (error) {
        console.error('❌ Error al registrar comandos slash:', error);
        console.error('🔍 Detalles del error:', error.message);
    }
}

// Iniciar sesión del bot
console.log('🔐 Iniciando sesión del bot...');
if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN no está configurado');
    process.exit(1);
}

console.log('🔐 Token configurado, intentando conectar...');

// Verificar formato del token
const token = process.env.DISCORD_TOKEN;
if (!token.includes('.') || token.split('.').length !== 3) {
    console.error('❌ Token de Discord tiene formato inválido');
    console.error('🔍 El token debe tener el formato: MTxxxxxxxxx.xxxxxx.xxxxxxxxxxx');
    process.exit(1);
}

console.log('✅ Token tiene formato válido');

// Agregar más logging específico
console.log('🔌 Intentando conectar a Discord...');
console.log('🔑 Token empieza con:', process.env.DISCORD_TOKEN.substring(0, 20) + '...');

// Timeout para el evento ready (aumentado para Render)
setTimeout(() => {
    if (!client.user) {
        console.error('❌ Timeout: El bot no se conectó en 60 segundos');
        console.error('🔍 Posibles causas:');
        console.error('   - Token inválido o revocado');
        console.error('   - Problemas de conectividad de Render');
        console.error('   - Bot deshabilitado en Discord Developer Portal');
        console.error('   - Intents incorrectos');
        console.error('   - Problemas de websockets en Render');
        process.exit(1);
    }
}, 60000); // Aumentado a 60 segundos

// Configuración específica para Render si está disponible
if (process.env.NODE_ENV === 'production') {
    console.log('🔧 Configuraciones de Render aplicadas');
}

// Hacer el client globalmente accesible para keep-alive
global.client = client;

// Agregar listeners para debugging detallado
client.on('debug', (info) => {
    if (info.includes('Sending a heartbeat') || info.includes('Heartbeat acknowledged')) {
        // Silenciar heartbeats para no spam
        return;
    }
    console.log('🔧 DEBUG:', info);
});

client.on('warn', (warning) => {
    console.log('⚠️ WARNING:', warning);
});

client.on('error', (error) => {
    console.error('❌ CLIENT ERROR:', error);
    if (process.env.NODE_ENV === 'production') {
        const { addError } = require('./render-health');
        addError(error);
    }
});

client.on('disconnect', (closeEvent) => {
    console.log('🔌 DISCONNECT:', closeEvent);
    if (process.env.NODE_ENV === 'production') {
        const { setBotStatus } = require('./render-health');
        setBotStatus({ connected: false, ready: false });
    }
});

client.on('reconnecting', () => {
    console.log('🔄 RECONNECTING...');
});

client.on('resumed', () => {
    console.log('✅ RESUMED connection');
});

client.on('shardDisconnect', (closeEvent, shardId) => {
    console.log(`🔌 SHARD ${shardId} DISCONNECT:`, closeEvent);
});

client.on('shardReconnecting', (shardId) => {
    console.log(`🔄 SHARD ${shardId} RECONNECTING...`);
});

client.on('shardResumed', (shardId) => {
    console.log(`✅ SHARD ${shardId} RESUMED`);
});

client.on('shardError', (error, shardId) => {
    console.error(`❌ SHARD ${shardId} ERROR:`, error);
});

client.on('shardReady', (shardId) => {
    console.log(`✅ SHARD ${shardId} READY`);
});

// Función para conectar con estrategia específica para Render
async function connectToDiscord(retries = 3) {
    console.log(`🔌 Intento de conexión ${4 - retries}/3...`);
    
    try {
        // Iniciar keep-alive ANTES del login en producción
        if (process.env.NODE_ENV === 'production' && retries === 3) {
            console.log('🌐 Iniciando servidor de salud para Render...');
            const { setBotStatus, addError } = require('./render-health');
            
            // Configurar callbacks para actualizar el estado
            client.on('ready', () => {
                console.log('🎯 Bot READY - Actualizando estado en health server');
                setBotStatus({ connected: true, ready: true });
            });
            
            client.on('disconnect', (closeEvent) => {
                console.log('🔌 Bot DISCONNECT - Actualizando estado:', closeEvent);
                setBotStatus({ connected: false, ready: false });
            });
            
            client.on('error', (error) => {
                console.log('❌ Bot ERROR - Registrando en health server:', error.message);
                addError(error);
            });
        }
        
        console.log('🔑 Iniciando proceso de login...');
        console.log('🔍 Información del cliente:');
        console.log('   - Intents configurados:', client.options.intents);
        console.log('   - WebSocket timeout:', client.options.ws.handshakeTimeout);
        console.log('   - REST timeout:', client.options.rest.timeout);
        console.log('   - Reintentos de REST:', client.options.rest.retries);
        
        console.log('🌐 Información del entorno:');
        console.log('   - NODE_ENV:', process.env.NODE_ENV);
        console.log('   - Platform:', process.platform);
        console.log('   - Node version:', process.version);
        console.log('   - Discord.js version:', require('discord.js').version);
        
        console.log('🔑 Información del token:');
        console.log('   - Token length:', token.length);
        console.log('   - Token prefix:', token.substring(0, 10) + '...');
        console.log('   - Token parts:', token.split('.').length);
        
        // Estrategia alternativa: Intentar conexión sin timeout personalizado
        console.log('🚀 Estrategia de conexión para Render - Sin timeout personalizado');
        
        const loginPromise = client.login(process.env.DISCORD_TOKEN);
        
        // Esperar a que el cliente esté listo
        const readyPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('READY_TIMEOUT'));
            }, 120000); // 2 minutos para estar listo
            
            client.once('ready', () => {
                clearTimeout(timeout);
                resolve();
            });
            
            client.once('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
        
        // Esperar tanto el login como que esté listo
        await loginPromise;
        console.log('✅ Login exitoso, esperando estado ready...');
        
        await readyPromise;
        console.log('🎉 Bot completamente listo y operativo');
        
    } catch (error) {
        console.error('❌ Error al conectar:', error.message);
        console.error('🔍 Código de error:', error.code);
        console.error('🔍 Tipo de error:', error.name);
        
        // Análisis específico del error
        if (error.code === 'INVALID_TOKEN') {
            console.error('🚨 TOKEN INVÁLIDO');
            console.error('   1. Ve a Discord Developer Portal');
            console.error('   2. Regenera el token');
            console.error('   3. Actualiza DISCORD_TOKEN en Render');
            process.exit(1);
        } else if (error.code === 'DISALLOWED_INTENTS') {
            console.error('🚨 INTENTS NO PERMITIDOS');
            console.error('   1. Ve a Discord Developer Portal');
            console.error('   2. Bot → Privileged Gateway Intents');
            console.error('   3. Activa PRESENCE, SERVER MEMBERS, MESSAGE CONTENT');
            process.exit(1);
        } else if (error.message === 'READY_TIMEOUT') {
            console.error('⏱️ TIMEOUT: Bot no llegó a estado ready en 2 minutos');
        } else {
            console.error('🔍 Error desconocido:', error);
        }
        
        // Reintentar con backoff exponencial
        if (retries > 0) {
            const waitTime = Math.pow(2, 4 - retries) * 30000; // 30s, 60s, 120s
            console.log(`🔄 Reintentando en ${waitTime/1000} segundos... (${retries} intentos restantes)`);
            
            // Destruir cliente anterior si existe
            if (client.isReady()) {
                await client.destroy();
            }
            
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return connectToDiscord(retries - 1);
        } else {
            console.error('❌ Se agotaron los intentos de conexión');
            
            // En producción, mantener el servidor activo
            if (process.env.NODE_ENV === 'production') {
                console.log('🔄 Manteniendo servidor activo - Reintentos cada 15 minutos');
                setInterval(() => {
                    console.log('🔄 Reintento automático de conexión...');
                    connectToDiscord(1);
                }, 900000); // 15 minutos
            } else {
                process.exit(1);
            }
        }
    }
}

// Iniciar conexión con reintentos
connectToDiscord();

// Función para procesar álbum de Spotify
async function processSpotifyAlbum(albumId, message, voiceChannel) {
    try {
        const albumData = await getSpotifyAlbumTracks(albumId);
        
        if (albumData && albumData.tracks.length > 0) {
            // Enviar mensaje de confirmación
            const embed = createAlbumAddedEmbed(albumData.albumName, albumData.artist, albumData.tracks.length);
            const confirmMessage = await message.channel.send({ embeds: [embed] });
            
            // Eliminar el mensaje de confirmación después de 3 segundos
            setTimeout(async () => {
                try {
                    await confirmMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de confirmación del álbum:', error.message);
                }
            }, 3000);
            
            console.log(`Procesando álbum: ${albumData.albumName} con ${albumData.tracks.length} canciones`);
            
            // Agregar cada canción a la cola (sin buscar en YouTube)
            let addedCount = 0;
            for (let i = 0; i < albumData.tracks.length; i++) {
                const track = albumData.tracks[i];
                try {
                    // Crear objeto de canción de Spotify (sin URL de YouTube)
                    const spotifyTrack = {
                        id: track.id,
                        title: track.title,
                        artist: track.artist,
                        duration: track.duration,
                        spotifyUrl: track.spotifyUrl,
                        source: 'Spotify Album',
                        platform: 'spotify',
                        albumInfo: albumData,
                        // NO incluir url - se resolverá al reproducir
                    };
                    
                    botState.queue.push(spotifyTrack);
                    addedCount++;
                    
                    // Actualizar el panel de control cada 5 canciones
                    if (addedCount % 5 === 0) {
                        await updateControlPanel(message.guild.id);
                    }
                    
                    // Añadir delay mínimo entre agregados
                    if (i < albumData.tracks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                } catch (error) {
                    console.error(`Error al procesar canción del álbum: ${track.title}`, error);
                    // Continuar con la siguiente canción
                }
            }
            
            console.log(`Álbum agregado: ${addedCount}/${albumData.tracks.length} canciones`);
            
            // Actualizar el panel de control
            await updateControlPanel(message.guild.id);
            
            // Reproducir si no está reproduciendo
            if (!botState.isPlaying && botState.queue.length > 0) {
                playMusic(voiceChannel, message.channel);
            }
        } else {
            const embed = createErrorEmbed('No se pudo obtener información del álbum de Spotify.');
            const errorMessage = await message.channel.send({ embeds: [embed] });
            
            setTimeout(async () => {
                try {
                    await errorMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de error:', error.message);
                }
            }, 3000);
        }
    } catch (error) {
        console.error('Error al procesar álbum de Spotify:', error);
        const embed = createErrorEmbed('Error al procesar el álbum de Spotify.');
        const errorMessage = await message.channel.send({ embeds: [embed] });
        
        setTimeout(async () => {
            try {
                await errorMessage.delete();
            } catch (error) {
                console.log('No se pudo eliminar el mensaje de error:', error.message);
            }
        }, 3000);
    }
}

// Función para procesar artista de Spotify
async function processSpotifyArtist(artistId, message, voiceChannel) {
    try {
        const artistData = await getSpotifyArtistTopTracks(artistId);
        
        if (artistData && artistData.tracks.length > 0) {
            // Enviar mensaje de confirmación
            const embed = createArtistAddedEmbed(artistData.artistName, artistData.tracks.length);
            const confirmMessage = await message.channel.send({ embeds: [embed] });
            
            // Eliminar el mensaje de confirmación después de 3 segundos
            setTimeout(async () => {
                try {
                    await confirmMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de confirmación del artista:', error.message);
                }
            }, 3000);
            
            console.log(`Procesando artista: ${artistData.artistName} con ${artistData.tracks.length} canciones principales`);
            
            // Agregar cada canción a la cola (sin buscar en YouTube)
            let addedCount = 0;
            for (let i = 0; i < artistData.tracks.length; i++) {
                const track = artistData.tracks[i];
                try {
                    // Crear objeto de canción de Spotify (sin URL de YouTube)
                    const spotifyTrack = {
                        id: track.id,
                        title: track.title,
                        artist: track.artist,
                        duration: track.duration,
                        spotifyUrl: track.spotifyUrl,
                        source: 'Spotify Artist',
                        platform: 'spotify',
                        artistInfo: artistData,
                        // NO incluir url - se resolverá al reproducir
                    };
                    
                    botState.queue.push(spotifyTrack);
                    addedCount++;
                    
                    // Actualizar el panel de control cada 5 canciones
                    if (addedCount % 5 === 0) {
                        await updateControlPanel(message.guild.id);
                    }
                    
                    // Añadir delay mínimo entre agregados
                    if (i < artistData.tracks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                } catch (error) {
                    console.error(`Error al procesar canción del artista: ${track.title}`, error);
                    // Continuar con la siguiente canción
                }
            }
            
            console.log(`Artista agregado: ${addedCount}/${artistData.tracks.length} canciones`);
            
            // Actualizar el panel de control
            await updateControlPanel(message.guild.id);
            
            // Reproducir si no está reproduciendo
            if (!botState.isPlaying && botState.queue.length > 0) {
                playMusic(voiceChannel, message.channel);
            }
        } else {
            const embed = createErrorEmbed('No se pudo obtener información del artista de Spotify.');
            const errorMessage = await message.channel.send({ embeds: [embed] });
            
            setTimeout(async () => {
                try {
                    await errorMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de error:', error.message);
                }
            }, 3000);
        }
    } catch (error) {
        console.error('Error al procesar artista de Spotify:', error);
        const embed = createErrorEmbed('Error al procesar el artista de Spotify.');
        const errorMessage = await message.channel.send({ embeds: [embed] });
        
        setTimeout(async () => {
            try {
                await errorMessage.delete();
            } catch (error) {
                console.log('No se pudo eliminar el mensaje de error:', error.message);
            }
        }, 3000);
    }
}

// Función para obtener tracks de una playlist de Spotify
async function getSpotifyPlaylistTracks(playlistId) {
    try {
        console.log(`Obteniendo tracks de playlist de Spotify: ${playlistId}`);
        
        const playlist = await spotifyApi.getPlaylist(playlistId);
        
        if (!playlist.body || !playlist.body.tracks) {
            console.log('No se encontraron tracks en la playlist');
            return null;
        }
        
        const tracks = [];
        const playlistName = playlist.body.name;
        const owner = playlist.body.owner.display_name;
        
        // Procesar los tracks de la playlist
        for (const item of playlist.body.tracks.items) {
            if (item.track && item.track.type === 'track') {
                const track = item.track;
                const artists = track.artists.map(artist => artist.name).join(', ');
                
                tracks.push({
                    id: track.id,
                    title: track.name,
                    artist: artists,
                    searchQuery: `${track.name} ${artists}`,
                    duration: Math.floor(track.duration_ms / 1000),
                    spotifyUrl: track.external_urls.spotify
                });
            }
        }
        
        console.log(`Playlist procesada: ${playlistName} - ${tracks.length} tracks`);
        
        return {
            playlistName,
            owner,
            tracks,
            totalTracks: tracks.length
        };
    } catch (error) {
        console.error('Error al obtener playlist de Spotify:', error.message);
        return null;
    }
}

// Función para procesar playlist de Spotify (SIN buscar en YouTube)
async function processSpotifyPlaylist(playlistId, message, voiceChannel) {
    try {
        const playlistData = await getSpotifyPlaylistTracks(playlistId);
        
        if (playlistData && playlistData.tracks.length > 0) {
            // Enviar mensaje de confirmación
            const embed = createPlaylistAddedEmbed(playlistData.playlistName, playlistData.tracks.length, 'Spotify');
            const confirmMessage = await message.channel.send({ embeds: [embed] });
            
            // Eliminar el mensaje de confirmación después de 3 segundos
            setTimeout(async () => {
                try {
                    await confirmMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de confirmación de playlist:', error.message);
                }
            }, 3000);
            
            console.log(`Procesando playlist de Spotify: ${playlistData.playlistName} con ${playlistData.tracks.length} canciones`);
            
            // Agregar cada canción a la cola (sin buscar en YouTube)
            let addedCount = 0;
            for (let i = 0; i < playlistData.tracks.length; i++) {
                const track = playlistData.tracks[i];
                try {
                    // Crear objeto de canción de Spotify (sin URL de YouTube)
                    const spotifyTrack = {
                        id: track.id,
                        title: track.title,
                        artist: track.artist,
                        duration: track.duration,
                        spotifyUrl: track.spotifyUrl,
                        source: 'Spotify Playlist',
                        platform: 'spotify',
                        playlistInfo: playlistData,
                        // NO incluir url - se resolverá al reproducir
                    };
                    
                    botState.queue.push(spotifyTrack);
                    addedCount++;
                    
                    // Actualizar el panel de control cada 10 canciones
                    if (addedCount % 10 === 0) {
                        await updateControlPanel(message.guild.id);
                    }
                    
                    // Añadir delay mínimo entre agregados
                    if (i < playlistData.tracks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                } catch (error) {
                    console.error(`Error al procesar canción de playlist: ${track.title}`, error);
                    // Continuar con la siguiente canción
                }
            }
            
            console.log(`Playlist de Spotify agregada: ${addedCount}/${playlistData.tracks.length} canciones`);
            
            // Actualizar el panel de control
            await updateControlPanel(message.guild.id);
            
            // Reproducir si no está reproduciendo
            if (!botState.isPlaying && botState.queue.length > 0) {
                playMusic(voiceChannel, message.channel);
            }
        } else {
            const embed = createErrorEmbed('No se pudo obtener información de la playlist de Spotify.');
            const errorMessage = await message.channel.send({ embeds: [embed] });
            
            setTimeout(async () => {
                try {
                    await errorMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de error:', error.message);
                }
            }, 3000);
        }
    } catch (error) {
        console.error('Error al procesar playlist de Spotify:', error);
        const embed = createErrorEmbed('Error al procesar la playlist de Spotify.');
        const errorMessage = await message.channel.send({ embeds: [embed] });
        
        setTimeout(async () => {
            try {
                await errorMessage.delete();
            } catch (error) {
                console.log('No se pudo eliminar el mensaje de error:', error.message);
            }
        }, 3000);
    }
}

// Función para obtener tracks de una playlist de YouTube
async function getYouTubePlaylistTracks(playlistId) {
    try {
        console.log(`Obteniendo tracks de playlist de YouTube: ${playlistId}`);
        
        const playlist = await ytpl(playlistId, { limit: 100 });
        
        if (!playlist || !playlist.items) {
            console.log('No se encontraron tracks en la playlist de YouTube');
            return null;
        }
        
        const tracks = [];
        
        // Procesar los tracks de la playlist
        for (const item of playlist.items) {
            if (item.url && item.title && item.duration) {
                tracks.push({
                    title: item.title,
                    url: item.url,
                    duration: item.duration.seconds || 0,
                    thumbnail: item.thumbnails && item.thumbnails.length > 0 ? item.thumbnails[0].url : null,
                    channel: item.author ? item.author.name : 'YouTube',
                    source: 'YouTube Playlist'
                });
            }
        }
        
        console.log(`Playlist de YouTube procesada: ${playlist.title} - ${tracks.length} tracks`);
        
        return {
            playlistName: playlist.title,
            owner: playlist.author ? playlist.author.name : 'YouTube',
            tracks,
            totalTracks: tracks.length,
            url: playlist.url
        };
    } catch (error) {
        console.error('Error al obtener playlist de YouTube:', error.message);
        return null;
    }
}

// Función para procesar playlist de YouTube
async function processYouTubePlaylist(playlistId, message, voiceChannel) {
    try {
        const playlistData = await getYouTubePlaylistTracks(playlistId);
        
        if (playlistData && playlistData.tracks.length > 0) {
            // Enviar mensaje de confirmación
            const embed = createPlaylistAddedEmbed(playlistData.playlistName, playlistData.tracks.length, 'YouTube');
            const confirmMessage = await message.channel.send({ embeds: [embed] });
            
            // Eliminar el mensaje de confirmación después de 3 segundos
            setTimeout(async () => {
                try {
                    await confirmMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de confirmación de playlist:', error.message);
                }
            }, 3000);
            
            console.log(`Procesando playlist de YouTube: ${playlistData.playlistName} con ${playlistData.tracks.length} canciones`);
            
            // Agregar cada canción a la cola
            let addedCount = 0;
            for (const track of playlistData.tracks) {
                try {
                    // Las canciones de YouTube ya tienen toda la información necesaria
                    track.playlistInfo = playlistData;
                    botState.queue.push(track);
                    addedCount++;
                    
                    // Actualizar el panel de control cada 10 canciones
                    if (addedCount % 10 === 0) {
                        await updateControlPanel(message.guild.id);
                    }
                } catch (error) {
                    console.error(`Error al procesar canción de playlist de YouTube: ${track.title}`, error);
                }
            }
            
            console.log(`Playlist de YouTube agregada: ${addedCount}/${playlistData.tracks.length} canciones`);
            
            // Actualizar el panel de control
            await updateControlPanel(message.guild.id);
            
            // Reproducir si no está reproduciendo
            if (!botState.isPlaying && botState.queue.length > 0) {
                playMusic(voiceChannel, message.channel);
            }
        } else {
            const embed = createErrorEmbed('No se pudo obtener información de la playlist de YouTube.');
            const errorMessage = await message.channel.send({ embeds: [embed] });
            
            setTimeout(async () => {
                try {
                    await errorMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de error:', error.message);
                }
            }, 3000);
        }
    } catch (error) {
        console.error('Error al procesar playlist de YouTube:', error);
        const embed = createErrorEmbed('Error al procesar la playlist de YouTube.');
        const errorMessage = await message.channel.send({ embeds: [embed] });
        
        setTimeout(async () => {
            try {
                await errorMessage.delete();
            } catch (error) {
                console.log('No se pudo eliminar el mensaje de error:', error.message);
            }
        }, 3000);
    }
}

// Función para obtener las canciones más populares de un artista de Spotify
async function getSpotifyArtistTopTracks(artistId) {
    try {
        console.log(`Obteniendo top tracks del artista de Spotify: ${artistId}`);
        
        // Obtener información del artista
        const artist = await spotifyApi.getArtist(artistId);
        
        if (!artist.body) {
            console.log('No se encontró el artista');
            return null;
        }
        
        // Obtener las canciones más populares del artista
        const topTracks = await spotifyApi.getArtistTopTracks(artistId, 'US');
        
        if (!topTracks.body || !topTracks.body.tracks) {
            console.log('No se encontraron canciones del artista');
            return null;
        }
        
        const tracks = [];
        const artistName = artist.body.name;
        
        // Procesar las canciones más populares
        for (const track of topTracks.body.tracks) {
            const artists = track.artists.map(artist => artist.name).join(', ');
            
            tracks.push({
                id: track.id,
                title: track.name,
                artist: artists,
                searchQuery: `${track.name} ${artists}`,
                duration: Math.floor(track.duration_ms / 1000),
                spotifyUrl: track.external_urls.spotify
            });
        }
        
        console.log(`Artista procesado: ${artistName} - ${tracks.length} canciones principales`);
        
        return {
            artistName,
            tracks,
            totalTracks: tracks.length
        };
    } catch (error) {
        console.error('Error al obtener top tracks del artista de Spotify:', error.message);
        return null;
    }
}

// Función para obtener videos de un canal de YouTube
async function getYouTubeChannelVideos(channelId) {
    try {
        console.log(`Obteniendo videos del canal de YouTube: ${channelId}`);
        
        // Buscar videos del canal usando youtube-sr
        const results = await yts.search(`${channelId} music`, { 
            limit: 20,
            type: 'video'
        });
        
        if (!results || results.length === 0) {
            console.log('No se encontraron videos en el canal');
            return null;
        }
        
        // Filtrar solo videos del canal específico
        const channelVideos = results.filter(video => 
            video.channel && (
                video.channel.id === channelId || 
                video.channel.name.toLowerCase().includes(channelId.toLowerCase())
            )
        );
        
        if (channelVideos.length === 0) {
            console.log('No se encontraron videos del canal específico');
            return null;
        }
        
        const tracks = [];
        const channelName = channelVideos[0].channel.name;
        
        // Procesar los videos del canal
        for (const video of channelVideos) {
            if (video.url && video.title && video.duration) {
                let durationInSeconds = video.duration;
                
                if (typeof video.duration === 'string') {
                    const timeParts = video.duration.split(':').map(Number);
                    if (timeParts.length === 2) {
                        durationInSeconds = timeParts[0] * 60 + timeParts[1];
                    } else if (timeParts.length === 3) {
                        durationInSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
                    }
                }
                
                tracks.push({
                    title: video.title,
                    url: video.url,
                    duration: durationInSeconds,
                    thumbnail: video.thumbnail?.url || null,
                    channel: video.channel.name,
                    source: 'YouTube Canal'
                });
            }
        }
        
        console.log(`Canal de YouTube procesado: ${channelName} - ${tracks.length} videos`);
        
        return {
            channelName,
            tracks,
            totalTracks: tracks.length
        };
    } catch (error) {
        console.error('Error al obtener videos del canal de YouTube:', error.message);
        return null;
    }
}

// Función para procesar canal/artista de YouTube
async function processYouTubeArtist(channelId, message, voiceChannel) {
    try {
        const channelData = await getYouTubeChannelVideos(channelId);
        
        if (channelData && channelData.tracks.length > 0) {
            // Enviar mensaje de confirmación
            const embed = createYouTubeArtistAddedEmbed(channelData.channelName, channelData.tracks.length);
            const confirmMessage = await message.channel.send({ embeds: [embed] });
            
            // Eliminar el mensaje de confirmación después de 3 segundos
            setTimeout(async () => {
                try {
                    await confirmMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de confirmación del canal:', error.message);
                }
            }, 3000);
            
            console.log(`Procesando canal de YouTube: ${channelData.channelName} con ${channelData.tracks.length} videos`);
            
            // Agregar cada video a la cola
            let addedCount = 0;
            for (let i = 0; i < channelData.tracks.length; i++) {
                const track = channelData.tracks[i];
                try {
                    track.channelInfo = channelData;
                    botState.queue.push(track);
                    addedCount++;
                    
                    // Actualizar el panel de control cada 5 videos
                    if (addedCount % 5 === 0) {
                        await updateControlPanel(message.guild.id);
                    }
                    
                    // Añadir delay entre agregados
                    if (i < channelData.tracks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                } catch (error) {
                    console.error(`Error al procesar video del canal: ${track.title}`, error);
                }
            }
            
            console.log(`Canal de YouTube agregado: ${addedCount}/${channelData.tracks.length} videos`);
            
            // Actualizar el panel de control
            await updateControlPanel(message.guild.id);
            
            // Reproducir si no está reproduciendo
            if (!botState.isPlaying && botState.queue.length > 0) {
                playMusic(voiceChannel, message.channel);
            }
        } else {
            const embed = createErrorEmbed('No se pudo obtener información del canal de YouTube.');
            const errorMessage = await message.channel.send({ embeds: [embed] });
            
            setTimeout(async () => {
                try {
                    await errorMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de error:', error.message);
                }
            }, 3000);
        }
    } catch (error) {
        console.error('Error al procesar canal de YouTube:', error);
        const embed = createErrorEmbed('Error al procesar el canal de YouTube.');
        const errorMessage = await message.channel.send({ embeds: [embed] });
        
        setTimeout(async () => {
            try {
                await errorMessage.delete();
            } catch (error) {
                console.log('No se pudo eliminar el mensaje de error:', error.message);
            }
        }, 3000);
    }
}

// Función para procesar playlist de Spotify (sin buscar en YouTube)
async function processSpotifyPlaylistNative(playlistId, message, voiceChannel) {
    try {
        const playlistData = await getSpotifyPlaylistTracks(playlistId);
        
        if (playlistData && playlistData.tracks.length > 0) {
            // Enviar mensaje de confirmación
            const embed = createPlaylistAddedEmbed(playlistData.playlistName, playlistData.tracks.length, 'Spotify');
            const confirmMessage = await message.channel.send({ embeds: [embed] });
            
            // Eliminar el mensaje de confirmación después de 3 segundos
            setTimeout(async () => {
                try {
                    await confirmMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de confirmación de playlist:', error.message);
                }
            }, 3000);
            
            console.log(`Procesando playlist de Spotify: ${playlistData.playlistName} con ${playlistData.tracks.length} canciones`);
            
            // Agregar cada canción a la cola (sin buscar en YouTube)
            let addedCount = 0;
            for (let i = 0; i < playlistData.tracks.length; i++) {
                const track = playlistData.tracks[i];
                
                try {
                    const songInfo = {
                        title: track.title,
                        artist: track.artist,
                        duration: track.duration,
                        url: track.spotifyUrl,
                        source: 'Spotify Playlist',
                        platform: 'spotify',
                        playlistInfo: playlistData
                    };
                    
                    botState.queue.push(songInfo);
                    addedCount++;
                    
                    // Actualizar el panel de control cada 10 canciones
                    if (addedCount % 10 === 0) {
                        await updateControlPanel(message.guild.id);
                    }
                    
                    // Añadir delay entre canciones
                    if (i < playlistData.tracks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (error) {
                    console.error(`Error al procesar canción de playlist: ${track.title}`, error);
                }
            }
            
            console.log(`Playlist de Spotify agregada: ${addedCount}/${playlistData.tracks.length} canciones`);
            
            // Actualizar el panel de control
            await updateControlPanel(message.guild.id);
            
            // Reproducir si no está reproduciendo
            if (!botState.isPlaying && botState.queue.length > 0) {
                playMusic(voiceChannel, message.channel);
            }
        } else {
            const embed = createErrorEmbed('No se pudo obtener información de la playlist de Spotify.');
            const errorMessage = await message.channel.send({ embeds: [embed] });
            
            setTimeout(async () => {
                try {
                    await errorMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de error:', error.message);
                }
            }, 3000);
        }
        
        // Eliminar mensaje del usuario
        try {
            await message.delete();
        } catch (error) {
            console.log('No se pudo eliminar el mensaje del usuario:', error.message);
        }
        
    } catch (error) {
        console.error('Error al procesar playlist de Spotify:', error);
        const embed = createErrorEmbed('Error al procesar la playlist de Spotify.');
        const errorMessage = await message.channel.send({ embeds: [embed] });
        
        setTimeout(async () => {
            try {
                await errorMessage.delete();
            } catch (error) {
                console.log('No se pudo eliminar el mensaje de error:', error.message);
            }
        }, 3000);
    }
}

// Función para procesar álbum de Spotify (sin buscar en YouTube)
async function processSpotifyAlbumNative(albumId, message, voiceChannel) {
    try {
        const albumData = await getSpotifyAlbumTracks(albumId);
        
        if (albumData && albumData.tracks.length > 0) {
            // Enviar mensaje de confirmación
            const embed = createAlbumAddedEmbed(albumData.albumName, albumData.artist, albumData.tracks.length);
            const confirmMessage = await message.channel.send({ embeds: [embed] });
            
            // Eliminar el mensaje de confirmación después de 3 segundos
            setTimeout(async () => {
                try {
                    await confirmMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de confirmación del álbum:', error.message);
                }
            }, 3000);
            
            console.log(`Procesando álbum de Spotify: ${albumData.albumName} con ${albumData.tracks.length} canciones`);
            
            // Agregar cada canción a la cola (sin buscar en YouTube)
            let addedCount = 0;
            for (let i = 0; i < albumData.tracks.length; i++) {
                const track = albumData.tracks[i];
                
                try {
                    const songInfo = {
                        title: track.title,
                        artist: track.artist,
                        duration: track.duration,
                        url: track.spotifyUrl,
                        source: 'Spotify Álbum',
                        platform: 'spotify',
                        albumInfo: albumData
                    };
                    
                    botState.queue.push(songInfo);
                    addedCount++;
                    
                    // Actualizar el panel de control cada 5 canciones
                    if (addedCount % 5 === 0) {
                        await updateControlPanel(message.guild.id);
                    }
                    
                    // Añadir delay entre canciones
                    if (i < albumData.tracks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (error) {
                    console.error(`Error al procesar canción del álbum: ${track.title}`, error);
                }
            }
            
            console.log(`Álbum agregado: ${addedCount}/${albumData.tracks.length} canciones`);
            
            // Actualizar el panel de control
            await updateControlPanel(message.guild.id);
            
            // Reproducir si no está reproduciendo
            if (!botState.isPlaying && botState.queue.length > 0) {
                playMusic(voiceChannel, message.channel);
            }
        } else {
            const embed = createErrorEmbed('No se pudo obtener información del álbum de Spotify.');
            const errorMessage = await message.channel.send({ embeds: [embed] });
            
            setTimeout(async () => {
                try {
                    await errorMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de error:', error.message);
                }
            }, 3000);
        }
        
        // Eliminar mensaje del usuario
        try {
            await message.delete();
        } catch (error) {
            console.log('No se pudo eliminar el mensaje del usuario:', error.message);
        }
        
    } catch (error) {
        console.error('Error al procesar álbum de Spotify:', error);
        const embed = createErrorEmbed('Error al procesar el álbum de Spotify.');
        const errorMessage = await message.channel.send({ embeds: [embed] });
        
        setTimeout(async () => {
            try {
                await errorMessage.delete();
            } catch (error) {
                console.log('No se pudo eliminar el mensaje de error:', error.message);
            }
        }, 3000);
    }
}

// Función para procesar artista de Spotify (sin buscar en YouTube)
async function processSpotifyArtistNative(artistId, message, voiceChannel) {
    try {
        const artistData = await getSpotifyArtistTopTracks(artistId);
        
        if (artistData && artistData.tracks.length > 0) {
            // Enviar mensaje de confirmación
            const embed = createArtistAddedEmbed(artistData.artistName, artistData.tracks.length);
            const confirmMessage = await message.channel.send({ embeds: [embed] });
            
            // Eliminar el mensaje de confirmación después de 3 segundos
            setTimeout(async () => {
                try {
                    await confirmMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de confirmación del artista:', error.message);
                }
            }, 3000);
            
            console.log(`Procesando artista de Spotify: ${artistData.artistName} con ${artistData.tracks.length} canciones principales`);
            
            // Agregar cada canción a la cola (sin buscar en YouTube)
            let addedCount = 0;
            for (let i = 0; i < artistData.tracks.length; i++) {
                const track = artistData.tracks[i];
                
                try {
                    const songInfo = {
                        title: track.title,
                        artist: track.artist,
                        duration: track.duration,
                        url: track.spotifyUrl,
                        source: 'Spotify Artista',
                        platform: 'spotify',
                        artistInfo: artistData
                    };
                    
                    botState.queue.push(songInfo);
                    addedCount++;
                    
                    // Actualizar el panel de control cada 5 canciones
                    if (addedCount % 5 === 0) {
                        await updateControlPanel(message.guild.id);
                    }
                    
                    // Añadir delay entre canciones
                    if (i < artistData.tracks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (error) {
                    console.error(`Error al procesar canción del artista: ${track.title}`, error);
                }
            }
            
            console.log(`Artista agregado: ${addedCount}/${artistData.tracks.length} canciones`);
            
            // Actualizar el panel de control
            await updateControlPanel(message.guild.id);
            
            // Reproducir si no está reproduciendo
            if (!botState.isPlaying && botState.queue.length > 0) {
                playMusic(voiceChannel, message.channel);
            }
        } else {
            const embed = createErrorEmbed('No se pudo obtener información del artista de Spotify.');
            const errorMessage = await message.channel.send({ embeds: [embed] });
            
            setTimeout(async () => {
                try {
                    await errorMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de error:', error.message);
                }
            }, 3000);
        }
        
        // Eliminar mensaje del usuario
        try {
            await message.delete();
        } catch (error) {
            console.log('No se pudo eliminar el mensaje del usuario:', error.message);
        }
        
    } catch (error) {
        console.error('Error al procesar artista de Spotify:', error);
        const embed = createErrorEmbed('Error al procesar el artista de Spotify.');
        const errorMessage = await message.channel.send({ embeds: [embed] });
        
        setTimeout(async () => {
            try {
                await errorMessage.delete();
            } catch (error) {
                console.log('No se pudo eliminar el mensaje de error:', error.message);
            }
        }, 3000);
    }
}

// Función para procesar canción individual de Spotify (con búsqueda automática en YouTube)
async function processSpotifyTrack(trackId, message, voiceChannel) {
    try {
        console.log(`Procesando canción de Spotify: ${trackId}`);
        
        const spotifyTrack = await getSpotifyTrackById(trackId);
        
        if (spotifyTrack) {
            console.log(`Información de Spotify obtenida: ${spotifyTrack.title} - ${spotifyTrack.artist}`);
            
            // Crear información de canción de Spotify (sin buscar en YouTube)
            const songInfo = {
                id: spotifyTrack.id,
                title: spotifyTrack.title,
                artist: spotifyTrack.artist,
                duration: spotifyTrack.duration,
                spotifyUrl: spotifyTrack.spotifyUrl,
                source: 'Spotify Track',
                platform: 'spotify',
                album: spotifyTrack.album || 'Desconocido',
                // NO incluir url - se resolverá al reproducir
            };
            
            // Agregar a la cola
            botState.queue.push(songInfo);
            
            // Mostrar embed de éxito
            const embed = createSpotifySongAddedEmbed(
                songInfo.title,
                songInfo.artist,
                songInfo.album,
                botState.queue.length
            );
            
            const confirmMessage = await message.channel.send({ embeds: [embed] });
            
            // Eliminar mensaje después de 3 segundos
            setTimeout(async () => {
                try {
                    await confirmMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de confirmación:', error.message);
                }
            }, 3000);
            
            // Eliminar mensaje del usuario
            try {
                await message.delete();
            } catch (error) {
                console.log('No se pudo eliminar el mensaje del usuario:', error.message);
            }
            
            // Actualizar panel de control
            await updateControlPanel(message.guild.id);
            
            // Reproducir si no está reproduciendo
            if (!botState.isPlaying) {
                playMusic(voiceChannel, message.channel);
            }
            
            console.log(`✅ Canción de Spotify agregada a la cola: ${songInfo.title}`);
            
        } else {
            const embed = createErrorEmbed('No se pudo obtener información de la canción de Spotify.');
            const errorMessage = await message.channel.send({ embeds: [embed] });
            
            setTimeout(async () => {
                try {
                    await errorMessage.delete();
                } catch (error) {
                    console.log('No se pudo eliminar el mensaje de error:', error.message);
                }
            }, 3000);
        }
    } catch (error) {
        console.error('Error al procesar canción de Spotify:', error);
        const embed = createErrorEmbed('Error al procesar la canción de Spotify.');
        const errorMessage = await message.channel.send({ embeds: [embed] });
        
        setTimeout(async () => {
            try {
                await errorMessage.delete();
            } catch (error) {
                console.log('No se pudo eliminar el mensaje de error:', error.message);
            }
        }, 3000);
    }
}

// Función para procesar canción individual de YouTube
async function processYouTubeTrack(url, message, voiceChannel) {
    try {
        if (!url || typeof url !== 'string') {
            const embed = createErrorEmbed('La URL de YouTube es inválida.');
            const errorMessage = await message.channel.send({ embeds: [embed] });
            setTimeout(async () => {
                try { await errorMessage.delete(); await message.delete(); } catch {}
            }, 3000);
            return;
        }
        if (play.yt_validate(url) === 'video') {
            const info = await play.video_info(url);
            const songInfo = {
                title: info.video_details.title,
                url: url,
                duration: info.video_details.durationInSec,
                thumbnail: info.video_details.thumbnails[0]?.url || null,
                channel: info.video_details.channel.name,
                source: 'YouTube',
                platform: 'youtube'
            };
            botState.queue.push(songInfo);
            const embed = createYouTubeSongAddedEmbed(songInfo.title, songInfo.channel, botState.queue.length);
            const confirmMessage = await message.channel.send({ embeds: [embed] });
            setTimeout(async () => {
                try { await confirmMessage.delete(); await message.delete(); } catch {}
            }, 2000);
            await updateControlPanel(message.guild.id);
            if (!botState.isPlaying) {
                playMusic(voiceChannel, message.channel);
            }
        } else {
            const embed = createErrorEmbed('La URL de YouTube no es válida.');
            const errorMessage = await message.channel.send({ embeds: [embed] });
            setTimeout(async () => {
                try { await errorMessage.delete(); await message.delete(); } catch {}
            }, 3000);
        }
    } catch (error) {
        console.error('Error al procesar canción de YouTube:', error);
        const embed = createErrorEmbed('Error al procesar la canción de YouTube.');
        const errorMessage = await message.channel.send({ embeds: [embed] });
        setTimeout(async () => {
            try { await errorMessage.delete(); await message.delete(); } catch {}
        }, 3000);
    }
}

/**
 * Busca canciones similares basándose en una canción de referencia
 * @param {Object} referenceSong - Canción de referencia
 * @param {number} maxResults - Máximo número de resultados
 * @returns {Array} Array de canciones similares
 */
async function findSimilarSongs(referenceSong, maxResults = 5) {
    if (!referenceSong || botState.radioMode.isSearching) return [];
    
    botState.radioMode.isSearching = true;
    const similarSongs = [];
    
    try {
        // Extraer información de la canción de referencia
        const songTitle = referenceSong.title;
        const artist = referenceSong.artist || referenceSong.channel;
        
        // Limpiar el título para obtener palabras clave
        const cleanTitle = songTitle.replace(/[\[\](){}]/g, '').replace(/official|video|audio|ft|feat|featuring/gi, '');
        const keywords = cleanTitle.split(' ').filter(word => word.length > 2);
        
        // Diferentes estrategias de búsqueda
        const searchStrategies = [
            // Buscar por artista
            artist ? `${artist} popular songs` : null,
            artist ? `${artist} top hits` : null,
            artist ? `${artist} best songs` : null,
            // Buscar por palabras clave del título
            ...keywords.slice(0, 3).map(keyword => `${keyword} music`),
            // Buscar por género/estilo
            ...config.radio.searchTerms.map(term => `${keywords[0]} ${term}`),
            // Búsquedas más amplias
            `similar to ${songTitle}`,
            `music like ${artist || keywords[0]}`,
            `${keywords[0]} ${keywords[1] || ''} mix`
        ].filter(Boolean);
        
        // Realizar búsquedas
        for (const searchQuery of searchStrategies) {
            if (similarSongs.length >= maxResults) break;
            
            try {
                console.log(`🔍 Buscando música similar: "${searchQuery}"`);
                const results = await yts.search(searchQuery, { limit: 3 });
                
                if (results && results.length > 0) {
                    for (const result of results) {
                        if (similarSongs.length >= maxResults) break;
                        
                        // Verificar que no sea la misma canción o una ya agregada
                        const resultTitle = result.title.toLowerCase();
                        const isAlreadyAdded = similarSongs.some(song => 
                            song.title.toLowerCase() === resultTitle ||
                            song.url === result.url
                        );
                        
                        const isInHistory = botState.radioMode.songsHistory.some(song => 
                            song.title.toLowerCase() === resultTitle ||
                            song.url === result.url
                        );
                        
                        const isCurrentSong = referenceSong.title.toLowerCase() === resultTitle;
                        
                        if (!isAlreadyAdded && !isInHistory && !isCurrentSong) {
                            const songInfo = {
                                title: result.title,
                                url: result.url,
                                duration: result.duration?.text || 'N/A',
                                thumbnail: result.thumbnail?.url || null,
                                channel: result.channel?.name || 'Desconocido',
                                source: '🔀 Radio Mode',
                                platform: 'youtube',
                                radioSuggestion: true
                            };
                            
                            similarSongs.push(songInfo);
                            console.log(`✅ Encontrada canción similar: ${songInfo.title}`);
                        }
                    }
                }
                
                // Pequeño delay entre búsquedas
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.error(`Error en búsqueda similar: ${searchQuery}`, error);
                continue;
            }
        }
        
        // Agregar canciones al historial
        botState.radioMode.songsHistory.push(...similarSongs);
        
        // Mantener el historial limitado (últimas 50 canciones)
        if (botState.radioMode.songsHistory.length > 50) {
            botState.radioMode.songsHistory = botState.radioMode.songsHistory.slice(-50);
        }
        
    } catch (error) {
        console.error('Error al buscar canciones similares:', error);
    } finally {
        botState.radioMode.isSearching = false;
    }
    
    return similarSongs;
}

/**
 * Activa el modo radio cuando la cola está baja
 */
async function activateRadioMode(voiceChannel, textChannel) {
    if (!config.radio.enabled || botState.radioMode.isSearching || !botState.currentSong) {
        return;
    }
    
    if (botState.queue.length <= config.radio.minQueueSize) {
        console.log('🔀 Activando modo radio...');
        
        // Usar la canción actual como referencia
        const referenceSong = botState.currentSong;
        botState.radioMode.lastSong = referenceSong;
        
        // Buscar canciones similares
        const similarSongs = await findSimilarSongs(referenceSong, config.radio.maxSuggestions);
        
        if (similarSongs.length > 0) {
            // Agregar canciones similares a la cola
            botState.queue.push(...similarSongs);
            
            console.log(`🎵 Radio mode: ${similarSongs.length} canciones similares agregadas`);
            
            // Actualizar panel de control
            await updateControlPanel(voiceChannel.guild.id);
            
            // Notificación temporal
            if (textChannel) {
                const embed = createRadioModeEmbed(similarSongs.length, referenceSong.title);
                const notificationMessage = await textChannel.send({ embeds: [embed] });
                
                setTimeout(async () => {
                    try {
                        await notificationMessage.delete();
                    } catch (error) {
                        console.log('No se pudo eliminar la notificación de radio:', error.message);
                    }
                }, 5000);
            }
        }
    }
}

// Servidor Express para health checks (optimización para Render)
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware básico
app.use(express.json());

// Health check endpoint optimizado
app.get('/health', (req, res) => {
    const status = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        bot: {
            ready: client.readyAt !== null,
            user: client.user ? client.user.tag : 'Not logged in',
            guilds: client.guilds.cache.size,
            ping: client.ws.ping,
            queue: botState.queue.length,
            isPlaying: botState.isPlaying,
            currentSong: botState.currentSong ? {
                title: botState.currentSong.title,
                artist: botState.currentSong.artist || botState.currentSong.channel,
                platform: botState.currentSong.platform
            } : null
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
        user: client.user ? client.user.tag : 'Not logged in',
        guilds: client.guilds.cache.size,
        queue: botState.queue.length,
        isPlaying: botState.isPlaying
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

// Endpoint para interacciones de Discord (webhook)
app.post('/interactions', (req, res) => {
    res.json({ type: 1 }); // Respuesta pong para verificación
});

// Iniciar servidor Express
app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Servidor Express iniciado para Render');
    console.log(`🔗 Disponible en: http://0.0.0.0:${PORT}`);
    console.log('📡 Endpoints: /, /health, /ping, /interactions');
});

// Los comandos slash se registran automáticamente en el evento 'ready'

// Función para crear stream con youtube-dl-exec como fallback
async function createStreamWithYoutubeDl(url) {
    try {
        console.log('🔧 Intentando crear stream con youtube-dl-exec...');
        
        // Usar youtube-dl-exec con parámetros compatibles
        const info = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            format: 'bestaudio/best'
        });
        
        if (!info || !info.url) {
            throw new Error('No se pudo obtener información del video');
        }
        
        console.log('🎵 Información del video obtenida:');
        console.log('🎵 Título:', info.title);
        console.log('🎵 Duración:', info.duration);
        console.log('🎵 Formato:', info.format_id);
        
        // Crear stream usando FFmpeg con configuración optimizada
        const ffmpegProcess = spawn(ffmpegPath, [
            '-i', info.url,
            '-f', 'opus',
            '-ar', '48000',
            '-ac', '2',
            '-b:a', '96k',
            '-vn',
            '-loglevel', 'error',
            'pipe:1'
        ], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        const stream = new PassThrough();
        
        ffmpegProcess.stdout.on('data', (chunk) => {
            stream.write(chunk);
        });
        
        ffmpegProcess.stdout.on('end', () => {
            stream.end();
        });
        
        ffmpegProcess.stderr.on('data', (data) => {
            console.log('🔧 FFmpeg stderr:', data.toString());
        });
        
        ffmpegProcess.on('error', (error) => {
            console.error('❌ Error en FFmpeg:', error);
            stream.destroy(error);
        });
        
        ffmpegProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`❌ FFmpeg terminó con código ${code}`);
            } else {
                console.log('✅ FFmpeg terminó correctamente');
            }
        });
        
        console.log('✅ Stream creado exitosamente con youtube-dl-exec');
        return stream;
        
    } catch (error) {
        console.error('❌ Error con youtube-dl-exec:', error.message);
        throw error;
    }
}
