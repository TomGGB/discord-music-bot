# Configuración de despliegue para Render
## Configuración actualizada - Bot completo con optimizaciones

### Variables de entorno requeridas en Render:
- `DISCORD_TOKEN`: Token del bot de Discord
- `SPOTIFY_CLIENT_ID`: ID del cliente de Spotify
- `SPOTIFY_CLIENT_SECRET`: Secreto del cliente de Spotify
- `NODE_ENV`: production

### Configuración en Render:
1. **Build Command**: `npm install`
2. **Start Command**: `npm start`
3. **Environment**: Node.js
4. **Health Check Path**: `/health`
5. **Health Check Port**: 10000

### Características integradas:
- ✅ WebSocket optimizado para Render (timeout: 30s)
- ✅ Servidor Express para health checks
- ✅ Compresión zlib-stream para conexiones
- ✅ Reintentos automáticos de REST API
- ✅ Funcionalidad completa de música (Spotify + YouTube)
- ✅ Detección de playlists
- ✅ Sistema de colas avanzado
- ✅ Controles de reproducción
- ✅ Integración con múltiples plataformas

### Endpoints disponibles:
- `/` - Página de inicio
- `/health` - Estado del bot (para Render)
- `/ping` - Ping simple
- `/interactions` - Webhook de interacciones

### Comandos disponibles:
- `!play <canción>` - Reproduce música
- `!skip` - Salta la canción actual
- `!queue` - Muestra la cola
- `!stop` - Detiene la reproducción
- `!pause` - Pausa la reproducción
- `!resume` - Reanuda la reproducción
- `!ping` - Verifica la latencia
- `!info` - Información del bot
- Y muchos más...

### Optimizaciones específicas para Render:
- Timeout de conexión: 30 segundos
- Heartbeat interval: 41.25 segundos
- Compresión mejorada
- Reintentos automáticos
- Health checks cada 30 segundos
