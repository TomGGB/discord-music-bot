const http = require('http');

// Crear servidor HTTP para mantener el bot activo
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('🎵 Discord Music Bot is running! 🎵');
});

// Puerto que usará Render
const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`🌐 Keep-alive server running on port ${port}`);
});

module.exports = server;
