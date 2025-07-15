const { createQueueListEmbed, createCurrentSongEmbed, createErrorEmbed } = require('./utils');
const config = require('./config');

/**
 * Maneja el comando !skip
 * @param {Message} message - Mensaje de Discord
 * @param {AudioPlayer} player - Reproductor de audio
 */
function handleSkipCommand(message, player) {
    if (player) {
        player.stop();
        message.react(config.bot.reactions.skip);
    } else {
        message.reply({ embeds: [createErrorEmbed('No hay ninguna canción reproduciéndose.')] });
    }
}

/**
 * Maneja el comando !stop
 * @param {Message} message - Mensaje de Discord
 * @param {Object} botState - Estado del bot (queue, player, connection, etc.)
 */
function handleStopCommand(message, botState) {
    const { queue, player, connection } = botState;
    
    // Limpiar cola
    queue.length = 0;
    
    // Detener reproductor
    if (player) {
        player.stop();
    }
    
    // Destruir conexión
    if (connection) {
        connection.destroy();
        botState.connection = null;
    }
    
    botState.isPlaying = false;
    botState.currentSong = null;
    botState.isPaused = false;
    botState.player = null; // Limpiar el reproductor para que se cree uno nuevo
    
    message.react(config.bot.reactions.stop);
}

/**
 * Maneja el comando !queue
 * @param {Message} message - Mensaje de Discord
 * @param {Array} queue - Cola de canciones
 */
function handleQueueCommand(message, queue) {
    if (queue.length === 0) {
        return message.reply(config.messages.queueEmpty);
    }
    
    const embed = createQueueListEmbed(queue);
    message.reply({ embeds: [embed] });
}

/**
 * Maneja el comando !current
 * @param {Message} message - Mensaje de Discord
 * @param {Object} currentSong - Canción actual
 */
function handleCurrentCommand(message, currentSong) {
    if (currentSong) {
        const embed = createCurrentSongEmbed(currentSong);
        message.reply({ embeds: [embed] });
    } else {
        message.reply(config.messages.nothingPlaying);
    }
}

/**
 * Maneja el comando !help
 * @param {Message} message - Mensaje de Discord
 */
function handleHelpCommand(message) {
    const helpEmbed = {
        color: 0x0099ff,
        title: '🎵 Comandos del Bot de Música',
        description: 'Aquí tienes todos los comandos disponibles:',
        fields: [
            {
                name: '🎶 Reproducir Música',
                value: 'Simplemente escribe:\n• `Nombre de la canción`\n• `URL de YouTube`\n• `URL de Spotify`',
                inline: false
            },
            {
                name: '⏭️ Controles',
                value: '• `!skip` - Saltar canción\n• `!stop` - Detener reproducción\n• `!pause` - Pausar/Reanudar',
                inline: true
            },
            {
                name: '📋 Información',
                value: '• `!queue` - Ver cola\n• `!current` - Canción actual\n• `!help` - Este mensaje',
                inline: true
            }
        ],
        footer: {
            text: 'Bot de Música Discord | Hecho con ❤️'
        },
        timestamp: new Date()
    };
    
    message.reply({ embeds: [helpEmbed] });
}

/**
 * Maneja el comando !pause
 * @param {Message} message - Mensaje de Discord
 * @param {AudioPlayer} player - Reproductor de audio
 * @param {Object} botState - Estado del bot
 */
function handlePauseCommand(message, player, botState) {
    if (!player) {
        return message.reply({ embeds: [createErrorEmbed('No hay ninguna canción reproduciéndose.')] });
    }
    
    if (botState.isPaused) {
        player.unpause();
        botState.isPaused = false;
        message.react('▶️');
    } else {
        player.pause();
        botState.isPaused = true;
        message.react('⏸️');
    }
}

/**
 * Maneja el comando !setchannel
 * @param {Message} message - Mensaje de Discord
 */
function handleSetChannelCommand(message) {
    const { setMusicChannel } = require('./server-config');
    
    try {
        setMusicChannel(message.guild.id, message.channel.id);
        message.reply(`✅ Canal de música configurado: ${message.channel.name}`);
    } catch (error) {
        console.error('Error configurando canal:', error);
        message.reply('❌ Error configurando el canal de música');
    }
}

/**
 * Maneja el comando !resume
 * @param {Message} message - Mensaje de Discord
 * @param {AudioPlayer} player - Reproductor de audio
 * @param {Object} botState - Estado del bot
 */
function handleResumeCommand(message, player, botState) {
    if (player && botState.isPaused) {
        player.unpause();
        botState.isPaused = false;
        message.react(config.bot.reactions.resume);
    } else {
        message.reply({ embeds: [createErrorEmbed('No hay ninguna canción pausada.')] });
    }
}

/**
 * Maneja las reacciones del panel de control
 * @param {MessageReaction} reaction - Reacción del mensaje
 * @param {User} user - Usuario que reaccionó
 * @param {Object} botState - Estado del bot
 * @param {Function} updateControlPanel - Función para actualizar el panel
 */
async function handleControlPanelReaction(reaction, user, botState, updateControlPanel) {
    if (user.bot) return;
    
    const { player, queue, connection } = botState;
    
    try {
        // Intentar remover la reacción del usuario (opcional)
        try {
            await reaction.users.remove(user.id);
        } catch (permError) {
            // Ignorar errores de permisos al remover reacciones
            console.log('No se pudo remover la reacción (sin permisos)');
        }
        
        switch (reaction.emoji.name) {
            case '⏸️': // Pausar/Reanudar
                if (player) {
                    if (botState.isPaused) {
                        player.unpause();
                        botState.isPaused = false;
                    } else {
                        player.pause();
                        botState.isPaused = true;
                    }
                    updateControlPanel();
                }
                break;
                
            case '⏹️': // Detener
                queue.length = 0;
                if (player) {
                    player.stop();
                }
                if (connection) {
                    connection.destroy();
                    botState.connection = null;
                }
                botState.isPlaying = false;
                botState.currentSong = null;
                botState.isPaused = false;
                botState.player = null; // Limpiar el reproductor para que se cree uno nuevo
                updateControlPanel();
                break;
                
            case '⏭️': // Siguiente canción
                if (player) {
                    player.stop();
                }
                break;
                
            case '📋': // Ver cola completa
                if (queue.length > 0) {
                    const embed = createQueueListEmbed(queue);
                    const tempMessage = await reaction.message.channel.send({ embeds: [embed] });
                    // Eliminar el mensaje después de 10 segundos
                    setTimeout(() => {
                        tempMessage.delete().catch(console.error);
                    }, 10000);
                }
                break;
                
            case '🔄': // Actualizar panel
                updateControlPanel();
                break;
                
            case '🔀': // Mezclar cola
                if (queue.length > 1) {
                    // Mantener la canción actual y mezclar el resto
                    const currentSong = queue[0];
                    const remainingQueue = queue.slice(1);
                    
                    // Algoritmo Fisher-Yates para mezclar
                    for (let i = remainingQueue.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [remainingQueue[i], remainingQueue[j]] = [remainingQueue[j], remainingQueue[i]];
                    }
                    
                    botState.queue = [currentSong, ...remainingQueue];
                    updateControlPanel();
                }
                break;
                
            case '🗑️': // Limpiar cola
                // Mantener solo la canción actual (si hay una reproduciéndose)
                if (queue.length > 1) {
                    if (botState.isPlaying && botState.currentSong) {
                        botState.queue = [botState.currentSong];
                    } else {
                        botState.queue = [];
                        // Si no hay canción actual, detener completamente
                        if (player) {
                            player.stop();
                        }
                        if (botState.connection) {
                            botState.connection.destroy();
                            botState.connection = null;
                        }
                        botState.isPlaying = false;
                        botState.currentSong = null;
                        botState.isPaused = false;
                        botState.player = null;
                    }
                    updateControlPanel();
                }
                break;
                
            case '📻': // Modo radio
                if (botState.radioMode) {
                    botState.radioMode.enabled = !botState.radioMode.enabled;
                    console.log(`📻 Modo radio ${botState.radioMode.enabled ? 'activado' : 'desactivado'}`);
                    updateControlPanel();
                }
                break;
        }
    } catch (error) {
        console.error('Error al manejar reacción del panel de control:', error);
    }
}

/**
 * Procesa comandos especiales
 * @param {Message} message - Mensaje de Discord
 * @param {Object} botState - Estado del bot
 * @returns {boolean} True si se procesó un comando
 */
function processCommand(message, botState) {
    const content = message.content.toLowerCase().trim();
    const { player, queue, connection, currentSong } = botState;
    
    // Comando !play con parámetros
    if (content.startsWith('!play ')) {
        const searchTerm = message.content.slice(6).trim(); // Remover "!play "
        if (searchTerm) {
            // Retornar false para que se procese como búsqueda normal
            message.content = searchTerm;
            return false;
        } else {
            message.reply('**Uso:** `!play <canción/URL>`\n**Ejemplo:** `!play Never Gonna Give You Up`');
            return true;
        }
    }
    
    switch (content) {
        case '!skip':
            handleSkipCommand(message, player);
            return true;
            
        case '!stop':
            handleStopCommand(message, botState);
            return true;
            
        case '!queue':
            handleQueueCommand(message, queue);
            return true;
            
        case '!current':
            handleCurrentCommand(message, currentSong);
            return true;
            
        case '!help':
            handleHelpCommand(message);
            return true;
            
        case '!pause':
            handlePauseCommand(message, player, botState);
            return true;
            
        case '!setchannel':
            handleSetChannelCommand(message);
            return true;
            
        case '!resume':
            handleResumeCommand(message, player, botState);
            return true;
            
        default:
            return false;
    }
}

module.exports = {
    processCommand,
    handleSkipCommand,
    handleStopCommand,
    handleQueueCommand,
    handleCurrentCommand,
    handleHelpCommand,
    handlePauseCommand,
    handleSetChannelCommand,
    handleResumeCommand,
    handleControlPanelReaction
};
