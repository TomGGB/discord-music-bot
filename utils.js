const { EmbedBuilder } = require('discord.js');
const config = require('./config');

/**
 * Formatea la duración en segundos a formato mm:ss
 * @param {number|string} duration - Duración en segundos o string
 * @returns {string} Duración formateada
 */
function formatDuration(duration) {
    if (typeof duration === 'number') {
        // Si es número, verificar si está en milisegundos
        let seconds = duration;
        if (duration > 10000) {
            // Probablemente esté en milisegundos
            seconds = Math.floor(duration / 1000);
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    if (typeof duration === 'string') {
        // Si es string, verificar si tiene formato de tiempo (mm:ss o hh:mm:ss)
        if (duration.includes(':')) {
            const parts = duration.split(':');
            if (parts.length === 2) {
                const [minutes, seconds] = parts.map(Number);
                // Si los minutos son muy grandes (como 6000), probablemente sea un error
                if (minutes > 120) {
                    // Probablemente sea segundos mal formateados
                    const totalSeconds = minutes;
                    const realMinutes = Math.floor(totalSeconds / 60);
                    const realSeconds = totalSeconds % 60;
                    return `${realMinutes}:${realSeconds.toString().padStart(2, '0')}`;
                }
                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
            } else if (parts.length === 3) {
                const [hours, minutes, seconds] = parts.map(Number);
                const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                const finalMinutes = Math.floor(totalSeconds / 60);
                const finalSeconds = totalSeconds % 60;
                return `${finalMinutes}:${finalSeconds.toString().padStart(2, '0')}`;
            }
        }
        // Si es string pero no tiene formato, intentar convertir a número
        const num = parseInt(duration);
        if (!isNaN(num)) {
            return formatDuration(num); // Recursivo para procesar como número
        }
        return duration;
    }
    
    return '0:00';
}

/**
 * Crea un embed para una canción añadida a la cola
 * @param {Object} songInfo - Información de la canción
 * @param {number} queuePosition - Posición en la cola
 * @returns {EmbedBuilder} Embed configurado
 */
function createQueueEmbed(songInfo, queuePosition) {
    return new EmbedBuilder()
        .setColor(config.bot.embedColors.success)
        .setTitle('✅ Canción añadida a la cola')
        .setDescription(`**${songInfo.title}**`)
        .addFields(
            { name: 'Canal', value: songInfo.channel || 'Desconocido', inline: true },
            { name: 'Duración', value: formatDuration(songInfo.duration), inline: true },
            { name: 'Fuente', value: songInfo.source || 'YouTube', inline: true },
            { name: 'Posición en cola', value: queuePosition.toString(), inline: true }
        )
        .setThumbnail(songInfo.thumbnail)
        .setTimestamp();
}

/**
 * Crea un embed para la canción que se está reproduciendo
 * @param {Object} songInfo - Información de la canción
 * @param {number} queueLength - Longitud de la cola
 * @returns {EmbedBuilder} Embed configurado
 */
function createNowPlayingEmbed(songInfo, queueLength) {
    return new EmbedBuilder()
        .setColor(config.bot.embedColors.info)
        .setTitle('🎵 Reproduciendo ahora')
        .setDescription(`**${songInfo.title}**`)
        .addFields(
            { name: 'Canal', value: songInfo.channel || 'Desconocido', inline: true },
            { name: 'Duración', value: formatDuration(songInfo.duration), inline: true },
            { name: 'Fuente', value: songInfo.source || 'YouTube', inline: true }
        )
        .setThumbnail(songInfo.thumbnail)
        .setFooter({ text: `Canciones en cola: ${queueLength - 1}` })
        .setTimestamp();
}

/**
 * Crea un embed para mostrar la cola de reproducción
 * @param {Array} queue - Cola de canciones
 * @returns {EmbedBuilder} Embed configurado
 */
function createQueueListEmbed(queue) {
    const description = queue.map((song, index) => 
        `${index + 1}. **${song.title}** - ${formatDuration(song.duration)}`
    ).join('\n');

    return new EmbedBuilder()
        .setColor(config.bot.embedColors.warning)
        .setTitle('🎵 Cola de reproducción')
        .setDescription(description.length > 4096 ? description.substring(0, 4093) + '...' : description)
        .setFooter({ text: `Total: ${queue.length} canciones` })
        .setTimestamp();
}

/**
 * Crea un embed para mostrar información de la canción actual
 * @param {Object} currentSong - Canción actual
 * @returns {EmbedBuilder} Embed configurado
 */
function createCurrentSongEmbed(currentSong) {
    return new EmbedBuilder()
        .setColor(config.bot.embedColors.info)
        .setTitle('🎵 Reproduciendo ahora')
        .setDescription(`**${currentSong.title}**`)
        .addFields(
            { name: 'Canal', value: currentSong.channel || 'Desconocido', inline: true },
            { name: 'Duración', value: formatDuration(currentSong.duration), inline: true },
            { name: 'Fuente', value: currentSong.source || 'YouTube', inline: true }
        )
        .setThumbnail(currentSong.thumbnail)
        .setTimestamp();
}

/**
 * Crea un embed de error
 * @param {string} message - Mensaje de error
 * @returns {EmbedBuilder} Embed configurado
 */
function createErrorEmbed(message) {
    return new EmbedBuilder()
        .setColor(config.bot.embedColors.error)
        .setTitle('❌ Error')
        .setDescription(message)
        .setTimestamp();
}

/**
 * Crea un embed para el panel de control persistente
 * @param {Object} botState - Estado actual del bot
 * @returns {EmbedBuilder} Embed configurado
 */
function createControlPanelEmbed(botState) {
    const { currentSong, queue, isPlaying, isPaused } = botState;
    
    // Crear embed principal con diseño moderno
    const embed = new EmbedBuilder()
        .setColor(isPlaying ? 0x00FF00 : (isPaused ? 0xFFFF00 : 0xFF0000))
        .setTitle('🎵 ┃ **PANEL DE CONTROL MUSICAL** ┃ 🎵')
        .setTimestamp();
    
    // Información de la canción actual
    if (currentSong) {
        const songTitle = currentSong.title.length > 40 ? currentSong.title.substring(0, 40) + '...' : currentSong.title;
        const channel = currentSong.channel || 'Desconocido';
        const duration = formatDuration(currentSong.duration);
        const source = currentSong.source || 'YouTube';
        
        embed.addFields(
            { 
                name: '� **REPRODUCIENDO AHORA**', 
                value: `**${songTitle}**\n🎤 ${channel} • ⏱️ ${duration} • 🔗 ${source}`, 
                inline: false 
            }
        );
    } else {
        embed.addFields(
            { 
                name: '⏸️ **ESTADO ACTUAL**', 
                value: '```Sin música reproduciéndose```', 
                inline: false 
            }
        );
    }
    
    // Información de la cola y estado (usando campos inline para aprovechar espacio horizontal)
    const queueInfo = queue.length > 0 ? `${queue.length} canciones` : 'Cola vacía';
    const statusInfo = isPlaying ? (isPaused ? '⏸️ Pausado' : '▶️ Reproduciendo') : '⏹️ Detenido';
    
    embed.addFields(
        { name: '📋 **COLA DE REPRODUCCIÓN**', value: `\`\`\`${queueInfo}\`\`\``, inline: true },
        { name: '⏯️ **ESTADO ACTUAL**', value: `\`\`\`${statusInfo}\`\`\``, inline: true },
        { name: '🔊 **VOLUMEN**', value: '```50%```', inline: true }
    );
    
    // Próximas canciones en la cola
    if (queue.length > 1) {
        const nextSongs = queue.slice(1, 4).map((song, index) => {
            const title = song.title.length > 35 ? song.title.substring(0, 35) + '...' : song.title;
            return `${index + 1}. **${title}**`;
        }).join('\n');
        
        embed.addFields(
            { 
                name: '📈 **PRÓXIMAS CANCIONES**', 
                value: nextSongs + (queue.length > 4 ? `\n... y ${queue.length - 4} más` : ''), 
                inline: false 
            }
        );
    }
    
    // Controles con diseño mejorado
    const radioStatus = botState.radioMode?.enabled ? '🔀 **Radio: ON**' : '📻 **Radio: OFF**';
    const controls = [
        '⏸️ **Pausar/Reanudar** │ ⏹️ **Detener** │ ⏭️ **Siguiente**',
        '📋 **Ver Cola** │ 🔄 **Actualizar** │ 🔀 **Mezclar** │ 🗑️ **Limpiar**',
        `📻 **Modo Radio** │ ${radioStatus}`
    ].join('\n');
    
    embed.addFields(
        { 
            name: '🎮 **CONTROLES DISPONIBLES**', 
            value: `\`\`\`${controls}\`\`\``, 
            inline: false 
        }
    );
    
    // Footer con información adicional
    embed.setFooter({ 
        text: `🎵 Bot de Música • Reacciona con los emojis para controlar la reproducción • ${new Date().toLocaleTimeString()}`,
        iconURL: 'https://cdn.discordapp.com/emojis/741305859230236672.png'
    });
    
    return embed;
}

/**
 * Crea un embed para mostrar que una canción fue agregada y almacenada
 * @param {string} songTitle - Título de la canción
 * @param {number} queuePosition - Posición en la cola
 * @returns {EmbedBuilder} Embed configurado
 */
function createSongAddedEmbed(songTitle, queuePosition) {
    return new EmbedBuilder()
        .setColor(config.bot.embedColors.success)
        .setTitle('✅ Canción Agregada')
        .setDescription(`**${songTitle}** ha sido agregada a la cola`)
        .addFields(
            { name: 'Posición', value: queuePosition.toString(), inline: true },
            { name: 'Estado', value: 'Almacenada correctamente', inline: true }
        )
        .setTimestamp();
}

/**
 * Crea un embed para una playlist agregada
 * @param {string} playlistName - Nombre de la playlist
 * @param {number} trackCount - Número de canciones en la playlist
 * @param {string} source - Fuente de la playlist (Spotify/YouTube)
 * @returns {EmbedBuilder} Embed configurado
 */
function createPlaylistAddedEmbed(playlistName, trackCount, source) {
    const sourceIcon = source === 'Spotify' ? '🎵' : '📺';
    const sourceColor = source === 'Spotify' ? 0x1DB954 : 0xFF0000;
    
    return new EmbedBuilder()
        .setColor(sourceColor)
        .setTitle(`${sourceIcon} ┃ **PLAYLIST AGREGADA** ┃ ${sourceIcon}`)
        .setDescription(`**${playlistName}**`)
        .addFields(
            { name: '📊 **Canciones**', value: `\`\`\`${trackCount} tracks\`\`\``, inline: true },
            { name: '🔗 **Fuente**', value: `\`\`\`${source}\`\`\``, inline: true },
            { name: '⚡ **Estado**', value: '```Agregando...```', inline: true }
        )
        .setFooter({ text: `${source} • ${new Date().toLocaleTimeString()}` })
        .setTimestamp();
}

/**
 * Detecta si una URL es de Spotify
 * @param {string} url - URL a verificar
 * @returns {boolean} True si es URL de Spotify
 */
function isSpotifyUrl(url) {
    const spotifyPatterns = [
        /spotify\.com\/track\//,
        /spotify\.com\/intl-[a-z]{2}\/track\//,
        /open\.spotify\.com\/track\//,
        /open\.spotify\.com\/intl-[a-z]{2}\/track\//,
        /spotify:track:/,
        /spotify\.link\//
    ];
    
    return spotifyPatterns.some(pattern => pattern.test(url));
}

/**
 * Detecta si una URL es de YouTube
 * @param {string} url - URL a verificar
 * @returns {boolean} True si es URL de YouTube
 */
function isYouTubeUrl(url) {
    const youtubePatterns = [
        /youtube\.com\/watch/,
        /youtu\.be\//,
        /music\.youtube\.com\/watch/,
        /youtube\.com\/shorts\//
    ];
    
    return youtubePatterns.some(pattern => pattern.test(url));
}

/**
 * Detecta si una URL es de una playlist de Spotify
 * @param {string} url - URL a verificar
 * @returns {boolean} True si es URL de playlist de Spotify
 */
function isSpotifyPlaylistUrl(url) {
    const spotifyPlaylistPatterns = [
        /spotify\.com\/playlist\//,
        /spotify\.com\/intl-[a-z]{2}\/playlist\//,
        /open\.spotify\.com\/playlist\//,
        /open\.spotify\.com\/intl-[a-z]{2}\/playlist\//,
        /spotify:playlist:/
    ];
    
    return spotifyPlaylistPatterns.some(pattern => pattern.test(url));
}

/**
 * Detecta si una URL es de una playlist de YouTube
 * @param {string} url - URL a verificar
 * @returns {boolean} True si es URL de playlist de YouTube
 */
function isYouTubePlaylistUrl(url) {
    const youtubePlaylistPatterns = [
        /youtube\.com\/playlist/,
        /youtube\.com\/watch.*[&?]list=/,
        /music\.youtube\.com\/playlist/,
        /music\.youtube\.com\/watch.*[&?]list=/
    ];
    
    return youtubePlaylistPatterns.some(pattern => pattern.test(url));
}

/**
 * Detecta si una URL es de un álbum de Spotify
 * @param {string} url - URL a verificar
 * @returns {boolean} True si es URL de álbum de Spotify
 */
function isSpotifyAlbumUrl(url) {
    const albumPatterns = [
        /spotify\.com\/album\//,
        /spotify\.com\/intl-[a-z]{2}\/album\//,
        /open\.spotify\.com\/album\//,
        /open\.spotify\.com\/intl-[a-z]{2}\/album\//,
        /spotify:album:/
    ];
    
    return albumPatterns.some(pattern => pattern.test(url));
}

/**
 * Detecta si una URL es de un artista de Spotify
 * @param {string} url - URL a verificar
 * @returns {boolean} True si es URL de artista de Spotify
 */
function isSpotifyArtistUrl(url) {
    const artistPatterns = [
        /spotify\.com\/artist\//,
        /spotify\.com\/intl-[a-z]{2}\/artist\//,
        /open\.spotify\.com\/artist\//,
        /open\.spotify\.com\/intl-[a-z]{2}\/artist\//,
        /spotify:artist:/
    ];
    
    return artistPatterns.some(pattern => pattern.test(url));
}

/**
 * Detecta si una URL es de una canción individual de YouTube
 * @param {string} url - URL a verificar
 * @returns {boolean} True si es URL de canción de YouTube
 */
function isYouTubeSongUrl(url) {
    const youtubeSongPatterns = [
        /youtube\.com\/watch\?v=/,
        /youtu\.be\/[a-zA-Z0-9_-]{11}$/,
        /music\.youtube\.com\/watch\?v=/,
        /youtube\.com\/shorts\/[a-zA-Z0-9_-]{11}$/
    ];
    
    return youtubeSongPatterns.some(pattern => pattern.test(url));
}

/**
 * Detecta si una URL es de un artista de YouTube
 * @param {string} url - URL a verificar  
 * @returns {boolean} True si es URL de artista de YouTube
 */
function isYouTubeArtistUrl(url) {
    const youtubeArtistPatterns = [
        /youtube\.com\/channel\/[a-zA-Z0-9_-]+$/,
        /youtube\.com\/c\/[a-zA-Z0-9_-]+$/,
        /youtube\.com\/@[a-zA-Z0-9_.-]+$/,
        /youtube\.com\/user\/[a-zA-Z0-9_-]+$/,
        /music\.youtube\.com\/channel\/[a-zA-Z0-9_-]+$/
    ];
    
    return youtubeArtistPatterns.some(pattern => pattern.test(url));
}

/**
 * Extrae el ID del canal de YouTube
 * @param {string} url - URL del canal de YouTube
 * @returns {string|null} ID del canal o null si no es válido
 */
function extractYouTubeChannelId(url) {
    const channelPatterns = [
        /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
        /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
        /youtube\.com\/@([a-zA-Z0-9_.-]+)/,
        /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
        /music\.youtube\.com\/channel\/([a-zA-Z0-9_-]+)$/
    ];
    
    for (const pattern of channelPatterns) {
        const match = url.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    return null;
}

/**
 * Extrae el ID de track de una URL de Spotify
 * @param {string} url - URL de Spotify
 * @returns {string|null} ID del track o null si no se encuentra
 */
function extractSpotifyTrackId(url) {
    // Manejar diferentes formatos de URLs de Spotify
    const patterns = [
        /track\/([a-zA-Z0-9]+)/,                    // https://open.spotify.com/track/ID
        /intl-[a-z]{2}\/track\/([a-zA-Z0-9]+)/,    // https://open.spotify.com/intl-es/track/ID
        /spotify:track:([a-zA-Z0-9]+)/,            // spotify:track:ID
        /spotify\.link\/([a-zA-Z0-9]+)/            // https://spotify.link/ID
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            // Devolver el último grupo que coincida (para manejar intl-es)
            return match[match.length - 1];
        }
    }
    
    return null;
}

/**
 * Extrae el ID de playlist de una URL de Spotify
 * @param {string} url - URL de Spotify
 * @returns {string|null} ID de la playlist o null si no se encuentra
 */
function extractSpotifyPlaylistId(url) {
    const patterns = [
        /playlist\/([a-zA-Z0-9]+)/,
        /intl-[a-z]{2}\/playlist\/([a-zA-Z0-9]+)/,
        /spotify:playlist:([a-zA-Z0-9]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return match[match.length - 1];
        }
    }
    
    return null;
}

/**
 * Extrae el ID de playlist de una URL de YouTube
 * @param {string} url - URL de YouTube
 * @returns {string|null} ID de la playlist o null si no se encuentra
 */
function extractYouTubePlaylistId(url) {
    const patterns = [
        /[&?]list=([a-zA-Z0-9_-]+)/,
        /playlist\?list=([a-zA-Z0-9_-]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    return null;
}

/**
 * Extrae el ID de álbum de una URL de Spotify
 * @param {string} url - URL de álbum de Spotify
 * @returns {string|null} ID del álbum o null si no se encuentra
 */
function extractSpotifyAlbumId(url) {
    const patterns = [
        /album\/([a-zA-Z0-9]+)/,
        /intl-[a-z]{2}\/album\/([a-zA-Z0-9]+)/,
        /spotify:album:([a-zA-Z0-9]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return match[match.length - 1];
        }
    }
    
    return null;
}

/**
 * Extrae el ID de artista de una URL de Spotify
 * @param {string} url - URL de artista de Spotify
 * @returns {string|null} ID del artista o null si no se encuentra
 */
function extractSpotifyArtistId(url) {
    const patterns = [
        /artist\/([a-zA-Z0-9]+)/,
        /intl-[a-z]{2}\/artist\/([a-zA-Z0-9]+)/,
        /spotify:artist:([a-zA-Z0-9]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return match[match.length - 1];
        }
    }
    
    return null;
}

/**
 * Crea un embed para un álbum agregado
 * @param {string} albumName - Nombre del álbum
 * @param {string} artistName - Nombre del artista
 * @param {number} trackCount - Número de canciones en el álbum
 * @returns {EmbedBuilder} Embed configurado
 */
function createAlbumAddedEmbed(albumName, artistName, trackCount) {
    return new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle('💿 ┃ **ÁLBUM DE SPOTIFY AGREGADO** ┃ 💿')
        .setDescription(`**${albumName}**\n*por ${artistName}*`)
        .addFields(
            { name: '🎵 **Canciones**', value: `\`\`\`${trackCount} tracks\`\`\``, inline: true },
            { name: '🔗 **Fuente**', value: '```Spotify```', inline: true },
            { name: '⚡ **Estado**', value: '```Agregando...```', inline: true }
        )
        .setFooter({ text: `Spotify • ${new Date().toLocaleTimeString()}` })
        .setTimestamp();
}

/**
 * Crea un embed para un artista agregado
 * @param {string} artistName - Nombre del artista
 * @param {number} trackCount - Número de canciones principales
 * @returns {EmbedBuilder} Embed configurado
 */
function createArtistAddedEmbed(artistName, trackCount) {
    return new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle('🎤 ┃ **ARTISTA DE SPOTIFY AGREGADO** ┃ 🎤')
        .setDescription(`**${artistName}**\n*Canciones principales*`)
        .addFields(
            { name: '🎵 **Canciones**', value: `\`\`\`${trackCount} tracks\`\`\``, inline: true },
            { name: '🔗 **Fuente**', value: '```Spotify```', inline: true },
            { name: '⚡ **Estado**', value: '```Agregando...```', inline: true }
        )
        .setFooter({ text: `Spotify • ${new Date().toLocaleTimeString()}` })
        .setTimestamp();
}

/**
 * Crea un embed para una canción individual de YouTube agregada
 * @param {string} songTitle - Título de la canción
 * @param {string} channel - Canal de YouTube
 * @param {number} queuePosition - Posición en la cola
 * @returns {EmbedBuilder} Embed configurado
 */
function createYouTubeSongAddedEmbed(songTitle, channel, queuePosition) {
    const shortTitle = songTitle.length > 50 ? songTitle.substring(0, 50) + '...' : songTitle;
    
    return new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('📺 ┃ **CANCIÓN DE YOUTUBE AGREGADA** ┃ 📺')
        .setDescription(`**${shortTitle}**`)
        .addFields(
            { name: '🎤 **Canal**', value: `\`\`\`${channel}\`\`\``, inline: true },
            { name: '📝 **Posición**', value: `\`\`\`#${queuePosition}\`\`\``, inline: true },
            { name: '🔗 **Fuente**', value: '```YouTube```', inline: true }
        )
        .setFooter({ text: `YouTube • ${new Date().toLocaleTimeString()}` })
        .setTimestamp();
}

/**
 * Crea un embed para un artista/canal de YouTube agregado
 * @param {string} channelName - Nombre del canal/artista
 * @param {number} videoCount - Número de videos agregados
 * @returns {EmbedBuilder} Embed configurado
 */
function createYouTubeArtistAddedEmbed(channelName, videoCount) {
    return new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🎤 ┃ **CANAL DE YOUTUBE AGREGADO** ┃ 🎤')
        .setDescription(`**${channelName}**`)
        .addFields(
            { name: '🎵 **Videos**', value: `\`\`\`${videoCount} videos\`\`\``, inline: true },
            { name: '🌐 **Fuente**', value: '```YouTube```', inline: true },
            { name: '⚡ **Estado**', value: '```Agregando...```', inline: true }
        )
        .setFooter({ text: `YouTube • ${new Date().toLocaleTimeString()}` })
        .setTimestamp();
}

/**
 * Crea un embed para una canción de Spotify agregada
 * @param {string} songTitle - Título de la canción
 * @param {string} artist - Artista
 * @param {string} album - Álbum
 * @param {number} queuePosition - Posición en la cola
 * @returns {EmbedBuilder} Embed configurado
 */
function createSpotifySongAddedEmbed(songTitle, artist, album, queuePosition) {
    const shortTitle = songTitle.length > 50 ? songTitle.substring(0, 50) + '...' : songTitle;
    
    return new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle('🎵 ┃ **CANCIÓN DE SPOTIFY AGREGADA** ┃ 🎵')
        .setDescription(`**${shortTitle}**`)
        .addFields(
            { name: '🎤 **Artista**', value: `\`\`\`${artist}\`\`\``, inline: true },
            { name: '💿 **Álbum**', value: `\`\`\`${album}\`\`\``, inline: true },
            { name: '📝 **Posición**', value: `\`\`\`#${queuePosition}\`\`\``, inline: true }
        )
        .setFooter({ text: `Spotify • ${new Date().toLocaleTimeString()}` })
        .setTimestamp();
}

/**
 * Crea un embed para notificar que el modo radio está activo
 * @param {number} songsAdded - Número de canciones agregadas
 * @param {string} referenceSong - Canción de referencia
 * @returns {EmbedBuilder} Embed configurado
 */
function createRadioModeEmbed(songsAdded, referenceSong) {
    return new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🔀 ┃ **MODO RADIO ACTIVADO** ┃ 🔀')
        .setDescription(`**Reproduciendo música similar a:**\n*${referenceSong}*`)
        .addFields(
            { name: '🎵 **Canciones agregadas**', value: `\`\`\`${songsAdded} sugerencias\`\`\``, inline: true },
            { name: '🎯 **Modo**', value: '```Radio automático```', inline: true },
            { name: '⚡ **Estado**', value: '```Buscando similar...```', inline: true }
        )
        .setFooter({ text: `Modo Radio • ${new Date().toLocaleTimeString()}` })
        .setTimestamp();
}

/**
 * Extrae el título de la canción del objeto songInfo
 * @param {Object} songInfo - Información de la canción
 * @returns {string} Título de la canción
 */
function extractSongTitle(songInfo) {
    if (!songInfo) return 'Canción desconocida';
    
    // Si tiene información de Spotify, usar esa
    if (songInfo.spotifyInfo) {
        return `${songInfo.spotifyInfo.title} - ${songInfo.spotifyInfo.artist}`;
    }
    
    // Si tiene información de álbum, usar esa
    if (songInfo.albumInfo) {
        return `${songInfo.title} - ${songInfo.albumInfo.artist}`;
    }
    
    // Si tiene información de artista, usar esa
    if (songInfo.artistInfo) {
        return `${songInfo.title} - ${songInfo.artistInfo.artistName}`;
    }
    
    // Si tiene canal de YouTube, usarlo
    if (songInfo.channel) {
        return `${songInfo.title} - ${songInfo.channel}`;
    }
    
    // Por defecto, solo el título
    return songInfo.title || 'Canción desconocida';
}

/**
 * Limpia el texto de búsqueda
 * @param {string} text - Texto a limpiar
 * @returns {string} Texto limpio
 */
function cleanSearchText(text) {
    return text.trim().replace(/\s+/g, ' ');
}

module.exports = {
    formatDuration,
    createQueueEmbed,
    createNowPlayingEmbed,
    createQueueListEmbed,
    createCurrentSongEmbed,
    createErrorEmbed,
    createControlPanelEmbed,
    createSongAddedEmbed,
    createPlaylistAddedEmbed,
    createAlbumAddedEmbed,
    createArtistAddedEmbed,
    createRadioModeEmbed,
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
};
