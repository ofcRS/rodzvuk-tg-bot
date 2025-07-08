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
    'Как тебя зовут?',
    'Исполнитель и название трека',
    'Ссылка на трек (YouTube, Spotify, SoundCloud и т.д.)',
    'Язык трека (русский/английский)',
    'Жанр музыки',
    'Почему рекомендуешь этот трек?',
    'Твой контакт для связи (опционально)'
  ]
}; 