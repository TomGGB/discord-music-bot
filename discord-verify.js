// Endpoint de interacciones mejorado con verificación de Discord
const crypto = require('crypto');

// Función para verificar la signature de Discord
function verifyDiscordSignature(body, signature, timestamp, publicKey) {
    try {
        const PUBLIC_KEY = publicKey || process.env.DISCORD_PUBLIC_KEY;
        if (!PUBLIC_KEY) {
            console.log('⚠️ DISCORD_PUBLIC_KEY no configurado - saltando verificación');
            // En desarrollo, permitir sin verificación
            return process.env.NODE_ENV !== 'production';
        }
        
        // Asegurar que body sea string
        const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
        const fullBody = timestamp + bodyString;
        
        console.log('🔐 Verificando firma:', {
            signature: signature ? signature.substring(0, 16) + '...' : 'none',
            timestamp,
            bodyLength: bodyString.length,
            hasPublicKey: !!PUBLIC_KEY
        });
        
        const signatureBuffer = Buffer.from(signature, 'hex');
        const bodyBuffer = Buffer.from(fullBody, 'utf8');
        const publicKeyBuffer = Buffer.from(PUBLIC_KEY, 'hex');
        
        // Verificar usando ed25519 (método alternativo más compatible)
        const isValid = crypto.verify(
            null, 
            bodyBuffer, 
            {
                key: publicKeyBuffer,
                format: 'raw',
                type: 'ed25519'
            },
            signatureBuffer
        );
        
        console.log('✅ Resultado verificación:', isValid);
        return isValid;
    } catch (error) {
        console.error('❌ Error en verificación de firma:', error);
        // En desarrollo, permitir si hay error
        return process.env.NODE_ENV !== 'production';
    }
}

// Middleware para verificar interacciones de Discord
function verifyDiscordRequest(req, res, next) {
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    
    if (!signature || !timestamp) {
        console.log('❌ Headers de Discord faltantes');
        return res.status(401).json({ error: 'Headers de verificación faltantes' });
    }
    
    // En desarrollo, skip verification
    if (process.env.NODE_ENV !== 'production') {
        console.log('🔧 Modo desarrollo - skipping signature verification');
        return next();
    }
    
    // Verificar signature
    const isValid = verifyDiscordSignature(req.body, signature, timestamp);
    if (!isValid) {
        console.log('❌ Signature de Discord inválida');
        return res.status(401).json({ error: 'Signature inválida' });
    }
    
    console.log('✅ Signature de Discord verificada');
    next();
}

module.exports = {
    verifyDiscordRequest,
    verifyDiscordSignature
};
