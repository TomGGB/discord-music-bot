# Guía de Solución para Render - Problemas WebSocket

## 🔍 Diagnóstico del Problema

**Síntomas observados:**
- ✅ Bot se inicia correctamente en Render
- ✅ Servidor Express funciona (health checks responden)
- ✅ Token es válido (verificado via API REST)
- ❌ WebSocket no logra conectarse (timeout después de 60s)
- ✅ Funciona perfectamente en local

**Causa raíz:** Render tiene limitaciones específicas con WebSockets y conexiones persistentes.

## 🛠️ Soluciones Implementadas

### 1. Archivo `render-optimized.js`
- Configuración WebSocket específica para Render
- Timeouts aumentados para conexiones lentas
- Configuración de heartbeat optimizada
- Manejo robusto de errores y reconexiones
- Configuración de sharding automática

### 2. Configuraciones Específicas para Render

```javascript
ws: {
    compression: 'zlib-stream',
    connectionTimeout: 30000,
    handshakeTimeout: 30000,
    heartbeatInterval: 41250,
    identifyTimeout: 5000
}
```

### 3. Configuración REST API Optimizada

```javascript
rest: {
    timeout: 30000,
    retries: 5,
    rejectOnRateLimit: false
}
```

## 🚀 Pasos para Implementar

### Opción 1: Cambiar archivo principal
1. Renombrar `index.js` a `index-backup.js`
2. Renombrar `render-optimized.js` a `index.js`
3. Hacer redeploy en Render

### Opción 2: Cambiar start script
1. En `package.json`, cambiar:
   ```json
   "scripts": {
     "start": "node render-optimized.js"
   }
   ```
2. Hacer redeploy en Render

### Opción 3: Variable de entorno
1. Agregar variable `MAIN_FILE=render-optimized.js` en Render
2. Modificar start script para usar la variable

## 🔧 Configuraciones Adicionales de Render

### Variables de Entorno (Confirmar en Render Dashboard)
```
DISCORD_TOKEN=MTM5NDU0MTUx************[REDACTED]
CLIENT_ID=1394541514058895543
NODE_ENV=production
PORT=10000
```

### Configuración de Build
- **Build Command:** `npm install`
- **Start Command:** `node render-optimized.js`
- **Node Version:** 18.x o superior

## 📊 Monitoreo y Verificación

### Endpoints de Salud
- `GET /health` - Estado completo del bot
- `GET /ping` - Ping simple
- `GET /` - Estado básico

### Logs a Monitorear
```
✅ Bot conectado exitosamente!
🤖 Loggeado como: LanaMusic#8064
🏠 Servidores: 1
📡 Ping: XXXms
```

### Comandos de Prueba
- `!ping` - Verifica respuesta básica
- `!info` - Información del bot

## 🚨 Troubleshooting Adicional

### Si el problema persiste:

1. **Verificar Intents en Discord Developer Portal**
   - Ir a https://discord.com/developers/applications
   - Seleccionar la aplicación
   - Bot → Privileged Gateway Intents
   - Activar: Message Content Intent

2. **Verificar Token**
   - Regenerar token si es necesario
   - Actualizar en Render Environment Variables

3. **Verificar Límites de Render**
   - Plan gratuito: 750 horas/mes
   - Verificar que no se hayan agotado las horas

4. **Alternativas si WebSocket falla**
   - Usar solo HTTP endpoints (interactions)
   - Implementar polling en lugar de WebSocket
   - Migrar a otra plataforma (Railway, Heroku, etc.)

## 📈 Próximos Pasos

1. **Implementar render-optimized.js**
2. **Monitorear logs por 5-10 minutos**
3. **Probar comandos básicos**
4. **Si funciona, restaurar funcionalidad completa**

## 🔄 Rollback Plan

Si la nueva configuración no funciona:
1. Revertir a `index.js` original
2. Usar `render-health.js` como alternativa
3. Considerar migración a otra plataforma
