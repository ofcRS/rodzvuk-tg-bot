// Глобальные переменные
let questions = [];
let isLoading = false;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    loadQuestions();
    updateLastUpdated();
});

// Функция для показа уведомлений
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Функция для показа загрузки
function showLoading(element, text = '') {
    if (isLoading) return;
    isLoading = true;
    
    const originalText = element.textContent;
    element.innerHTML = `<span class="loading"></span>${text || 'Загрузка...'}`;
    element.disabled = true;
    
    return () => {
        element.innerHTML = originalText;
        element.disabled = false;
        isLoading = false;
    };
}

// Загрузка вопросов с сервера
async function loadQuestions() {
    const loadBtn = document.querySelector('.btn-secondary');
    const hideLoading = showLoading(loadBtn, 'Загрузка вопросов...');
    
    try {
        const response = await fetch('/api/questions');
        if (!response.ok) {
            throw new Error('Ошибка при загрузке вопросов');
        }
        
        const data = await response.json();
        questions = data.questions || [];
        
        renderQuestions();
        updateStats();
        showNotification('Вопросы успешно загружены!', 'success');
        
    } catch (error) {
        console.error('Error loading questions:', error);
        showNotification('Ошибка при загрузке вопросов', 'error');
        
        // Показываем заглушку если сервер недоступен
        questions = [
            'Как тебя зовут?',
            'Исполнитель и название трека',
            'Ссылка на трек (YouTube, Spotify, SoundCloud и т.д.)',
            'Язык трека (русский/английский)',
            'Жанр музыки',
            'Почему рекомендуешь этот трек?',
            'Твой контакт для связи (опционально)'
        ];
        renderQuestions();
        updateStats();
    } finally {
        hideLoading();
    }
}

// Отрисовка списка вопросов
function renderQuestions() {
    const questionsList = document.getElementById('questionsList');
    questionsList.innerHTML = '';
    
    questions.forEach((question, index) => {
        const questionElement = createQuestionElement(question, index);
        questionsList.appendChild(questionElement);
    });
}

// Создание элемента вопроса
function createQuestionElement(question, index) {
    const div = document.createElement('div');
    div.className = 'question-item';
    div.dataset.index = index;
    
    div.innerHTML = `
        <div class="question-header">
            <div class="question-number">${index + 1}</div>
            <div class="button-group">
                <button class="btn btn-secondary" onclick="moveQuestion(${index}, -1)" ${index === 0 ? 'disabled' : ''}>
                    ↑
                </button>
                <button class="btn btn-secondary" onclick="moveQuestion(${index}, 1)" ${index === questions.length - 1 ? 'disabled' : ''}>
                    ↓
                </button>
                <button class="btn btn-danger" onclick="deleteQuestion(${index})">
                    🗑️
                </button>
            </div>
        </div>
        <textarea 
            class="question-text" 
            placeholder="Введите текст вопроса..." 
            onchange="updateQuestion(${index}, this.value)"
            onkeyup="updateQuestion(${index}, this.value)"
        >${question}</textarea>
    `;
    
    return div;
}

// Обновление текста вопроса
function updateQuestion(index, value) {
    questions[index] = value;
    updateStats();
}

// Добавление нового вопроса
function addQuestion() {
    questions.push('Новый вопрос');
    renderQuestions();
    updateStats();
    
    // Прокрутка к последнему вопросу
    const questionsList = document.getElementById('questionsList');
    const lastQuestion = questionsList.lastElementChild;
    if (lastQuestion) {
        lastQuestion.scrollIntoView({ behavior: 'smooth' });
        const textarea = lastQuestion.querySelector('.question-text');
        textarea.focus();
        textarea.select();
    }
    
    showNotification('Вопрос добавлен!', 'success');
}

// Удаление вопроса
function deleteQuestion(index) {
    if (questions.length <= 1) {
        showNotification('Нельзя удалить последний вопрос!', 'error');
        return;
    }
    
    if (confirm(`Удалить вопрос "${questions[index]}"?`)) {
        questions.splice(index, 1);
        renderQuestions();
        updateStats();
        showNotification('Вопрос удален!', 'success');
    }
}

// Перемещение вопроса
function moveQuestion(index, direction) {
    const newIndex = index + direction;
    
    if (newIndex < 0 || newIndex >= questions.length) {
        return;
    }
    
    [questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];
    renderQuestions();
    updateStats();
    
    showNotification(`Вопрос перемещен!`, 'success');
}

// Сохранение вопросов на сервер
async function saveQuestions() {
    const saveBtn = document.querySelector('.btn-primary');
    const hideLoading = showLoading(saveBtn, 'Сохранение...');
    
    try {
        // Валидация
        if (questions.length === 0) {
            throw new Error('Список вопросов не может быть пустым');
        }
        
        const emptyQuestions = questions.filter(q => !q.trim());
        if (emptyQuestions.length > 0) {
            throw new Error('Все вопросы должны быть заполнены');
        }
        
        const response = await fetch('/api/questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ questions })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при сохранении вопросов');
        }
        
        updateLastUpdated();
        showNotification('Вопросы успешно сохранены!', 'success');
        
    } catch (error) {
        console.error('Error saving questions:', error);
        showNotification(error.message || 'Ошибка при сохранении', 'error');
    } finally {
        hideLoading();
    }
}

// Экспорт вопросов в JSON
function exportQuestions() {
    const dataStr = JSON.stringify(questions, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `questions_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('Вопросы экспортированы!', 'success');
}

// Просмотр Google Sheets
async function viewGoogleSheets() {
    try {
        const response = await fetch('/api/sheets-url');
        if (response.ok) {
            const data = await response.json();
            window.open(data.url, '_blank');
        } else {
            showNotification('Не удалось получить ссылку на таблицу', 'error');
        }
    } catch (error) {
        console.error('Error getting sheets URL:', error);
        showNotification('Ошибка при получении ссылки', 'error');
    }
}

// Обновление заголовков в Google Sheets
async function updateSheetsHeaders() {
    try {
        const response = await fetch('/api/update-sheets-headers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            showNotification('Заголовки в Google Sheets обновлены!', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Ошибка при обновлении заголовков', 'error');
        }
    } catch (error) {
        console.error('Error updating sheets headers:', error);
        showNotification('Ошибка при обновлении заголовков', 'error');
    }
}

// Обновление статистики
function updateStats() {
    const questionCount = document.getElementById('questionCount');
    questionCount.textContent = questions.length;
}

// Обновление времени последнего обновления
function updateLastUpdated() {
    const lastUpdated = document.getElementById('lastUpdated');
    const now = new Date().toLocaleTimeString('ru-RU');
    lastUpdated.textContent = now;
}

// Функция для импорта вопросов из JSON
function importQuestions() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedQuestions = JSON.parse(e.target.result);
                    if (Array.isArray(importedQuestions)) {
                        questions = importedQuestions;
                        renderQuestions();
                        updateStats();
                        showNotification('Вопросы успешно импортированы!', 'success');
                    } else {
                        throw new Error('Неверный формат файла');
                    }
                } catch (error) {
                    showNotification('Ошибка при импорте файла', 'error');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

// Обработка горячих клавиш
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey || event.metaKey) {
        switch(event.key) {
            case 's':
                event.preventDefault();
                saveQuestions();
                break;
            case 'n':
                event.preventDefault();
                addQuestion();
                break;
            case 'r':
                event.preventDefault();
                loadQuestions();
                break;
        }
    }
});

// Автосохранение каждые 30 секунд
setInterval(() => {
    if (questions.length > 0) {
        saveQuestions();
    }
}, 30000);

console.log('Админ панель загружена! Горячие клавиши:');
console.log('- Ctrl+S: Сохранить');
console.log('- Ctrl+N: Добавить вопрос');
console.log('- Ctrl+R: Перезагрузить'); 