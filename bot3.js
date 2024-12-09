const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Caminhos dos arquivos
const connectedNumberPath = './connectedNumber.json';
const interactionsFilePath = './userInteractions.json';

// Configuração dos grupos e número autorizado
const groupIDs = [
    '120363368116021245@g.us',
    '120363345371780068@g.us',
    '120363365070869525@g.us',
    '120363365601231730@g.us',
    '120363369421950229@g.us'
];
const authorizedNumber = '5522998680482@c.us';

// Inicializar cliente
const client = new Client({
    authStrategy: new LocalAuth()
});

// Exibir QR Code
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Escaneie o QR Code acima para conectar!');
});

// Quando o cliente estiver pronto
client.on('ready', async () => {
    console.log('Bot conectado ao WhatsApp!');

    try {
        const userInfo = client.info;
        const connectedNumber = {
            number: userInfo.wid.user,
            pushname: userInfo.pushname
        };

        fs.writeFileSync(connectedNumberPath, JSON.stringify(connectedNumber, null, 2));
        console.log(`Número conectado: ${connectedNumber.number}`);
    } catch (error) {
        console.error('Erro ao salvar informações do número conectado:', error.message);
    }
});

// Carregar e salvar interações
const loadInteractions = () => {
    try {
        if (fs.existsSync(interactionsFilePath)) {
            return JSON.parse(fs.readFileSync(interactionsFilePath, 'utf-8'));
        }
    } catch (error) {
        console.error('Erro ao carregar interações:', error.message);
    }
    return {};
};

const saveInteractions = (interactions) => {
    try {
        fs.writeFileSync(interactionsFilePath, JSON.stringify(interactions, null, 2));
    } catch (error) {
        console.error('Erro ao salvar interações:', error.message);
    }
};

let userInteractions = loadInteractions();
const sentMessages = new Set(); // Para evitar mensagens duplicadas

// Consolidar eventos de mensagem
client.on('message', async (msg) => {
    try {
        const sender = msg.author || msg.from;

        // Verifica se a mensagem é de um dos grupos configurados
        if (groupIDs.includes(msg.from)) {
            const chat = await msg.getChat();

            // Boas-vindas ao usuário
            if (!userInteractions[msg.from]) {
                userInteractions[msg.from] = [];
            }

            if (!userInteractions[msg.from].includes(sender)) {
                userInteractions[msg.from].push(sender);
                saveInteractions(userInteractions);

                const welcomeMessage = `Olá, ${msg._data.notifyName || 'usuário'}! Bem-vindo(a) ao "${chat.name}" 😊`;
                await msg.reply(welcomeMessage);
                console.log(`Mensagem de boas-vindas enviada para ${sender} no chat ${chat.name}.`);
            }

            // Comando "!say"
            if (msg.body.startsWith('!say') && sender === authorizedNumber) {
                const message = msg.body.slice(5).trim();

                if (sentMessages.has(message)) {
                    console.log('Mensagem duplicada ignorada.');
                    return;
                }

                sentMessages.add(message);
                setTimeout(() => sentMessages.delete(message), 60000);

                for (const groupID of groupIDs) {
                    try {
                        const groupChat = await client.getChatById(groupID);
                        await groupChat.sendMessage(message);
                        console.log(`Mensagem enviada para o grupo com ID: ${groupID}`);
                    } catch (error) {
                        console.error(`Erro ao enviar mensagem para o grupo ${groupID}:`, error.message);
                    }
                }
            }

            // Envio de imagens
            if (msg.hasMedia && sender === authorizedNumber) {
                const media = await msg.downloadMedia();
                const caption = msg.body || '';

                for (const groupID of groupIDs) {
                    try {
                        const groupChat = await client.getChatById(groupID);
                        await groupChat.sendMessage(media, { caption });
                        console.log(`Imagem enviada para o grupo com ID: ${groupID}`);
                    } catch (error) {
                        console.error(`Erro ao enviar imagem para o grupo ${groupID}:`, error.message);
                    }
                }
            }

            // Comando "!help"
            if (msg.body === '!help') {
                const adminNumbers = ['5522998680482@c.us', '5545999162624@c.us'];
                const mentionText = adminNumbers.map((num) => `@${num.split('@')[0]}`).join(' ');

                await msg.reply(`Olá! Precisa de ajuda? Contate:\n${mentionText}`, null, { mentions: adminNumbers });
                console.log('Mensagem de ajuda enviada.');
            }

            // Comando "!link"
            if (msg.body === '!link') {
                const linkMessage = `*Discord:* https://discord.gg/NUZbDKRg\n*Comunidade:* https://chat.whatsapp.com/G6Sj3i6Zs4M8NIdrmIJAq3`;
                msg.reply(linkMessage);
                console.log('Mensagem de links enviada.');
            }

            // Comando "!comandos"
            if (msg.body === '!comandos') {
                const commandsMessage = `Comandos disponíveis:\n\n!link\n!help\n!comandos\n!say`;
                msg.reply(commandsMessage);
                console.log('Mensagem de comandos enviada.');
            }
        }
    } catch (error) {
        console.error('Erro ao processar mensagem:', error.message);
    }
});

// Cliente desconectado
client.on('disconnected', () => {
    console.log('Bot desconectado. Escaneie o QR Code novamente.');
});

// Inicializa o cliente
client.initialize();
