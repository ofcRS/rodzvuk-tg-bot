require('dotenv').config();

module.exports = {
  // Telegram Bot Configuration
  BOT_TOKEN: process.env.BOT_TOKEN,
  
  // Google Sheets Configuration
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
  GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
  
  // Bot Configuration
  QUESTIONS: [
    'Напишите название артиста',
    'Напишите название релиза (песни, альбома)',
    'Ваш город?',
    'Укажите ваши жанры на английском языке (максимум 3 жанра).',
    'Пришлите 1 (одну) ссылку на прослушивание. Либо Яндекс Музыка, либо Spotify, либо BandLink. Релиз должен быть уже доступен на стримингах. Ссылка должна быть только одна, если их будет несколько, то заявка впоследствии будет удалена без прослушивания.',
    'Укажите 1 (одну) ссылку на вашу соцсеть: либо ВК, либо Телеграм, либо другая. Только одна ссылка.',
    'Пришлите короткое описание релиза. Максимум - 200 слов. Без ссылок. Что вас вдохновило? Каких артистов любите? Какое настроение релиза?',
    'Укажите ваш e-mail'
  ]
}; 