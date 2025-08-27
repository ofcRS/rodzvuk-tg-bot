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
      0: 'artist_name',
      1: 'release_title',
      2: 'city',
      3: 'genres',
      4: 'listening_link',
      5: 'social_link',
      6: 'description',
      7: 'email'
    };
    return keyMap[index] || `question_${index}`;
  }

  getCurrentQuestion() {
    return config.QUESTIONS[this.currentStep];
  }
}

// -------- Helpers: URL validation --------
function extractUrlCandidates(text) {
  if (!text) return [];
  const regex = /((?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:[^\s]*)?)/gi;
  const matches = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

function toValidHttpUrl(rawCandidate) {
  if (!rawCandidate) return null;
  let candidate = rawCandidate.trim();
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch (_) {
    return null;
  }
}

function hasExactlyOneUrl(text) {
  const candidates = extractUrlCandidates(text);
  const valid = candidates
    .map(toValidHttpUrl)
    .filter(Boolean);
  return { count: valid.length, url: valid[0] || null };
}

function isAllowedListeningHost(hostname) {
  const h = (hostname || '').toLowerCase();
  return (
    h.includes('spotify.com') ||
    h.includes('music.yandex.') ||
    h === 'band.link' || h.endsWith('.band.link')
  );
}

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  const welcomeMessage = `
Добро пожаловать в Родной звук (http://t.me/rodzvuk)!

Вы можете предложить свою музыку с помощью этого бота.
Ваши песни должны быть на стримингах. Музыку до выхода (до релиза) мы не слушаем.

Мы слушаем заявки в течение 8 недель. Если нам понравится музыка, то мы её опубликуем или добавим в плейлисты.
  `;
  
  bot.sendMessage(chatId, welcomeMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Предложить музыку', callback_data: 'start_suggest' }]
      ]
    }
  });
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
  
  bot.sendMessage(chatId, helpMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Предложить музыку', callback_data: 'start_suggest' }]
      ]
    }
  });
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
    bot.sendMessage(chatId, '❌ Заявка отменена.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Предложить музыку', callback_data: 'start_suggest' }]
        ]
      }
    });
  } else {
    bot.sendMessage(chatId, 'У тебя нет активной заявки для отмены.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Предложить музыку', callback_data: 'start_suggest' }]
        ]
      }
    });
  }
});

// Функция для отправки вопроса с учетом особых случаев
async function sendNextQuestion(chatId, session) {
  const questionIndex = session.currentStep;
  const totalQuestions = config.QUESTIONS.length;
  
  const questionText = `
Вопрос ${questionIndex + 1}/${totalQuestions}:
${session.getCurrentQuestion()}
  `;
  
  await bot.sendMessage(chatId, questionText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Отмена', callback_data: 'cancel_submission' }]
      ]
    }
  });
}

// Обработка callback от inline кнопок
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  if (data === 'start_suggest') {
    if (!userStates.has(userId)) {
      userStates.set(userId, new UserSession(userId));
    }
    const session = userStates.get(userId);
    session.reset();
    session.isActive = true;

    const startMessage = `
🎵 Начинаем! Отвечайте на вопросы по одному сообщению.
В любой момент можно отменить командой /cancel
    `;
    
    await bot.sendMessage(chatId, startMessage);
    await sendNextQuestion(chatId, session);
    bot.answerCallbackQuery(callbackQuery.id);
    return;
  }
  
  if (data === 'cancel_submission') {
    if (userStates.has(userId)) {
      const session = userStates.get(userId);
      session.reset();
    }
    await bot.sendMessage(chatId, '❌ Заявка отменена.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Предложить музыку', callback_data: 'start_suggest' }]
        ]
      }
    });
    bot.answerCallbackQuery(callbackQuery.id);
    return;
  }
  
  bot.answerCallbackQuery(callbackQuery.id, { text: 'Неизвестное действие' });
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
    bot.sendMessage(chatId, 'Чтобы начать предложение трека, нажмите кнопку ниже', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Предложить музыку', callback_data: 'start_suggest' }]
        ]
      }
    });
    return;
  }
  
  const session = userStates.get(userId);
  
  if (!session.isActive) {
    bot.sendMessage(chatId, 'Чтобы начать предложение трека, нажмите кнопку ниже', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Предложить музыку', callback_data: 'start_suggest' }]
        ]
      }
    });
    return;
  }
  
  // Валидации по шагам
  const stepIndex = session.currentStep;
  let processedAnswer = userMessage;

  // Вопрос 5: ссылка на прослушивание (только одна, разрешенные домены)
  if (stepIndex === 4) {
    const { count, url } = hasExactlyOneUrl(userMessage);
    if (count !== 1 || !url) {
      await bot.sendMessage(chatId, 'Отправьте ровно одну ссылку на прослушивание (Spotify, Яндекс Музыка или BandLink).');
      await sendNextQuestion(chatId, session);
      return;
    }
    if (!isAllowedListeningHost(url.hostname)) {
      await bot.sendMessage(chatId, 'Ссылка должна быть на Spotify, Яндекс Музыка или BandLink.');
      await sendNextQuestion(chatId, session);
      return;
    }
    processedAnswer = url.toString();
  }

  // Вопрос 6: ссылка на соцсеть (ровно одна валидная ссылка)
  if (stepIndex === 5) {
    const { count, url } = hasExactlyOneUrl(userMessage);
    if (count !== 1 || !url) {
      await bot.sendMessage(chatId, 'Отправьте ровно одну ссылку на вашу соцсеть.');
      await sendNextQuestion(chatId, session);
      return;
    }
    processedAnswer = url.toString();
  }

  // Сохраняем валидированный ответ
  session.addAnswer(processedAnswer);
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
      
      const finalMessage = `
Спасибо за предложку! Мы рассмотрим вашу музыку в течение 8 недель, и если нам понравится, то выложим в соцсетях, либо добавим в плейлисты.

Если вы хотите попасть к нам без очереди, то пишите Иннокентию: t.me/rodpromo
      `;
      
      bot.sendMessage(chatId, finalMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Предложить ещё один релиз', callback_data: 'start_suggest' }]
          ]
        }
      });
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
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware для парсинга JSON
app.use(express.json());

// Статические файлы для админ панели
app.use('/admin', express.static(path.join(__dirname, 'public')));

// Простой endpoint для проверки здоровья бота
app.get('/', (req, res) => {
  res.json({
    status: 'Bot is running! 🚀',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    adminPanel: '/admin/admin.html'
  });
});

// Редирект на админ панель
app.get('/admin', (req, res) => {
  res.redirect('/admin/admin.html');
});

// API для получения вопросов
app.get('/api/questions', (req, res) => {
  try {
    res.json({
      questions: config.QUESTIONS,
      count: config.QUESTIONS.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting questions:', error);
    res.status(500).json({ error: 'Ошибка при получении вопросов' });
  }
});

// API для сохранения вопросов
app.post('/api/questions', (req, res) => {
  try {
    const { questions } = req.body;
    
    if (!Array.isArray(questions)) {
      return res.status(400).json({ error: 'Вопросы должны быть массивом' });
    }
    
    if (questions.length === 0) {
      return res.status(400).json({ error: 'Список вопросов не может быть пустым' });
    }
    
    // Валидация вопросов
    const invalidQuestions = questions.filter(q => !q || typeof q !== 'string' || !q.trim());
    if (invalidQuestions.length > 0) {
      return res.status(400).json({ error: 'Все вопросы должны быть заполнены' });
    }
    
    // Обновляем конфигурацию
    config.QUESTIONS = questions.map(q => q.trim());
    
    // Сохраняем в файл конфигурации
    saveConfigToFile();
    
    res.json({
      success: true,
      message: 'Вопросы успешно сохранены',
      questions: config.QUESTIONS,
      count: config.QUESTIONS.length,
      timestamp: new Date().toISOString()
    });
    
    console.log('Questions updated:', config.QUESTIONS);
    
  } catch (error) {
    console.error('Error saving questions:', error);
    res.status(500).json({ error: 'Ошибка при сохранении вопросов' });
  }
});

// API для получения ссылки на Google Sheets
app.get('/api/sheets-url', (req, res) => {
  try {
    if (!config.GOOGLE_SHEET_ID) {
      return res.status(404).json({ error: 'Google Sheets ID не настроен' });
    }
    
    const url = `https://docs.google.com/spreadsheets/d/${config.GOOGLE_SHEET_ID}/edit`;
    res.json({ url });
  } catch (error) {
    console.error('Error getting sheets URL:', error);
    res.status(500).json({ error: 'Ошибка при получении ссылки' });
  }
});

// API для обновления заголовков в Google Sheets
app.post('/api/update-sheets-headers', async (req, res) => {
  try {
    await sheetsService.updateHeaders();
    res.json({
      success: true,
      message: 'Заголовки в Google Sheets обновлены',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating sheets headers:', error);
    res.status(500).json({ error: 'Ошибка при обновлении заголовков' });
  }
});

// Функция для сохранения конфигурации в файл
function saveConfigToFile() {
  try {
    const configPath = path.join(__dirname, 'config.js');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Создаем новый контент с обновленными вопросами
    const questionsArray = config.QUESTIONS.map(q => `    '${q.replace(/'/g, "\\'")}'`).join(',\n');
    const newQuestionsSection = `  // Bot Configuration
  QUESTIONS: [
${questionsArray}
  ]`;
    
    // Заменяем секцию с вопросами
    const updatedContent = configContent.replace(
      /\/\/ Bot Configuration\s*\n\s*QUESTIONS:\s*\[[^\]]*\]/,
      newQuestionsSection
    );
    
    fs.writeFileSync(configPath, updatedContent, 'utf8');
    console.log('Configuration saved to file');
  } catch (error) {
    console.error('Error saving config to file:', error);
  }
}

// Запускаем HTTP сервер
app.listen(PORT, () => {
  console.log(`HTTP Server is running on port ${PORT}`);
  console.log(`Admin panel available at: http://localhost:${PORT}/admin`);
});

module.exports = bot; 