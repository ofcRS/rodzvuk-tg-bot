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
3. Включите Google Sheets API:
   - Перейдите в "APIs & Services" → "Library"
   - Найдите "Google Sheets API" и включите его
4. Создайте Service Account:
   - Перейдите в "APIs & Services" → "Credentials"
   - Нажмите "Create Credentials" → "Service Account"
   - Введите имя и описание
   - Нажмите "Create and Continue"
   - Пропустите настройки ролей (нажмите "Continue" → "Done")
5. Создайте ключ для Service Account:
   - Нажмите на созданный Service Account
   - Перейдите во вкладку "Keys"
   - Нажмите "Add Key" → "Create New Key"
   - Выберите "JSON" и нажмите "Create"
   - Скачайте JSON файл

## Шаг 4: Дайте доступ сервисному аккаунту к таблице

### 🔑 Как дать доступ к Google Sheets:

1. **Найдите email сервисного аккаунта:**
   - Откройте скачанный JSON файл
   - Найдите поле `client_email`
   - Скопируйте email (например: `my-bot@my-project-123456.iam.gserviceaccount.com`)

2. **Откройте вашу Google Sheets таблицу**

3. **Поделитесь таблицей с сервисным аккаунтом:**
   - В правом верхнем углу нажмите "Share" (Поделиться)
   - В поле "Add people and groups" вставьте email сервисного аккаунта
   - Выберите права доступа "Editor" (Редактор)
   - Уберите галочку "Notify people" (Уведомить людей)
   - Нажмите "Send" (Отправить)

4. **Скопируйте ID таблицы:**
   - Из URL таблицы скопируйте ID (между `/d/` и `/edit`)
   - Например: `https://docs.google.com/spreadsheets/d/1ABC123DEF456/edit`
   - ID: `1ABC123DEF456`

💡 **Совет:** Оставьте таблицу пустой! Бот автоматически добавит заголовки колонок при первом запуске.

## Шаг 5: Настройте переменные окружения
1. Скопируйте файл `env.example` в `.env`:
   ```bash
   cp env.example .env
   ```
2. Заполните данные в `.env`:
   ```env
   BOT_TOKEN=ваш_токен_от_BotFather
   GOOGLE_SHEET_ID=1ABC123DEF456
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nВаш_приватный_ключ_из_JSON\n-----END PRIVATE KEY-----\n"
   GOOGLE_CLIENT_EMAIL=my-bot@my-project-123456.iam.gserviceaccount.com
   ```

## Шаг 6: Запустите бота локально
```bash
npm install
npm start
```

Готово! Теперь ваш бот работает локально! 🎵

## 🚀 Деплой на Heroku

### Вариант 1: Через веб-интерфейс (проще)

1. **Создайте аккаунт на [Heroku](https://heroku.com)**

2. **Создайте новое приложение:**
   - Нажмите "New" → "Create new app"
   - Введите уникальное имя (например: `your-bot-name`)
   - Выберите регион: Europe
   - Нажмите "Create app"

3. **Подключите GitHub:**
   - Во вкладке "Deploy" выберите "GitHub"
   - Найдите репозиторий `rodzvuk-tg-bot`
   - Нажмите "Connect"

4. **Настройте переменные окружения:**
   - Перейдите во вкладку "Settings"
   - Нажмите "Reveal Config Vars"
   - Добавьте все переменные из вашего `.env` файла

5. **Разверните приложение:**
   - Во вкладке "Deploy" → "Manual deploy"
   - Нажмите "Deploy Branch"
   - Дождитесь успешного деплоя

6. **Запустите бота:**
   - Во вкладке "Resources" включите "web" dyno

### Вариант 2: Через Heroku CLI

1. **Установите Heroku CLI:**
   ```bash
   # Windows (через WinGet)
   winget install --id Heroku.HerokuCLI
   
   # macOS
   brew install heroku/brew/heroku
   
   # Linux
   curl https://cli-assets.heroku.com/install.sh | sh
   ```

2. **Авторизуйтесь в Heroku:**
   ```bash
   heroku login
   ```

3. **Создайте приложение на Heroku:**
   ```bash
   heroku create your-bot-name
   ```

4. **Настройте переменные окружения:**
   ```bash
   heroku config:set BOT_TOKEN="ваш_токен_бота"
   heroku config:set GOOGLE_SHEET_ID="ваш_id_таблицы"
   heroku config:set GOOGLE_PRIVATE_KEY="ваш_приватный_ключ"
   heroku config:set GOOGLE_CLIENT_EMAIL="ваш_email_сервис_аккаунта"
   ```

5. **Разверните приложение:**
   ```bash
   git push heroku master
   ```

6. **Запустите бота:**
   ```bash
   heroku ps:scale web=1
   ```

7. **Проверьте логи:**
   ```bash
   heroku logs --tail
   ```

### 📋 Полезные команды Heroku CLI:

```bash
# Посмотреть статус приложения
heroku ps

# Посмотреть переменные окружения
heroku config

# Перезапустить приложение
heroku restart

# Открыть приложение в браузере
heroku open

# Подключиться к консоли
heroku run bash
```

## Команды бота
- `/start` - Приветствие
- `/suggest` - Предложить трек
- `/cancel` - Отменить заявку
- `/help` - Помощь

## 🔧 Что дальше?
- ✅ Протестируйте бота в Telegram
- ✅ Проверьте, что данные сохраняются в Google Sheets
- ✅ Настройте автоматический деплой при push в GitHub
- ✅ Кастомизируйте вопросы в `config.js`

## 🆘 Устранение неполадок

### Проблемы с Google Sheets:
- Убедитесь, что Service Account имеет права "Editor"
- Проверьте правильность `GOOGLE_SHEET_ID`
- Убедитесь, что `GOOGLE_PRIVATE_KEY` содержит `\n` для переносов строк

### Проблемы с Telegram:
- Проверьте корректность `BOT_TOKEN`
- Убедитесь, что бот не запущен в другом месте

### Проблемы с Heroku:
- Проверьте, что все переменные окружения настроены
- Убедитесь, что web dyno включен
- Проверьте логи: `heroku logs --tail` 