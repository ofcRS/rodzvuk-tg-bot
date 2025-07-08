const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const sheetsService = require('./sheets');

// Создаем экземпляр бота
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

// Хранилище для состояний пользователей
const userStates = new Map();

// Класс для управления состоянием пользователя
class UserSession {
  constructor(userId) {
    this.userId = userId;
    this.currentStep = 0;
    this.answers = {};
    this.isActive = false;
  }

  reset() {
    this.currentStep = 0;
    this.answers = {};
    this.isActive = false;
  }

  nextStep() {
    this.currentStep++;
  }

  isComplete() {
    return this.currentStep >= config.QUESTIONS.length;
  }

  addAnswer(answer) {
    const questionIndex = this.currentStep;
    const questionKey = this.getQuestionKey(questionIndex);
    this.answers[questionKey] = answer;
  }

  getQuestionKey(index) {
    const keyMap = {
      0: 'name',
      1: 'artist',
      2: 'link',
      3: 'language',
      4: 'genre',
      5: 'reason',
      6: 'contact'
    };
    return keyMap[index] || `question_${index}`;
  }

  getCurrentQuestion() {
    return config.QUESTIONS[this.currentStep];
  }
}

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  const welcomeMessage = `
🎵 Привет! Я бот для сбора предложений треков.

Я задам тебе несколько вопросов о треке, который ты хочешь предложить. Все ответы будут автоматически сохранены в таблицу.

Чтобы начать, используй команду /suggest

Доступные команды:
/suggest - Предложить трек
/cancel - Отменить текущую заявку
/help - Помощь
  `;
  
  bot.sendMessage(chatId, welcomeMessage);
});

// Команда /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `
🔧 Доступные команды:

/suggest - Начать процесс предложения трека
/cancel - Отменить текущую заявку  
/help - Показать эту справку

📝 Как это работает:
1. Используй /suggest для начала
2. Отвечай на вопросы по порядку
3. Твои ответы автоматически сохраняются в таблицу
4. В любой момент можешь отменить заявку командой /cancel

Бот может обрабатывать тысячи запросов одновременно!
  `;
  
  bot.sendMessage(chatId, helpMessage);
});

// Команда /suggest
bot.onText(/\/suggest/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Создаем или сбрасываем состояние пользователя
  if (!userStates.has(userId)) {
    userStates.set(userId, new UserSession(userId));
  }
  
  const session = userStates.get(userId);
  session.reset();
  session.isActive = true;
  
  const startMessage = `
🎵 Отлично! Начинаем сбор информации о треке.

Я задам тебе ${config.QUESTIONS.length} вопросов. Отвечай на каждый вопрос отдельным сообщением.

В любой момент можешь отменить заявку командой /cancel
  `;
  
  await bot.sendMessage(chatId, startMessage);
  
  // Отправляем первый вопрос
  await sendNextQuestion(chatId, session);
});

// Команда /cancel
bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (userStates.has(userId)) {
    const session = userStates.get(userId);
    session.reset();
    bot.sendMessage(chatId, '❌ Заявка отменена. Чтобы начать заново, используй /suggest');
  } else {
    bot.sendMessage(chatId, 'У тебя нет активной заявки для отмены.');
  }
});

// Функция для отправки вопроса с учетом особых случаев
async function sendNextQuestion(chatId, session) {
  const questionIndex = session.currentStep;
  const totalQuestions = config.QUESTIONS.length;
  
  // Если это вопрос о языке (индекс 3), показываем кнопки
  if (questionIndex === 3) {
    const languageKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🇷🇺 Русский', callback_data: 'lang_russian' },
            { text: '🇺🇸 Английский', callback_data: 'lang_english' }
          ],
          [
            { text: '🌍 Другой язык', callback_data: 'lang_other' }
          ]
        ]
      }
    };
    
    const questionText = `
Вопрос ${questionIndex + 1}/${totalQuestions}:
${session.getCurrentQuestion()}

Выбери язык трека:
    `;
    
    await bot.sendMessage(chatId, questionText, languageKeyboard);
  } else {
    // Обычный вопрос
    const questionText = `
Вопрос ${questionIndex + 1}/${totalQuestions}:
${session.getCurrentQuestion()}
    `;
    
    await bot.sendMessage(chatId, questionText);
  }
}

// Обработка callback от inline кнопок
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  // Проверяем, есть ли активная сессия
  if (!userStates.has(userId)) {
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Сессия не найдена. Начни заново с /suggest' });
    return;
  }
  
  const session = userStates.get(userId);
  
  if (!session.isActive) {
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Сессия не активна. Начни заново с /suggest' });
    return;
  }
  
  // Обработка выбора языка
  if (data.startsWith('lang_')) {
    let selectedLanguage;
    
    switch (data) {
      case 'lang_russian':
        selectedLanguage = 'Русский';
        break;
      case 'lang_english':
        selectedLanguage = 'Английский';
        break;
      case 'lang_other':
        selectedLanguage = 'Другой язык';
        break;
      default:
        bot.answerCallbackQuery(callbackQuery.id, { text: 'Неизвестный выбор' });
        return;
    }
    
    // Сохраняем ответ
    session.addAnswer(selectedLanguage);
    session.nextStep();
    
    // Отвечаем на callback
    bot.answerCallbackQuery(callbackQuery.id, { text: `Выбран язык: ${selectedLanguage}` });
    
    // Проверяем, все ли вопросы заданы
    if (session.isComplete()) {
      // Все вопросы отвечены, сохраняем в Google Sheets
      try {
        bot.sendMessage(chatId, '⏳ Сохраняю твою заявку...');
        
        const submissionData = {
          ...session.answers,
          userId: userId,
          username: callbackQuery.from.username || callbackQuery.from.first_name || 'Unknown'
        };
        
        await sheetsService.addSubmission(submissionData);
        
        // Создаем сводку ответов
        const summary = `
✅ Заявка успешно сохранена!

📋 Твои ответы:
• Имя: ${session.answers.name || 'Не указано'}
• Исполнитель и трек: ${session.answers.artist || 'Не указано'}
• Ссылка: ${session.answers.link || 'Не указано'}
• Язык: ${session.answers.language || 'Не указано'}
• Жанр: ${session.answers.genre || 'Не указано'}
• Причина рекомендации: ${session.answers.reason || 'Не указано'}
• Контакт: ${session.answers.contact || 'Не указано'}

Спасибо за предложение! 🎵
Чтобы предложить еще один трек, используй /suggest
        `;
        
        bot.sendMessage(chatId, summary);
        session.reset();
        
      } catch (error) {
        console.error('Error saving submission:', error);
        bot.sendMessage(chatId, '❌ Произошла ошибка при сохранении заявки. Попробуй еще раз позже.');
        session.reset();
      }
      
    } else {
      // Задаем следующий вопрос
      await sendNextQuestion(chatId, session);
    }
  }
});

// Обработка текстовых сообщений
bot.on('message', async (msg) => {
  // Пропускаем команды
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userMessage = msg.text;
  
  // Проверяем, есть ли активная сессия
  if (!userStates.has(userId)) {
    bot.sendMessage(chatId, 'Чтобы начать предложение трека, используй команду /suggest');
    return;
  }
  
  const session = userStates.get(userId);
  
  if (!session.isActive) {
    bot.sendMessage(chatId, 'Чтобы начать предложение трека, используй команду /suggest');
    return;
  }
  
  // Если сейчас вопрос о языке (индекс 3), игнорируем текстовый ввод
  if (session.currentStep === 3) {
    bot.sendMessage(chatId, 'Пожалуйста, выбери язык с помощью кнопок выше ☝️');
    return;
  }
  
  // Сохраняем ответ
  session.addAnswer(userMessage);
  session.nextStep();
  
  // Проверяем, все ли вопросы заданы
  if (session.isComplete()) {
    // Все вопросы отвечены, сохраняем в Google Sheets
    try {
      bot.sendMessage(chatId, '⏳ Сохраняю твою заявку...');
      
      const submissionData = {
        ...session.answers,
        userId: userId,
        username: msg.from.username || msg.from.first_name || 'Unknown'
      };
      
      await sheetsService.addSubmission(submissionData);
      
      // Создаем сводку ответов
      const summary = `
✅ Заявка успешно сохранена!

📋 Твои ответы:
• Имя: ${session.answers.name || 'Не указано'}
• Исполнитель и трек: ${session.answers.artist || 'Не указано'}
• Ссылка: ${session.answers.link || 'Не указано'}
• Язык: ${session.answers.language || 'Не указано'}
• Жанр: ${session.answers.genre || 'Не указано'}
• Причина рекомендации: ${session.answers.reason || 'Не указано'}
• Контакт: ${session.answers.contact || 'Не указано'}

Спасибо за предложение! 🎵
Чтобы предложить еще один трек, используй /suggest
      `;
      
      bot.sendMessage(chatId, summary);
      session.reset();
      
    } catch (error) {
      console.error('Error saving submission:', error);
      bot.sendMessage(chatId, '❌ Произошла ошибка при сохранении заявки. Попробуй еще раз позже.');
      session.reset();
    }
    
  } else {
    // Задаем следующий вопрос
    await sendNextQuestion(chatId, session);
  }
});

// Обработка ошибок
bot.on('error', (error) => {
  console.error('Bot error:', error);
});

// Инициализация Google Sheets при запуске
async function initializeBot() {
  try {
    console.log('Initializing Telegram Bot...');
    
    // Инициализируем Google Sheets (заголовки добавляются автоматически)
    await sheetsService.init();
    
    console.log('Bot is ready and running! 🚀');
    console.log('Commands available:');
    console.log('- /start - Welcome message');
    console.log('- /suggest - Start track suggestion');
    console.log('- /cancel - Cancel current submission');
    console.log('- /help - Show help');
    
  } catch (error) {
    console.error('Error initializing bot:', error);
    process.exit(1);
  }
}

// Запускаем бота
initializeBot();

// Создаем HTTP сервер для Heroku
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Простой endpoint для проверки здоровья бота
app.get('/', (req, res) => {
  res.json({
    status: 'Bot is running! 🚀',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Запускаем HTTP сервер
app.listen(PORT, () => {
  console.log(`HTTP Server is running on port ${PORT}`);
});

module.exports = bot; 