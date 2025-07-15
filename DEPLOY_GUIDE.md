# 🚀 Guía de Despliegue - Bot de Música Discord

## 📋 **Preparación Inicial**

### 1. Variables de Entorno Necesarias
```
DISCORD_TOKEN=tu_token_de_discord
SPOTIFY_CLIENT_ID=tu_client_id_de_spotify
SPOTIFY_CLIENT_SECRET=tu_client_secret_de_spotify
```

### 2. Archivos Importantes
- `Procfile` - Comando para iniciar el bot
- `package.json` - Dependencias y scripts
- `.env` - Variables de entorno (NO subir a GitHub)

---

## 🌐 **Opción 1: RENDER (Recomendado)**

### ✅ **Ventajas:**
- 750 horas gratis/mes
- Deploy automático desde GitHub
- SSL automático
- Logs en tiempo real

### 📝 **Pasos:**

1. **Subir código a GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/tu-usuario/discord-music-bot.git
   git push -u origin main
   ```

2. **Crear cuenta en Render:**
   - Ve a [render.com](https://render.com)
   - Registrate con GitHub

3. **Crear Web Service:**
   - Click en "New +" → "Web Service"
   - Conecta tu repositorio
   - Configuración:
     - **Name:** `discord-music-bot`
     - **Region:** `Oregon (US West)`
     - **Branch:** `main`
     - **Runtime:** `Node`
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`

4. **Configurar Variables de Entorno:**
   - En la sección "Environment"
   - Agregar:
     - `DISCORD_TOKEN`
     - `SPOTIFY_CLIENT_ID`
     - `SPOTIFY_CLIENT_SECRET`

5. **Deploy:**
   - Click en "Create Web Service"
   - Esperar a que termine el deploy

---

## 🚂 **Opción 2: RAILWAY**

### ✅ **Ventajas:**
- $5 gratis cada mes
- Deploy super rápido
- Base de datos incluida
- Muy fácil de usar

### 📝 **Pasos:**

1. **Crear cuenta en Railway:**
   - Ve a [railway.app](https://railway.app)
   - Login con GitHub

2. **Crear nuevo proyecto:**
   - Click en "New Project"
   - Selecciona "Deploy from GitHub repo"
   - Selecciona tu repositorio

3. **Configurar variables:**
   - Ve a "Variables"
   - Agregar las mismas variables que en Render

4. **Deploy automático:**
   - Railway detectará automáticamente que es Node.js
   - Se desplegará automáticamente

---

## ☁️ **Opción 3: HEROKU**

### ✅ **Ventajas:**
- 550 horas gratis (con tarjeta)
- Muy estable
- Documentación excelente

### 📝 **Pasos:**

1. **Instalar Heroku CLI:**
   ```bash
   # Windows
   https://devcenter.heroku.com/articles/heroku-cli
   
   # Verificar instalación
   heroku --version
   ```

2. **Login y crear app:**
   ```bash
   heroku login
   heroku create nombre-de-tu-bot
   ```

3. **Configurar variables:**
   ```bash
   heroku config:set DISCORD_TOKEN=tu_token
   heroku config:set SPOTIFY_CLIENT_ID=tu_client_id
   heroku config:set SPOTIFY_CLIENT_SECRET=tu_client_secret
   ```

4. **Deploy:**
   ```bash
   git push heroku main
   ```

---

## 🔧 **Configuración Adicional**

### **Mantener el Bot Activo (Render/Heroku):**
Los servicios gratuitos se "duermen" después de 30 minutos de inactividad.

**Solución - Crear archivo `keep-alive.js`:**
```javascript
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Keep-alive server running on port ${port}`);
});
```

### **Configurar en index.js:**
```javascript
// Agregar al final del archivo
if (process.env.NODE_ENV === 'production') {
    require('./keep-alive');
}
```

---

## 📊 **Comparación de Plataformas**

| Plataforma | Tiempo Gratis | Facilidad | Estabilidad | Recomendación |
|------------|---------------|-----------|-------------|---------------|
| **Render** | 750h/mes | 🟢 Muy Fácil | 🟢 Excelente | ⭐ **Mejor opción** |
| **Railway** | $5/mes | 🟢 Muy Fácil | 🟢 Excelente | ⭐ Alternativa top |
| **Heroku** | 550h/mes | 🟡 Medio | 🟢 Excelente | ⭐ Clásica |

---

## 🐛 **Solución de Problemas**

### **Error: "Cannot find module"**
```bash
npm install
```

### **Error: "Invalid token"**
- Verificar que el token de Discord esté correcto
- Verificar que las variables de entorno estén configuradas

### **Error: "Spotify API"**
- Verificar Client ID y Client Secret
- Verificar que la app de Spotify esté configurada correctamente

### **Bot se desconecta:**
- Usar keep-alive para mantenerlo activo
- Verificar logs para errores específicos

---

## 🎉 **¡Listo!**

Una vez desplegado, tu bot estará disponible 24/7 de forma gratuita. 

### **Recomendación Final:**
- Usa **Render** para empezar (más fácil)
- Migra a **Railway** si necesitas más características
- Usa **Heroku** si ya tienes experiencia con él

¿Necesitas ayuda con algún paso específico? ¡Pregúntame!
