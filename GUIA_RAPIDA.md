# 🎵 Guía Rápida del Bot de Música

## 🚀 Iniciar el Bot

```bash
npm start
```

## 🎶 Cómo Usar el Bot

### Reproducir Música
Solo escribe en el canal configurado:

**Por nombre de canción:**
```
Shape of You Ed Sheeran
Bohemian Rhapsody
Despacito
```

**URLs de YouTube:**
```
https://www.youtube.com/watch?v=JGwWNGJdvx8
https://youtu.be/JGwWNGJdvx8
```

**URLs de Spotify:**
```
https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3
```

### Comandos Especiales

| Comando | Descripción |
|---------|-------------|
| `!help` | Muestra la ayuda |
| `!skip` | Salta la canción actual |
| `!stop` | Detiene la reproducción |
| `!pause` | Pausa/reanuda la música |
| `!queue` | Muestra la cola de canciones |
| `!current` | Muestra la canción actual |

## ⚙️ Configuración Actual

- **Canal de música:** `776698872360992768`
- **Spotify:** ✅ Configurado
- **YouTube:** ✅ Siempre disponible

## 🔧 Resolución de Problemas

### El bot no reproduce audio
- Verifica que FFmpeg esté instalado
- Asegúrate de estar en un canal de voz

### El bot no responde
- Verifica que el ID del canal sea correcto
- Confirma que el bot tenga permisos en el canal

### Error con Spotify
- Verifica las credenciales en el archivo `.env`
- Puede funcionar solo con YouTube si hay problemas

## 📝 Notas Importantes

1. **Debes estar en un canal de voz** para que el bot reproduzca música
2. El bot solo responde en el canal configurado
3. **No uses comandos con "/"** - solo escribe el nombre de la canción
4. La cola puede tener hasta 100 canciones
5. El bot busca primero en Spotify, luego en YouTube

¡Disfruta tu música! 🎵
