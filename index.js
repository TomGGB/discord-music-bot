require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const yts = require('youtube-sr').default;
const ytpl = require('ytpl');
const SpotifyWebApi = require('spotify-web-api-node');

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
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Configuración de Spotify
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

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
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body['access_token']);
        console.log(config.messages.spotifyTokenObtained);
    } catch (error) {
        console.error(config.messages.spotifyTokenError, error);
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
                if (ytdl.validateURL(video.url)) {
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
                    
                    return {
                        title: video.title,
                        url: video.url,
                        duration: durationInSeconds,
                        thumbnail: video.thumbnail?.url || null,
                        channel: video.channel?.name || 'Desconocido'
                    };
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
                    noSubscriber: 'pause'
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

        // Crear el recurso de audio con mejor manejo de errores
        let stream;
        try {
            console.log(`Creando stream para: ${resolvedSong.title}`);
            stream = ytdl(resolvedSong.url, {
                ...config.audio.ytdlOptions,
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                }
            });
            
            // Esperar a que el stream esté listo
            await new Promise((resolve, reject) => {
                stream.once('readable', resolve);
                stream.once('error', reject);
                setTimeout(() => reject(new Error('Stream timeout')), 10000);
            });
            
        } catch (streamError) {
            console.error('Error al crear el stream:', streamError);
            botState.queue.shift();
            if (botState.queue.length > 0) {
                return playMusic(voiceChannel, textChannel);
            }
            return;
        }

        const resource = createAudioResource(stream, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true
        });

        // Establecer volumen por defecto
        resource.volume?.setVolume(0.5);

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
    
    // Obtener token de Spotify
    await getSpotifyToken();
    
    // Renovar token cada 50 minutos
    setInterval(getSpotifyToken, config.spotify.tokenRefreshInterval);
    
    // Cargar configuraciones existentes de servidores
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
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'setup') {
        const channel = interaction.options.getChannel('canal');
        
        // Responder inmediatamente para evitar timeout
        await interaction.reply({
            content: '⏳ Configurando canal de música...',
            flags: 64 // Ephemeral flag
        });
        
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
            
            // Crear el panel de control en el nuevo canal
            await createControlPanel(interaction.guild.id);
            
            await interaction.editReply({
                content: `✅ Canal de música configurado correctamente en ${channel}.\n\n` +
                         `**Instrucciones:**\n` +
                         `• Escribe el nombre de una canción o pega una URL de YouTube/Spotify\n` +
                         `• Usa los emojis del panel de control para controlar la música\n` +
                         `• Todos los mensajes se eliminarán automáticamente para mantener el canal limpio`
            });
            
        } catch (error) {
            console.error('Error en comando /setup:', error);
            try {
                await interaction.editReply({
                    content: '❌ Ocurrió un error al configurar el canal. Inténtalo de nuevo.'
                });
            } catch (editError) {
                console.error('Error al editar respuesta:', editError);
            }
        }
    }
});

// Mantener el bot activo en producción (para Render/Heroku)
if (process.env.NODE_ENV === 'production') {
    require('./keep-alive');
    console.log('🌐 Keep-alive server iniciado para producción');
}

// Iniciar sesión del bot
client.login(process.env.DISCORD_TOKEN);

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
            
            // Agregar cada canción a la cola (SIN buscar en YouTube)
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
        if (ytdl.validateURL(url)) {
            const info = await ytdl.getInfo(url);
            const songInfo = {
                title: info.videoDetails.title,
                url: url,
                duration: parseInt(info.videoDetails.lengthSeconds),
                thumbnail: info.videoDetails.thumbnails[0]?.url || null,
                channel: info.videoDetails.author.name,
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
