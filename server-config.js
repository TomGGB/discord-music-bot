const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'server-config.json');

/**
 * Obtiene la configuración del servidor
 * @param {string} guildId - ID del servidor
 * @returns {Object} Configuración del servidor
 */
function getServerConfig(guildId) {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(data);
            return config[guildId] || null;
        }
    } catch (error) {
        console.error('Error al leer configuración del servidor:', error);
    }
    return null;
}

/**
 * Guarda la configuración del servidor
 * @param {string} guildId - ID del servidor
 * @param {Object} config - Configuración a guardar
 */
function saveServerConfig(guildId, config) {
    try {
        let allConfigs = {};
        
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            allConfigs = JSON.parse(data);
        }
        
        allConfigs[guildId] = config;
        
        fs.writeFileSync(configPath, JSON.stringify(allConfigs, null, 2));
        console.log(`Configuración guardada para el servidor ${guildId}`);
    } catch (error) {
        console.error('Error al guardar configuración del servidor:', error);
    }
}

/**
 * Obtiene el canal de música configurado para un servidor
 * @param {string} guildId - ID del servidor
 * @returns {string|null} ID del canal de música o null si no está configurado
 */
function getMusicChannelId(guildId) {
    const config = getServerConfig(guildId);
    return config ? config.musicChannelId : null;
}

/**
 * Configura el canal de música para un servidor
 * @param {string} guildId - ID del servidor
 * @param {string} channelId - ID del canal de música
 */
function setMusicChannel(guildId, channelId) {
    const config = getServerConfig(guildId) || {};
    config.musicChannelId = channelId;
    saveServerConfig(guildId, config);
}

module.exports = {
    getServerConfig,
    saveServerConfig,
    getMusicChannelId,
    setMusicChannel
};
