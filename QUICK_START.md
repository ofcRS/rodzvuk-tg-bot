# Быстрый запуск телеграм бота

## Шаг 1: Создайте телеграм бота
1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/newbot`
3. Выберите имя и username для бота
4. Скопируйте токен бота

## Шаг 2: Создайте Google Sheets таблицу
1. Перейдите в [Google Sheets](https://sheets.google.com)
2. Создайте новую таблицу
3. Скопируйте ID из URL (например: `1ABC123DEF456`)

## Шаг 3: Настройте Google Service Account
1. Перейдите в [Google Cloud Console](https://console.cloud.google.com)
2. Создайте проект или выберите существующий
3. Включите Google Sheets API
4. Создайте Service Account
5. Скачайте JSON ключ
6. Поделитесь таблицей с email из Service Account

## Шаг 4: Настройте переменные окружения
1. Скопируйте файл `env.example` в `.env`:
   ```bash
   cp env.example .env
   ```
2. Заполните данные в `.env`:
   ```
   BOT_TOKEN=your_bot_token_here
   GOOGLE_SHEET_ID=your_sheet_id_here
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_key_here\n-----END PRIVATE KEY-----\n"
   GOOGLE_CLIENT_EMAIL=your_service_account@project.iam.gserviceaccount.com
   ```

## Шаг 5: Запустите бота
```bash
npm start
```

Готово! Теперь ваш бот работает и готов принимать предложения треков! 🎵

## Команды бота
- `/start` - Приветствие
- `/suggest` - Предложить трек
- `/cancel` - Отменить заявку
- `/help` - Помощь

## Что дальше?
- Настройте автозапуск с помощью PM2
- Разверните на сервере или Heroku
- Кастомизируйте вопросы в `config.js` 