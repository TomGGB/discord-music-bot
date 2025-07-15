const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const yts = require('youtube-sr').default;
const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');

// Configuración de variables de entorno
require('dotenv').config();

console.log('🔍 Verificando variables de entorno...');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'CONFIGURADO' : '❌ NO CONFIGURADO');
console.log('SPOTIFY_CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID ? 'CONFIGURADO' : '❌ NO CONFIGURADO');
console.log('SPOTIFY_CLIENT_SECRET:', process.env.SPOTIFY_CLIENT_SECRET ? 'CONFIGURADO' : '❌ NO CONFIGURADO');

// Verificar que el token existe
if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN no está configurado');
    process.exit(1);
}

// Configurar Spotify API
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

// Obtener token de Spotify
let spotifyToken = null;
async function getSpotifyToken() {
    if (!spotifyToken && process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
        try {
            const data = await spotifyApi.clientCredentialsGrant();
            spotifyToken = data.body['access_token'];
            spotifyApi.setAccessToken(spotifyToken);
            console.log('🎵 Token de Spotify obtenido exitosamente');
            
            // Renovar token cada 50 minutos
            setTimeout(() => {
                spotifyToken = null;
                getSpotifyToken();
            }, 50 * 60 * 1000);
        } catch (error) {
            console.error('❌ Error obteniendo token de Spotify:', error);
        }
    }
    return spotifyToken;
}

// Inicializar Spotify si las credenciales están disponibles
if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    getSpotifyToken();
}

// Cola de reproducción y estado del bot
const queues = new Map();
const players = new Map();

// Clase para manejar la cola de música
class MusicQueue {
    constructor(guildId) {
        this.guildId = guildId;
        this.songs = [];
        this.currentSong = null;
        this.isPlaying = false;
        this.connection = null;
        this.player = null;
        this.voiceChannel = null;
        this.textChannel = null;
        this.loop = false;
        this.volume = 0.5;
    }

    addSong(song) {
        this.songs.push(song);
    }

    nextSong() {
        if (this.loop && this.currentSong) {
            return this.currentSong;
        }
        return this.songs.shift();
    }

    clear() {
        this.songs = [];
        this.currentSong = null;
    }

    shuffle() {
        for (let i = this.songs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.songs[i], this.songs[j]] = [this.songs[j], this.songs[i]];
        }
    }
}

// Utilidades
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function isSpotifyUrl(url) {
    return url.includes('spotify.com');
}

function isYouTubeUrl(url) {
    return url.includes('youtube.com') || url.includes('youtu.be');
}

async function searchYouTube(query) {
    try {
        const results = await yts.search(query, { limit: 1 });
        return results[0];
    } catch (error) {
        console.error('Error buscando en YouTube:', error);
        return null;
    }
}

async function getSpotifyTrack(url) {
    try {
        await getSpotifyToken();
        const trackId = url.split('/track/')[1].split('?')[0];
        const track = await spotifyApi.getTrack(trackId);
        return {
            title: track.body.name,
            artist: track.body.artists.map(artist => artist.name).join(', '),
            duration: Math.floor(track.body.duration_ms / 1000),
            url: track.body.external_urls.spotify
        };
    } catch (error) {
        console.error('Error obteniendo track de Spotify:', error);
        return null;
    }
}

async function playSong(queue) {
    if (!queue.songs.length) {
        queue.isPlaying = false;
        return;
    }

    const song = queue.nextSong();
    if (!song) return;

    queue.currentSong = song;
    queue.isPlaying = true;

    try {
        let stream;
        if (song.url.includes('youtube.com') || song.url.includes('youtu.be')) {
            stream = ytdl(song.url, { 
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25
            });
        } else {
            // Para Spotify, buscar en YouTube
            const searchResult = await searchYouTube(`${song.title} ${song.artist}`);
            if (searchResult) {
                stream = ytdl(searchResult.url, { 
                    filter: 'audioonly',
                    quality: 'highestaudio',
                    highWaterMark: 1 << 25
                });
            } else {
                throw new Error('No se pudo encontrar el audio');
            }
        }

        const resource = createAudioResource(stream, {
            inputType: StreamType.Arbitrary,
        });

        queue.player.play(resource);

        // Enviar mensaje de "ahora reproduciendo"
        const embed = {
            color: 0x00ff00,
            title: '🎵 Ahora reproduciendo',
            description: `**${song.title}**\n${song.artist}`,
            fields: [
                { name: '⏱️ Duración', value: formatDuration(song.duration), inline: true },
                { name: '📋 En cola', value: queue.songs.length.toString(), inline: true }
            ],
            timestamp: new Date().toISOString()
        };

        await queue.textChannel.send({ embeds: [embed] });

    } catch (error) {
        console.error('Error reproduciendo canción:', error);
        queue.textChannel.send('❌ Error reproduciendo la canción. Saltando a la siguiente...');
        
        // Intentar siguiente canción
        setTimeout(() => playSong(queue), 1000);
    }
}

// Configuración del cliente Discord optimizada para Render
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ],
    // Configuración específica para Render
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
    }
});

// Servidor Express para health checks
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware básico
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    const status = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        bot: {
            ready: client.readyAt !== null,
            user: client.user ? client.user.tag : 'Not logged in',
            guilds: client.guilds.cache.size,
            ping: client.ws.ping
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
        user: client.user ? client.user.tag : 'Not logged in'
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

// Manejar errores del cliente
client.on('error', (error) => {
    console.error('❌ Error del cliente Discord:', error);
});

client.on('warn', (warning) => {
    console.warn('⚠️ Advertencia del cliente Discord:', warning);
});

client.on('debug', (debug) => {
    // Solo mostrar debug importante
    if (debug.includes('Heartbeat') || debug.includes('Identifying') || debug.includes('Ready')) {
        console.log('🔧 DEBUG:', debug);
    }
});

// Evento cuando el bot se conecta
client.on('ready', () => {
    console.log('✅ Bot conectado exitosamente!');
    console.log(`🤖 Loggeado como: ${client.user.tag}`);
    console.log(`🏠 Servidores: ${client.guilds.cache.size}`);
    console.log(`📡 Ping: ${client.ws.ping}ms`);
    
    // Establecer actividad del bot
    client.user.setActivity('música 🎵', { type: 2 }); // type 2 = LISTENING
    
    // Log de servidores
    client.guilds.cache.forEach(guild => {
        console.log(`📍 Servidor: ${guild.name} (${guild.id}) - Miembros: ${guild.memberCount}`);
    });
});

// Eventos de conexión
client.on('disconnect', (event) => {
    console.warn('⚠️ Bot desconectado:', event);
});

client.on('reconnecting', () => {
    console.log('🔄 Bot reconectando...');
});

client.on('guildCreate', (guild) => {
    console.log(`📍 Unido al servidor: ${guild.name} (${guild.id})`);
});

client.on('guildDelete', (guild) => {
    console.log(`📤 Salió del servidor: ${guild.name} (${guild.id})`);
});

// Manejo de mensajes con comandos de música
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;
    
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // Obtener o crear cola para el servidor
    let queue = queues.get(message.guild.id);
    
    try {
        switch (command) {
            case 'ping':
                await message.reply(`🏓 Pong! Latencia: ${client.ws.ping}ms`);
                break;
                
            case 'info':
                const embed = {
                    color: 0x00ff00,
                    title: '🎵 LanaMusic Bot',
                    description: 'Bot de música para Discord con soporte para YouTube y Spotify',
                    fields: [
                        { name: '📡 Ping', value: `${client.ws.ping}ms`, inline: true },
                        { name: '🏠 Servidores', value: `${client.guilds.cache.size}`, inline: true },
                        { name: '⏰ Uptime', value: `${Math.floor(client.uptime / 1000)}s`, inline: true },
                        { name: '🎵 Comandos', value: '`!play`, `!skip`, `!stop`, `!queue`, `!pause`, `!resume`', inline: false }
                    ],
                    timestamp: new Date().toISOString()
                };
                await message.reply({ embeds: [embed] });
                break;
                
            case 'play':
            case 'p':
                if (!args.length) {
                    return message.reply('❌ Proporciona una URL o término de búsqueda');
                }
                
                const voiceChannel = message.member.voice.channel;
                if (!voiceChannel) {
                    return message.reply('❌ Debes estar en un canal de voz');
                }
                
                const permissions = voiceChannel.permissionsFor(message.client.user);
                if (!permissions.has(PermissionsBitField.Flags.Connect) || !permissions.has(PermissionsBitField.Flags.Speak)) {
                    return message.reply('❌ No tengo permisos para conectar o hablar en tu canal de voz');
                }
                
                // Crear cola si no existe
                if (!queue) {
                    queue = new MusicQueue(message.guild.id);
                    queues.set(message.guild.id, queue);
                    
                    // Crear conexión de voz
                    const connection = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator,
                    });
                    
                    // Crear reproductor de audio
                    const player = createAudioPlayer();
                    connection.subscribe(player);
                    
                    queue.connection = connection;
                    queue.player = player;
                    queue.voiceChannel = voiceChannel;
                    queue.textChannel = message.channel;
                    
                    // Eventos del reproductor
                    player.on(AudioPlayerStatus.Idle, () => {
                        setTimeout(() => playSong(queue), 1000);
                    });
                    
                    player.on('error', (error) => {
                        console.error('Error en el reproductor:', error);
                        message.channel.send('❌ Error en la reproducción');
                    });
                }
                
                const searchTerm = args.join(' ');
                await message.reply('🔍 Buscando...');
                
                let song;
                if (isSpotifyUrl(searchTerm)) {
                    const spotifyTrack = await getSpotifyTrack(searchTerm);
                    if (spotifyTrack) {
                        song = {
                            title: spotifyTrack.title,
                            artist: spotifyTrack.artist,
                            duration: spotifyTrack.duration,
                            url: spotifyTrack.url,
                            requestedBy: message.author.tag
                        };
                    }
                } else if (isYouTubeUrl(searchTerm)) {
                    try {
                        const info = await ytdl.getInfo(searchTerm);
                        song = {
                            title: info.videoDetails.title,
                            artist: info.videoDetails.author.name,
                            duration: parseInt(info.videoDetails.lengthSeconds),
                            url: searchTerm,
                            requestedBy: message.author.tag
                        };
                    } catch (error) {
                        console.error('Error obteniendo info de YouTube:', error);
                    }
                } else {
                    // Buscar en YouTube
                    const searchResult = await searchYouTube(searchTerm);
                    if (searchResult) {
                        song = {
                            title: searchResult.title,
                            artist: searchResult.channel.name,
                            duration: searchResult.duration,
                            url: searchResult.url,
                            requestedBy: message.author.tag
                        };
                    }
                }
                
                if (!song) {
                    return message.reply('❌ No se encontró la canción');
                }
                
                queue.addSong(song);
                
                const addedEmbed = {
                    color: 0x00ff00,
                    title: '✅ Canción agregada',
                    description: `**${song.title}**\n${song.artist}`,
                    fields: [
                        { name: '⏱️ Duración', value: formatDuration(song.duration), inline: true },
                        { name: '👤 Solicitado por', value: song.requestedBy, inline: true },
                        { name: '📋 Posición en cola', value: queue.songs.length.toString(), inline: true }
                    ],
                    timestamp: new Date().toISOString()
                };
                
                await message.reply({ embeds: [addedEmbed] });
                
                if (!queue.isPlaying) {
                    playSong(queue);
                }
                break;
                
            case 'skip':
            case 's':
                if (!queue || !queue.isPlaying) {
                    return message.reply('❌ No hay música reproduciéndose');
                }
                
                queue.player.stop();
                await message.reply('⏭️ Canción saltada');
                break;
                
            case 'stop':
                if (!queue) {
                    return message.reply('❌ No hay música reproduciéndose');
                }
                
                queue.clear();
                queue.player.stop();
                queue.connection.destroy();
                queues.delete(message.guild.id);
                await message.reply('⏹️ Reproducción detenida y cola limpiada');
                break;
                
            case 'pause':
                if (!queue || !queue.isPlaying) {
                    return message.reply('❌ No hay música reproduciéndose');
                }
                
                queue.player.pause();
                await message.reply('⏸️ Reproducción pausada');
                break;
                
            case 'resume':
                if (!queue) {
                    return message.reply('❌ No hay música en cola');
                }
                
                queue.player.unpause();
                await message.reply('▶️ Reproducción reanudada');
                break;
                
            case 'queue':
            case 'q':
                if (!queue || !queue.songs.length) {
                    return message.reply('❌ La cola está vacía');
                }
                
                const queueEmbed = {
                    color: 0x00ff00,
                    title: '📋 Cola de reproducción',
                    fields: [],
                    timestamp: new Date().toISOString()
                };
                
                if (queue.currentSong) {
                    queueEmbed.fields.push({
                        name: '🎵 Reproduciendo ahora',
                        value: `**${queue.currentSong.title}**\n${queue.currentSong.artist}`,
                        inline: false
                    });
                }
                
                const upcoming = queue.songs.slice(0, 10).map((song, index) => {
                    return `${index + 1}. **${song.title}** - ${song.artist}`;
                }).join('\n');
                
                if (upcoming) {
                    queueEmbed.fields.push({
                        name: '⏭️ Próximas canciones',
                        value: upcoming,
                        inline: false
                    });
                }
                
                await message.reply({ embeds: [queueEmbed] });
                break;
                
            case 'loop':
                if (!queue) {
                    return message.reply('❌ No hay música en cola');
                }
                
                queue.loop = !queue.loop;
                await message.reply(`🔄 Loop ${queue.loop ? 'activado' : 'desactivado'}`);
                break;
                
            case 'shuffle':
                if (!queue || queue.songs.length < 2) {
                    return message.reply('❌ Se necesitan al menos 2 canciones en la cola');
                }
                
                queue.shuffle();
                await message.reply('🔀 Cola mezclada');
                break;
                
            case 'help':
                const helpEmbed = {
                    color: 0x00ff00,
                    title: '🎵 Comandos de LanaMusic',
                    fields: [
                        { name: '🎵 Reproducción', value: '`!play <canción>` - Reproduce una canción\n`!skip` - Salta la canción actual\n`!stop` - Detiene la reproducción\n`!pause` - Pausa la reproducción\n`!resume` - Reanuda la reproducción', inline: false },
                        { name: '📋 Cola', value: '`!queue` - Muestra la cola\n`!loop` - Activa/desactiva el loop\n`!shuffle` - Mezcla la cola', inline: false },
                        { name: 'ℹ️ Información', value: '`!info` - Información del bot\n`!ping` - Latencia del bot\n`!help` - Muestra esta ayuda', inline: false }
                    ],
                    timestamp: new Date().toISOString()
                };
                await message.reply({ embeds: [helpEmbed] });
                break;
                
            default:
                await message.reply('❌ Comando no reconocido. Usa `!help` para ver los comandos disponibles');
        }
    } catch (error) {
        console.error('Error procesando comando:', error);
        await message.reply('❌ Error procesando el comando');
    }
});

// Iniciar servidor Express
app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Servidor Express iniciado');
    console.log(`🔗 Disponible en: http://0.0.0.0:${PORT}`);
    console.log('📡 Endpoints: /, /health, /ping');
});

// Función para conectar el bot con reintentos
async function connectBot() {
    console.log('🔐 Iniciando conexión del bot...');
    
    try {
        await client.login(process.env.DISCORD_TOKEN);
        console.log('✅ Login exitoso');
    } catch (error) {
        console.error('❌ Error durante el login:', error);
        
        // Reintentar después de 10 segundos
        setTimeout(() => {
            console.log('🔄 Reintentando conexión...');
            connectBot();
        }, 10000);
    }
}

// Manejo de errores del proceso
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

// Manejo de señales de terminación
process.on('SIGINT', () => {
    console.log('📴 Cerrando bot...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('📴 Terminando bot...');
    client.destroy();
    process.exit(0);
});

// Iniciar el bot
connectBot();
