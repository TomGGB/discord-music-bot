const config = {
    // Configuración del bot
    bot: {
        // Prefijo para comandos especiales (opcional)
        prefix: '!',
        
        // Configuración de embeds
        embedColors: {
            success: '#00ff00',
            error: '#ff0000',
            info: '#0099ff',
            warning: '#ff9900',
            music: '#9b59b6'
        },
        
        // Configuración de reacciones
        reactions: {
            success: '✅',
            error: '❌',
            skip: '⏭️',
            stop: '⏹️',
            play: '▶️',
            pause: '⏸️'
        }
    },
    
    // Configuración de audio
    audio: {
        // Configuración de ytdl-core
        ytdlOptions: {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25
        },
        
        // Configuración de búsqueda
        searchLimit: 1,
        
        // Configuración de cola
        maxQueueSize: 100
    },
    
    // Configuración de Spotify
    spotify: {
        // Tiempo de renovación de token (en milisegundos)
        tokenRefreshInterval: 50 * 60 * 1000, // 50 minutos
        
        // Límite de búsqueda
        searchLimit: 1
    },
    
    // Mensajes del bot
    messages: {
        notInVoiceChannel: '¡Necesitas estar en un canal de voz para reproducir música!',
        songNotFound: 'No se pudo encontrar la canción. Intenta con otro nombre o URL.',
        queueEmpty: 'La cola está vacía.',
        nothingPlaying: 'No hay ninguna canción reproduciéndose actualmente.',
        error: 'Ocurrió un error al procesar tu solicitud. Intenta nuevamente.',
        botConnected: 'Bot conectado como',
        spotifyTokenObtained: 'Token de Spotify obtenido correctamente',
        spotifyTokenError: 'Error al obtener token de Spotify:',
        musicChannelConfigured: 'Canal de música configurado:',
        queueFull: 'La cola está llena. Máximo de canciones permitidas:'
    }
};

module.exports = config;
