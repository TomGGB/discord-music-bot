require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const yts = require('youtube-sr').default;
const SpotifyWebApi = require('spotify-web-api-node');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Configuración de Spotify
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

// Variables globales
let connection = null;
let player = null;
let queue = [];
let isPlaying = false;
let currentSong = null;
let musicChannel = null;

// Función para obtener token de Spotify
async function getSpotifyToken() {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body['access_token']);
        console.log('Token de Spotify obtenido correctamente');
    } catch (error) {
        console.error('Error al obtener token de Spotify:', error);
    }
}

// Función para buscar en Spotify
async function searchSpotify(query) {
    try {
        const results = await spotifyApi.searchTracks(query, { limit: 1 });
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

// Función para buscar en YouTube
async function searchYouTube(query) {
    try {
        const results = await yts.search(query, { limit: 1 });
        if (results.length > 0) {
            const video = results[0];
            return {
                title: video.title,
                url: video.url,
                duration: video.duration,
                thumbnail: video.thumbnail?.url || null,
                channel: video.channel?.name || 'Desconocido'
            };
        }
        return null;
    } catch (error) {
        console.error('Error al buscar en YouTube:', error);
        return null;
    }
}

// Función para reproducir música
async function playMusic(voiceChannel, textChannel) {
    if (queue.length === 0) {
        isPlaying = false;
        return;
    }

    const song = queue[0];
    currentSong = song;
    isPlaying = true;

    try {
        // Conectar al canal de voz si no está conectado
        if (!connection) {
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });
        }

        // Crear el recurso de audio
        const stream = ytdl(song.url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25
        });

        const resource = createAudioResource(stream);

        // Crear el reproductor si no existe
        if (!player) {
            player = createAudioPlayer();
            connection.subscribe(player);
        }

        // Reproducir la canción
        player.play(resource);

        // Crear embed con información de la canción
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎵 Reproduciendo ahora')
            .setDescription(`**${song.title}**`)
            .addFields(
                { name: 'Canal', value: song.channel, inline: true },
                { name: 'Duración', value: formatDuration(song.duration), inline: true }
            )
            .setThumbnail(song.thumbnail)
            .setFooter({ text: `Canciones en cola: ${queue.length - 1}` });

        textChannel.send({ embeds: [embed] });

        // Manejar eventos del reproductor
        player.on(AudioPlayerStatus.Idle, () => {
            queue.shift(); // Remover la canción actual de la cola
            playMusic(voiceChannel, textChannel); // Reproducir la siguiente canción
        });

        player.on('error', (error) => {
            console.error('Error en el reproductor:', error);
            queue.shift();
            playMusic(voiceChannel, textChannel);
        });

    } catch (error) {
        console.error('Error al reproducir música:', error);
        queue.shift();
        playMusic(voiceChannel, textChannel);
    }
}

// Función para formatear duración
function formatDuration(duration) {
    if (typeof duration === 'string') {
        return duration;
    }
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Función para detectar URLs de Spotify
function isSpotifyUrl(url) {
    return url.includes('spotify.com/track/') || url.includes('spotify:track:');
}

// Función para detectar URLs de YouTube
function isYouTubeUrl(url) {
    return url.includes('youtube.com/watch') || url.includes('youtu.be/');
}

// Función para procesar el mensaje
async function processMessage(message) {
    const content = message.content.trim();
    
    // Ignorar mensajes vacíos
    if (!content) return;

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
        message.react('❌');
        return message.reply('¡Necesitas estar en un canal de voz para reproducir música!');
    }

    let songInfo = null;

    try {
        // Detectar si es una URL de Spotify
        if (isSpotifyUrl(content)) {
            const trackId = content.split('/track/')[1]?.split('?')[0] || content.split('track:')[1];
            if (trackId) {
                const track = await spotifyApi.getTrack(trackId);
                const spotifyTrack = {
                    title: track.body.name,
                    artist: track.body.artists[0].name,
                    searchQuery: `${track.body.name} ${track.body.artists[0].name}`
                };
                
                // Buscar en YouTube usando la información de Spotify
                songInfo = await searchYouTube(spotifyTrack.searchQuery);
                if (songInfo) {
                    songInfo.source = 'Spotify → YouTube';
                }
            }
        }
        // Detectar si es una URL de YouTube
        else if (isYouTubeUrl(content)) {
            if (ytdl.validateURL(content)) {
                const info = await ytdl.getInfo(content);
                songInfo = {
                    title: info.videoDetails.title,
                    url: content,
                    duration: parseInt(info.videoDetails.lengthSeconds),
                    thumbnail: info.videoDetails.thumbnails[0]?.url || null,
                    channel: info.videoDetails.author.name,
                    source: 'YouTube'
                };
            }
        }
        // Buscar por nombre en Spotify primero, luego en YouTube
        else {
            // Intentar buscar en Spotify primero
            const spotifyResult = await searchSpotify(content);
            if (spotifyResult) {
                songInfo = await searchYouTube(spotifyResult.searchQuery);
                if (songInfo) {
                    songInfo.source = 'Spotify → YouTube';
                }
            }
            
            // Si no se encontró en Spotify, buscar directamente en YouTube
            if (!songInfo) {
                songInfo = await searchYouTube(content);
                if (songInfo) {
                    songInfo.source = 'YouTube';
                }
            }
        }

        if (!songInfo) {
            message.react('❌');
            return message.reply('No se pudo encontrar la canción. Intenta con otro nombre o URL.');
        }

        // Añadir a la cola
        queue.push(songInfo);

        // Crear embed para canción añadida
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Canción añadida a la cola')
            .setDescription(`**${songInfo.title}**`)
            .addFields(
                { name: 'Canal', value: songInfo.channel, inline: true },
                { name: 'Duración', value: formatDuration(songInfo.duration), inline: true },
                { name: 'Fuente', value: songInfo.source, inline: true },
                { name: 'Posición en cola', value: queue.length.toString(), inline: true }
            )
            .setThumbnail(songInfo.thumbnail);

        message.reply({ embeds: [embed] });
        message.react('✅');

        // Si no está reproduciendo, empezar a reproducir
        if (!isPlaying) {
            playMusic(voiceChannel, message.channel);
        }

    } catch (error) {
        console.error('Error al procesar mensaje:', error);
        message.react('❌');
        message.reply('Ocurrió un error al procesar tu solicitud. Intenta nuevamente.');
    }
}

// Eventos del bot
client.on('ready', async () => {
    console.log(`Bot conectado como ${client.user.tag}`);
    
    // Obtener token de Spotify
    await getSpotifyToken();
    
    // Renovar token cada 50 minutos
    setInterval(getSpotifyToken, 50 * 60 * 1000);
    
    // Obtener el canal de música
    if (process.env.MUSIC_CHANNEL_ID) {
        musicChannel = client.channels.cache.get(process.env.MUSIC_CHANNEL_ID);
        if (musicChannel) {
            console.log(`Canal de música configurado: ${musicChannel.name}`);
        }
    }
});

client.on('messageCreate', async (message) => {
    // Ignorar mensajes del bot
    if (message.author.bot) return;
    
    // Solo procesar mensajes del canal de música configurado
    if (process.env.MUSIC_CHANNEL_ID && message.channel.id !== process.env.MUSIC_CHANNEL_ID) {
        return;
    }
    
    // Comandos especiales
    if (message.content.toLowerCase() === '!skip') {
        if (player) {
            player.stop();
            message.react('⏭️');
        }
        return;
    }
    
    if (message.content.toLowerCase() === '!stop') {
        queue = [];
        if (player) {
            player.stop();
        }
        if (connection) {
            connection.destroy();
            connection = null;
        }
        isPlaying = false;
        message.react('⏹️');
        return;
    }
    
    if (message.content.toLowerCase() === '!queue') {
        if (queue.length === 0) {
            return message.reply('La cola está vacía.');
        }
        
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('🎵 Cola de reproducción')
            .setDescription(
                queue.map((song, index) => 
                    `${index + 1}. **${song.title}** - ${formatDuration(song.duration)}`
                ).join('\n')
            )
            .setFooter({ text: `Total: ${queue.length} canciones` });
        
        return message.reply({ embeds: [embed] });
    }
    
    if (message.content.toLowerCase() === '!current') {
        if (currentSong) {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🎵 Reproduciendo ahora')
                .setDescription(`**${currentSong.title}**`)
                .addFields(
                    { name: 'Canal', value: currentSong.channel, inline: true },
                    { name: 'Duración', value: formatDuration(currentSong.duration), inline: true }
                )
                .setThumbnail(currentSong.thumbnail);
            
            return message.reply({ embeds: [embed] });
        } else {
            return message.reply('No hay ninguna canción reproduciéndose actualmente.');
        }
    }
    
    // Procesar como búsqueda de música
    await processMessage(message);
});

// Iniciar el bot
client.login(process.env.DISCORD_TOKEN);
