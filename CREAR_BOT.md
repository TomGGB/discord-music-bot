# 🤖 Cómo Crear un Bot de Discord

## Paso 1: Crear la Aplicación

1. Ve a https://discord.com/developers/applications
2. Haz clic en "New Application"
3. Dale un nombre a tu aplicación (ej: "Mi Bot de Música")
4. Haz clic en "Create"

## Paso 2: Crear el Bot

1. En el menú lateral, haz clic en "Bot"
2. Haz clic en "Add Bot"
3. Confirma haciendo clic en "Yes, do it!"

## Paso 3: Obtener el Token

1. En la sección "Token", haz clic en "Reset Token"
2. Copia el token que aparece (es algo como: MTk4NjIyNDc...)
3. **¡IMPORTANTE!** Guarda este token de forma segura

## Paso 4: Configurar Permisos

En la sección "Bot":
- ✅ Activa "Message Content Intent"
- ✅ Activa "Server Members Intent" (opcional)

## Paso 5: Invitar el Bot a tu Servidor

1. Ve a la sección "OAuth2" > "URL Generator"
2. En "Scopes", selecciona: **bot**
3. En "Bot Permissions", selecciona:
   - ✅ Send Messages
   - ✅ Read Message History
   - ✅ Connect
   - ✅ Speak
   - ✅ Use Voice Activity
   - ✅ Read Messages/View Channels

4. Copia la URL generada y ábrela en tu navegador
5. Selecciona tu servidor y autoriza el bot

## Paso 6: Actualizar el archivo .env

Reemplaza el token en tu archivo `.env`:

```
DISCORD_TOKEN=TU_TOKEN_REAL_AQUI
```

## ⚠️ Importante sobre el Token

- **NUNCA compartas tu token públicamente**
- **NO lo subas a GitHub o repositorios públicos**
- Si crees que alguien lo vio, regenera el token inmediatamente
- El token da acceso completo a tu bot

## 🎵 Después de Configurar

Una vez que tengas el token real:
1. Actualiza el archivo `.env`
2. Ejecuta `npm start`
3. El bot debería conectarse exitosamente

¡Tu bot estará listo para reproducir música! 🎶
