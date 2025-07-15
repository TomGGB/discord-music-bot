# Instrucciones para Render - Crear archivo render-optimized.js

## Problema
GitHub está bloqueando el push por detectar el token en archivos de documentación.

## Solución Manual

### 1. Conectar a Render Dashboard
- Ir a: https://dashboard.render.com/
- Seleccionar el servicio `lanamusic`

### 2. Crear archivo render-optimized.js
En la consola de Render o via editor, crear el archivo `render-optimized.js` con el contenido de la versión optimizada que está en el repositorio local.

### 3. Actualizar package.json
Cambiar el script de start a:
```json
"scripts": {
  "start": "node render-optimized.js"
}
```

### 4. Variables de Entorno
Confirmar que estas variables están configuradas:
- DISCORD_TOKEN: [Tu token actual del .env]
- CLIENT_ID: 1394541514058895543
- NODE_ENV: production
- PORT: 10000

### 5. Redeploy Manual
Hacer un manual deploy después de los cambios.

## Alternativa: Usar el render-optimized.js local
1. Copiar el contenido del archivo render-optimized.js local
2. Crear el archivo directamente en Render
3. Actualizar el start script
4. Redeploy

## Verificación
- El bot debería conectarse exitosamente
- Logs mostrarán: "✅ Bot conectado exitosamente!"
- Endpoints funcionarán: /health, /ping, /

## Funcionalidad Básica
- Comando !ping para verificar latencia
- Comando !info para información del bot
- Health checks funcionando
