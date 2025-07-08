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
      
      // Проверяем и добавляем заголовки если таблица пустая
      await this.ensureHeaders();
      
    } catch (error) {
      console.error('Error initializing Google Sheets API:', error);
      throw error;
    }
  }

  async ensureHeaders() {
    try {
      // Проверяем, есть ли данные в первой строке
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.GOOGLE_SHEET_ID,
        range: 'Sheet1!A1:J1'
      });

      const rows = response.data.values;
      
      // Если первая строка пустая или нет данных, добавляем заголовки
      if (!rows || rows.length === 0 || !rows[0] || rows[0].length === 0) {
        await this.setupHeaders();
        await this.formatHeaders();
        console.log('Headers added to empty sheet');
      } else {
        console.log('Sheet already has headers, skipping setup');
      }
    } catch (error) {
      console.error('Error checking/setting up headers:', error);
      // Если ошибка, пробуем добавить заголовки (возможно, таблица новая)
      try {
        await this.setupHeaders();
        console.log('Headers added after error check');
      } catch (setupError) {
        console.error('Error setting up headers:', setupError);
      }
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

  async formatHeaders() {
    if (!this.initialized) {
      await this.init();
    }

    try {
      // Делаем первую строку жирной и добавляем фон
      const requests = [
        {
          repeatCell: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 10
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: 0.9,
                  green: 0.9,
                  blue: 0.9
                },
                textFormat: {
                  bold: true
                }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        }
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.GOOGLE_SHEET_ID,
        resource: {
          requests: requests
        }
      });

      console.log('Header formatting applied successfully');
    } catch (error) {
      console.error('Error formatting headers:', error);
      // Не прерываем выполнение, форматирование не критично
    }
  }
}

module.exports = new SheetsService(); 