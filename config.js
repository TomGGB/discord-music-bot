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
        // Configuración de play-dl optimizada para mejor rendimiento
        playDlOptions: {
            quality: 2, // 0 = más alta, 1 = alta, 2 = baja (mejor para bots)
            seek: 0,
            discordPlayerCompatibility: true // Optimizado para Discord
        },
        
        // Configuración de AudioResource
        resourceOptions: {
            inputType: 'arbitrary', // Permite diferentes tipos de input
            inlineVolume: true,
            silencePaddingFrames: 5 // Reducir padding para menos latencia
        },
        
        // Configuración de volumen
        defaultVolume: 0.3, // Volumen por defecto más bajo para evitar distorsión
        
        // Configuración de búsqueda
        searchLimit: 1,
        
        // Configuración de cola
        maxQueueSize: 100,
        
        // Configuración de reproductor
        maxMissedFrames: 5, // Reducir frames perdidos permitidos
        
        // Configuración de reintentos
        maxRetries: 3,
        retryDelay: 1000,
        
        // Configuración de timeout para streams
        streamTimeout: 5000 // 5 segundos para evitar bloqueos
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
