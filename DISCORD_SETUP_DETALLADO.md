# 🎯 SOLUCIÓN PASO A PASO - Discord Developer Portal

## 🔹 **Paso 1: Verifica el estado del servicio**
1. Ve a: https://lanamusic.onrender.com/health
2. Debe mostrar que el servicio está en línea

## 🔹 **Paso 2: Configura en Discord Developer Portal**
1. Ve a: https://discord.com/developers/applications/1394437291115548822/information
2. En la sección **"General Information"**
3. Busca el campo **"Interactions Endpoint URL"**

## 🔹 **Paso 3: Prueba estas URLs en orden**

### ✅ **Opción 1 (Recomendada)**
```
https://lanamusic.onrender.com/interactions
```

### ✅ **Opción 2 (Alternativa)**
```
https://lanamusic.onrender.com/api/interactions
```

### ✅ **Opción 3 (Backup)**
```
https://lanamusic.onrender.com/discord/interactions
```

## 🔹 **Paso 4: Notas importantes**

### ⚠️ **Antes de guardar:**
- Asegúrate de que Render no esté dormido
- Verifica que la URL sea EXACTAMENTE la copiada
- NO agregues espacios ni caracteres extra

### ⚠️ **Si sigue fallando:**
1. Espera 30 segundos entre intentos
2. Prueba con una URL diferente
3. Verifica que sea https:// no http://

## 🔹 **Paso 5: Verificación manual**

### 🧪 **Prueba desde terminal:**
```bash
curl -X POST https://lanamusic.onrender.com/interactions -H "Content-Type: application/json" -d '{"type":1}'
```

### 📊 **Respuesta esperada:**
```json
{"type":1}
```

## 🔹 **Paso 6: Troubleshooting**

### 🔴 **Error "No se ha podido verificar"**
- **Causa**: Timeout o URL incorrecta
- **Solución**: Espera 30s y prueba de nuevo

### 🔴 **Error de conexión**
- **Causa**: Render dormido
- **Solución**: Ve a https://lanamusic.onrender.com/health primero

### 🔴 **Error 404**
- **Causa**: URL incorrecta
- **Solución**: Verifica la URL exacta

## 🔹 **Paso 7: Después de configurar**

1. Haz clic en **"Save Changes"**
2. Espera la confirmación
3. Ve a la sección **"OAuth2"** → **"URL Generator"**
4. Selecciona **"applications.commands"**
5. Invita el bot a tu servidor de prueba

## 🎯 **URLs de referencia:**
- Health: https://lanamusic.onrender.com/health
- Test: https://lanamusic.onrender.com/test-discord
- Diagnóstico: https://lanamusic.onrender.com/diagnose
