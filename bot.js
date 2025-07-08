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
bot.onText(/\/suggest/, (msg) => {
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

Вопрос 1/${config.QUESTIONS.length}:
${session.getCurrentQuestion()}
  `;
  
  bot.sendMessage(chatId, startMessage);
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
    const nextQuestion = `
Вопрос ${session.currentStep + 1}/${config.QUESTIONS.length}:
${session.getCurrentQuestion()}
    `;
    
    bot.sendMessage(chatId, nextQuestion);
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

module.exports = bot; 