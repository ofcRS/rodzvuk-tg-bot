module.exports = {
  apps: [
    {
      name: 'rodzvuk-tg-bot',
      script: './bot.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      // Метки времени в логах: без них дату, когда бот оглох, пришлось
      // восстанавливать по mtime файлов логов.
      time: true,
      // Сторож опроса намеренно завершает процесс, поэтому разводим перезапуски,
      // чтобы недоступность Telegram не превратилась в цикл рестартов.
      exp_backoff_restart_delay: 1000,
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};


