const { google } = require('googleapis');
const config = require('./config');

class SheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // Создаем JWT клиент для аутентификации
      this.auth = new google.auth.JWT(
        config.GOOGLE_CLIENT_EMAIL,
        null,
        config.GOOGLE_PRIVATE_KEY,
        ['https://www.googleapis.com/auth/spreadsheets']
      );

      // Авторизуемся
      await this.auth.authorize();

      // Инициализируем API
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.initialized = true;
      
      console.log('Google Sheets API initialized successfully');
    } catch (error) {
      console.error('Error initializing Google Sheets API:', error);
      throw error;
    }
  }

  async addSubmission(data) {
    if (!this.initialized) {
      await this.init();
    }

    try {
      const currentDate = new Date().toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow'
      });

      const values = [
        [
          currentDate,
          data.name || '',
          data.artist || '',
          data.link || '',
          data.language || '',
          data.genre || '',
          data.reason || '',
          data.contact || '',
          data.userId || '',
          data.username || ''
        ]
      ];

      const request = {
        spreadsheetId: config.GOOGLE_SHEET_ID,
        range: 'Sheet1!A:J',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: values
        }
      };

      const response = await this.sheets.spreadsheets.values.append(request);
      console.log('Data successfully added to Google Sheets');
      return response;
    } catch (error) {
      console.error('Error adding data to Google Sheets:', error);
      throw error;
    }
  }

  async setupHeaders() {
    if (!this.initialized) {
      await this.init();
    }

    try {
      const headers = [
        'Дата',
        'Имя',
        'Исполнитель и трек',
        'Ссылка',
        'Язык',
        'Жанр',
        'Причина рекомендации',
        'Контакт',
        'User ID',
        'Username'
      ];

      const request = {
        spreadsheetId: config.GOOGLE_SHEET_ID,
        range: 'Sheet1!A1:J1',
        valueInputOption: 'RAW',
        resource: {
          values: [headers]
        }
      };

      await this.sheets.spreadsheets.values.update(request);
      console.log('Headers set up successfully');
    } catch (error) {
      console.error('Error setting up headers:', error);
      throw error;
    }
  }
}

module.exports = new SheetsService(); 