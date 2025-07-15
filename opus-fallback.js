/**
 * Módulo para gestionar la carga de bibliotecas Opus para Discord.js
 * Proporciona una alternativa usando opusscript cuando @discordjs/opus no está disponible
 */

const isRender = process.env.RENDER === 'true' || process.env.IS_RENDER === 'true';

/**
 * Intenta cargar @discordjs/opus y, si falla, carga opusscript como alternativa
 * @returns {Object} La biblioteca Opus cargada
 */
function loadOpusLibrary() {
    console.log('🔍 Intentando cargar biblioteca Opus...');
    
    try {
        // Intentar cargar @discordjs/opus primero (mejor rendimiento)
        const opus = require('@discordjs/opus');
        console.log('✅ @discordjs/opus cargado correctamente');
        return opus;
    } catch (error) {
        console.log('⚠️ No se pudo cargar @discordjs/opus:', error.message);
        console.log('🔄 Intentando cargar opusscript como alternativa...');
        
        try {
            // Cargar opusscript como alternativa
            const OpusScript = require('opusscript');
            console.log('✅ opusscript cargado correctamente');
            
            // Crear una instancia con configuración optimizada para Discord
            // 48kHz, 2 canales, aplicación VOIP
            const opusEncoder = new OpusScript(48000, 2, OpusScript.Application.VOIP);
            
            // Envolver opusscript para que tenga una API similar a @discordjs/opus
            const opusWrapper = {
                encoder: opusEncoder,
                decode: (buffer) => {
                    return opusEncoder.decode(buffer);
                },
                encode: (buffer, frameSize) => {
                    return opusEncoder.encode(buffer, frameSize);
                }
            };
            
            return opusWrapper;
        } catch (opusScriptError) {
            console.error('❌ No se pudo cargar ninguna biblioteca Opus:', opusScriptError.message);
            console.error('⚠️ La funcionalidad de audio puede no estar disponible');
            
            // Devolver un objeto vacío para evitar errores
            return {
                encoder: null,
                decode: () => { throw new Error('No hay biblioteca Opus disponible'); },
                encode: () => { throw new Error('No hay biblioteca Opus disponible'); }
            };
        }
    }
}

/**
 * Configura la biblioteca Opus para @discordjs/voice
 * Esto asegura que se use opusscript cuando @discordjs/opus no esté disponible
 */
function setupOpusForDiscordVoice() {
    try {
        // Intentar configurar @discordjs/voice para usar opusscript si es necesario
        const { VoiceConnectionStatus } = require('@discordjs/voice');
        
        // La configuración se realiza automáticamente al cargar opusscript
        // @discordjs/voice detectará la biblioteca disponible
        
        console.log('✅ Configuración de Opus para Discord Voice completada');
    } catch (error) {
        console.error('❌ Error al configurar Opus para Discord Voice:', error.message);
    }
}

// Exportar funciones
module.exports = {
    loadOpusLibrary,
    setupOpusForDiscordVoice
};