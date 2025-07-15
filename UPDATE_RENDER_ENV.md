# Actualizar Variables de Entorno en Render

## El token en el archivo .env es VÁLIDO ✅

Token válido encontrado en `.env`:
```
DISCORD_TOKEN=MTM5NDU0MTUx************[REDACTED]
```

## Pasos para actualizar Render:

1. **Ir a Render Dashboard**
   - Ir a: https://dashboard.render.com/

2. **Seleccionar el servicio lanamusic**
   - Buscar el servicio `lanamusic`

3. **Actualizar Variables de Entorno**
   - Ir a la sección "Environment"
   - Actualizar estas variables:

```
DISCORD_TOKEN=MTM5NDU0MTUx************[REDACTED]
CLIENT_ID=1394541514058895543
SPOTIFY_CLIENT_ID=c6715b010b194059b157834ec9225759
SPOTIFY_CLIENT_SECRET=0acab87cad4642bda7f633b7448ff866
MUSIC_CHANNEL_ID=776698872360992768
```

4. **Hacer redeploy**
   - Después de actualizar las variables, hacer "Manual Deploy" o esperar el auto-deploy

## Verificación Post-Update:

Una vez actualizado, verificar:
- https://lanamusic.onrender.com/health (debería responder JSON)
- https://lanamusic.onrender.com/interactions (debería responder a Discord)

## Status Actual:
- ✅ Token válido localmente
- ❌ 502 Bad Gateway en Render (necesita actualización de env vars)
- ✅ Endpoints de interacción funcionando
- ✅ Discord Developer Portal configurado
