const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
    {
        name: 'setup',
        description: 'Configura el canal de música del bot',
        options: [
            {
                name: 'canal',
                description: 'Canal donde el bot recibirá las canciones',
                type: 7, // CHANNEL type
                required: true,
                channel_types: [0] // TEXT channel only
            }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Desplegando comandos slash...');
        
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        
        console.log('Comandos slash desplegados exitosamente.');
    } catch (error) {
        console.error('Error al desplegar comandos:', error);
    }
})();
