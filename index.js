const TelegramApi = require('node-telegram-bot-api');
require('dotenv').config();
const fetch = require('node-fetch'); // Используем require для импорта
const token = process.env.TG_API_KEY;
const bot = new TelegramApi(token, { polling: true });
const { gameOptions, againOptions } = require('./options');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const chats = {};

// Проверка наличия API ключей
if (!token) {
    console.error('Ошибка: TG_API_KEY отсутствует в .env');
    process.exit(1);
}
if (!OPENAI_API_KEY) {
    console.error('Ошибка: OPENAI_API_KEY отсутствует в .env');
    process.exit(1);
}

// Функция общения с ChatGPT
async function chatWithGPT(userMessage) {
    try {
        console.log('Запрос к ChatGPT:', userMessage);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: userMessage }],
            }),
        });

        const data = await response.json();
        console.log('Ответ от ChatGPT:', data);

        if (!response.ok) {
            throw new Error(`Ошибка OpenAI: ${data.error?.message || 'Неизвестная ошибка'}`);
        }

        return data.choices[0].message.content.trim();
    } catch (error) {
        console.error('Ошибка при обращении к ChatGPT:', error.message);
        return 'Произошла ошибка при обращении к ChatGPT. Попробуйте позже.';
    }
}

// Функция запуска игры
const startGame = async (chatId) => {
    try {
        await bot.sendMessage(chatId, 'Сейчас я загадаю число от 0 до 10. Попробуйте отгадать!');
        const randomNumber = Math.floor(Math.random() * 10).toString();
        chats[chatId] = { guessedNumber: randomNumber };

        const message = await bot.sendMessage(chatId, 'Введи число:', gameOptions);
        chats[chatId].messageId = message.message_id;
    } catch (error) {
        console.error('Ошибка в startGame:', error.message);
        await bot.sendMessage(chatId, 'Произошла ошибка при запуске игры. Попробуйте позже.');
    }
};

// Основной запуск бота
const start = () => {
    bot.setMyCommands([
        { command: '/start', description: 'Добро пожаловать в чатбот' },
        { command: '/info', description: 'Получить информацию' },
        { command: '/game', description: 'Давай начнем игру!' },
        { command: '/gpt', description: 'Спроси рецепт...' },
    ]);

    bot.on('message', async (msg) => {
        const text = msg.text;
        const chatId = msg.chat.id;

        try {
            if (text === '/start') {
                await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/348/e30/348e3088-126b-4939-b317-e9036499c515/6.jpg');
                return bot.sendMessage(chatId, `Добро пожаловать в телеграмм бот, дорогой ${msg.from.first_name}`);
            }

            if (text === '/info') {
                return bot.sendMessage(chatId, 'Это расписание мероприятий на текущую неделю');
            }

            if (text === '/game') {
                return startGame(chatId);
            }

            if (text === '/gpt') {
                chats[chatId] = { awaitingRecipe: true };
                return bot.sendMessage(chatId, 'Скажите рецепт какого блюда вас интересует?');
            }

            if (chats[chatId]?.awaitingRecipe) {
                const userMessage = text;
                const reply = await chatWithGPT(userMessage);
                delete chats[chatId].awaitingRecipe;
                return bot.sendMessage(chatId, reply);
            }

            // Общение с ChatGPT для остальных сообщений
            const reply = await chatWithGPT(text);
            return bot.sendMessage(chatId, reply);
        } catch (error) {
            console.error('Ошибка обработки сообщения:', error.message);
            return bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
        }
    });

    bot.on('callback_query', async (msg) => {
        const data = msg.data;
        const chatId = msg.message.chat.id;

        try {
            if (data === '/again') {
                return startGame(chatId);
            }

            const { guessedNumber, messageId } = chats[chatId] || {};
            if (!guessedNumber || !messageId) {
                return bot.sendMessage(chatId, 'Произошла ошибка. Начните игру заново.');
            }

            delete chats[chatId];

            await bot.editMessageReplyMarkup(
                { inline_keyboard: [] },
                { chat_id: chatId, message_id: msg.message.message_id }
            );

            await bot.editMessageText(`Вы ввели число ${data}`, {
                chat_id: chatId,
                message_id: messageId,
            });

            if (guessedNumber === data) {
                return bot.sendMessage(chatId, `Поздравляем, Вы угадали число ${data}!`, againOptions);
            } else {
                return bot.sendMessage(chatId, `Увы, вы проиграли. Бот загадал число ${guessedNumber}.`, againOptions);
            }
        } catch (error) {
            console.error('Ошибка обработки callback_query:', error.message);
            return bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
        }
    });
};

// Запуск бота
start();