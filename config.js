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
            highWaterMark: 1 << 25,
            dlChunkSize: 1024 * 1024 * 4, // 4MB chunks
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            }
        },
        
        // Configuración de búsqueda
        searchLimit: 1,
        
        // Configuración de cola
        maxQueueSize: 100,
        
        // Configuración de reintentos
        maxRetries: 3,
        retryDelay: 1000
    },
    
    // Configuración de Spotify
    spotify: {
        // Tiempo de renovación de token (en milisegundos)
        tokenRefreshInterval: 50 * 60 * 1000, // 50 minutos
        
        // Límite de búsqueda
        searchLimit: 1
    },
    
    // Configuración del modo radio
    radio: {
        enabled: true,
        minQueueSize: 2, // Activar radio cuando queden menos de 2 canciones
        maxSuggestions: 5, // Máximo de sugerencias a agregar por vez
        searchTerms: [
            'official music video',
            'official audio',
            'remix',
            'cover',
            'acoustic',
            'live',
            'session'
        ]
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
        queueFull: 'La cola está llena. Máximo de canciones permitidas:',
        radioEnabled: '🔀 Modo radio activado - Reproduciendo música similar...',
        radioDisabled: '📻 Modo radio desactivado'
    }
};

module.exports = config;
