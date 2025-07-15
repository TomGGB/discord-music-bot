# 🔧 SOLUCIÓN: Token Discord Revocado

## 🔍 **Diagnóstico del problema**

Los logs muestran que:
- ✅ El endpoint `/interactions` funciona perfectamente
- ✅ Discord puede verificar el endpoint
- ❌ **El bot no se conecta por WebSocket (timeout 60s)**

Esto indica que el **token está revocado o inválido**.

## 🔧 **Solución paso a paso**

### 1️⃣ **Verificar estado del bot**
1. Ve a: https://discord.com/developers/applications/1394437291115548822/bot
2. Verifica que el bot esté **habilitado** (no deshabilitado)
3. Revisa si hay algún mensaje de error o advertencia

### 2️⃣ **Regenerar token**
1. En la misma página, busca **"Token"**
2. Haz clic en **"Reset Token"**
3. Confirma la regeneración
4. **COPIA EL NUEVO TOKEN INMEDIATAMENTE**

### 3️⃣ **Actualizar token en Render**
1. Ve a: https://dashboard.render.com/
2. Busca tu servicio: `lanamusic`
3. Ve a **"Environment"** → **"Environment Variables"**
4. Encuentra **`DISCORD_TOKEN`**
5. Haz clic en **"Edit"**
6. Pega el nuevo token
7. Haz clic en **"Save Changes"**

### 4️⃣ **Verificar privileged intents**
1. En Discord Developer Portal → **"Bot"**
2. Busca **"Privileged Gateway Intents"**
3. Activa:
   - ✅ **PRESENCE INTENT**
   - ✅ **SERVER MEMBERS INTENT**
   - ✅ **MESSAGE CONTENT INTENT**
4. Haz clic en **"Save Changes"**

### 5️⃣ **Verificar permisos del bot**
1. Ve a **"OAuth2"** → **"URL Generator"**
2. Selecciona scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Selecciona permisos:
   - ✅ Send Messages
   - ✅ Use Slash Commands
   - ✅ Connect (para voz)
   - ✅ Speak (para voz)
   - ✅ Use Voice Activity

## 🔍 **Verificar la solución**

Después de regenerar el token:
1. Espera 2-3 minutos para que Render redespliegue
2. Ve a: https://lanamusic.onrender.com/health
3. Debe mostrar `"connected": true`

## 🚨 **Errores comunes**

### ❌ **"Token inválido"**
- **Causa**: Token mal copiado o con espacios
- **Solución**: Regenerar y copiar exactamente

### ❌ **"Intents incorrectos"**
- **Causa**: Privileged intents desactivados
- **Solución**: Activar todos los intents en Discord Developer Portal

### ❌ **"Bot deshabilitado"**
- **Causa**: Bot fue deshabilitado en Discord
- **Solución**: Reactivar en la sección Bot

## 🎯 **Confirmación**

Una vez funcionando, deberías ver en los logs:
```
✅ Bot conectado exitosamente
🤖 Loggeado como: LanaMusic#1234
🏠 Servidores: X
```

## 🔗 **URLs útiles**
- Discord Developer Portal: https://discord.com/developers/applications/1394437291115548822
- Render Dashboard: https://dashboard.render.com/
- Health Check: https://lanamusic.onrender.com/health
