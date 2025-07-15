# 🎵 Discord Music Bot

Un bot de Discord para reproducir música desde YouTube y Spotify de forma sencilla. El bot se conecta a un canal específico donde los usuarios pueden escribir simplemente el nombre de una canción o pegar una URL sin necesidad de usar comandos con "/".

## ✨ Características

- � Reproduce música desde **YouTube** y **Spotify**
- 🔍 Búsqueda inteligente: escribe el nombre de la canción y ya está
- � Soporte para URLs de YouTube y Spotify
- 📝 Cola de reproducción automática
- 🎯 Se conecta automáticamente al canal de voz del usuario
- 🎨 Embeds informativos con detalles de las canciones
- ⚡ Sin comandos complicados - solo escribe y reproduce

## Instalación

1. Clona este repositorio
2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura las variables de entorno en el archivo `.env`:
   - `DISCORD_TOKEN`: Token de tu bot de Discord
   - `SPOTIFY_CLIENT_ID`: ID de cliente de Spotify
   - `SPOTIFY_CLIENT_SECRET`: Secreto de cliente de Spotify
   - `MUSIC_CHANNEL_ID`: ID del canal donde funcionará el bot

## Configuración

### 1. Crear un Bot de Discord

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Crea una nueva aplicación
3. Ve a la sección "Bot" y crea un bot
4. Copia el token del bot y pégalo en `.env`
5. Invita el bot a tu servidor con permisos de:
   - Leer mensajes
   - Enviar mensajes
   - Conectarse a canales de voz
   - Hablar en canales de voz

### 2. Configurar Spotify API

1. Ve a [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Crea una nueva aplicación
3. Copia el Client ID y Client Secret a tu archivo `.env`

### 3. Obtener el ID del Canal

1. Activa el modo desarrollador en Discord
2. Haz clic derecho en el canal donde quieres que funcione el bot
3. Selecciona "Copiar ID"
4. Pégalo en `MUSIC_CHANNEL_ID` en tu archivo `.env`

## Uso

### Reproducir Música

Simplemente escribe en el canal configurado:
- `Nombre de la canción` - Busca y reproduce la canción
- `URL de YouTube` - Reproduce directamente desde YouTube
- `URL de Spotify` - Busca la canción en YouTube usando la info de Spotify

### Comandos Especiales

- `!skip` - Saltar la canción actual
- `!stop` - Detener la reproducción y vaciar la cola
- `!queue` - Ver la cola de reproducción
- `!current` - Ver la canción actual

## Ejecutar el Bot

```bash
# Modo desarrollo (se reinicia automáticamente)
npm run dev

# Modo producción
npm start
```

## Requisitos

- Node.js 16.9.0 o superior
- FFmpeg instalado en el sistema
- Conexión a internet

## Estructura del Proyecto

```
discord-music-bot/
├── index.js          # Archivo principal del bot
├── package.json      # Dependencias y scripts
├── .env             # Variables de entorno
├── .gitignore       # Archivos a ignorar en Git
└── README.md        # Este archivo
```

## Dependencias Principales

- `discord.js` - API de Discord
- `@discordjs/voice` - Funcionalidad de voz
- `ytdl-core` - Descargar audio de YouTube
- `youtube-sr` - Buscar videos en YouTube
- `spotify-web-api-node` - API de Spotify
- `ffmpeg-static` - Procesamiento de audio

## Notas

- El bot solo funciona en el canal configurado en `MUSIC_CHANNEL_ID`
- Las URLs de Spotify se convierten automáticamente a búsquedas de YouTube
- El bot requiere permisos de voz para funcionar
- La calidad del audio depende de la fuente de YouTube

## Solución de Problemas

### El bot no reproduce música
- Verifica que FFmpeg esté instalado
- Asegúrate de que el bot tenga permisos de voz
- Revisa que el token de Discord sea válido

### No encuentra canciones de Spotify
- Verifica las credenciales de Spotify API
- Asegúrate de que la aplicación de Spotify esté activa

### El bot no responde
- Verifica el ID del canal en `.env`
- Revisa que el bot tenga permisos de lectura y escritura en el canal
