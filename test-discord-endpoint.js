// Script para probar endpoints de Discord localmente
const express = require('express');
const app = express();
const PORT = 3001;

// Middleware para logs detallados
app.use((req, res, next) => {
    console.log('=================================');
    console.log(`📡 ${new Date().toISOString()}`);
    console.log(`📍 ${req.method} ${req.path}`);
    console.log('📋 Headers:', req.headers);
    
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            console.log('📦 Body:', body);
            req.body = body;
            next();
        });
    } else {
        next();
    }
});

// Endpoint de prueba
app.post('/interactions', (req, res) => {
    console.log('🎯 Endpoint /interactions alcanzado');
    
    let parsedBody;
    try {
        parsedBody = JSON.parse(req.body);
    } catch (error) {
        console.error('❌ Error parsing JSON:', error);
        return res.status(400).json({ error: 'Invalid JSON' });
    }
    
    console.log('📨 Body parseado:', parsedBody);
    
    if (parsedBody.type === 1) {
        console.log('🏓 PING recibido - enviando PONG');
        const response = { type: 1 };
        res.setHeader('Content-Type', 'application/json');
        res.json(response);
    } else {
        console.log('❓ Tipo desconocido:', parsedBody.type);
        res.json({ error: 'Unknown type' });
    }
});

// Endpoint de prueba simple
app.get('/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Servidor de prueba funcionando',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor de prueba iniciado en puerto ${PORT}`);
    console.log(`📍 Endpoint: http://localhost:${PORT}/interactions`);
    console.log(`🧪 Prueba: curl -X POST http://localhost:${PORT}/interactions -H "Content-Type: application/json" -d '{"type":1}'`);
});
