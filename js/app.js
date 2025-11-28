// ==========================================
// APP.JS - Main Application Logic (FIXED)
// YouTube Channel Scraper Pro 3.0
// ==========================================

const App = {
    allVideos: [],
    currentChannel: null,
    
    init() {
        this.bindEvents();
        this.updateQuotaDisplay();
        this.loadHistory();
        this.loadFavorites();
    },
    
    bindEvents() {
        document.getElementById('loadBtn')?.addEventListener('click', () => this.loadVideos());
        document.getElementById('downloadBtn')?.addEventListener('click', () => this.downloadData());
        document.getElementById('addFavoriteBtn')?.addEventListener('click', () => this.toggleFavorite());
    },
    
    updateQuotaDisplay() {
        const quota = Storage.checkUserQuota();
        const el = document.getElementById('quotaDisplay');
        if (el) {
            el.innerHTML = `Осталось: <strong>${quota.remaining}</strong> / ${quota.limit}`;
            if (quota.remaining === 0) el.classList.add('exhausted');
        }
        
        const bar = document.getElementById('quotaBar');
        if (bar) bar.style.width = ((quota.used / quota.limit) * 100) + '%';
    },
    
    async loadVideos() {
        const quota = Storage.checkUserQuota();
        if (!quota.canRequest) {
            this.showStatus('error', '❌ Лимит запросов исчерпан. Приходите завтра!');
            return;
        }
        
        const channelInput = document.getElementById('channelInput')?.value?.trim();
        if (!channelInput) {
            this.showStatus('error', '❌ Заполните Channel ID или URL');
            return;
        }
        
        this.allVideos = [];
        document.getElementById('videoList').style.display = 'none';
        document.getElementById('downloadBtn').disabled = true;
        document.getElementById('loadBtn').disabled = true;
        
        try {
            // ✅ ИСПРАВЛЕНО: Получаем Channel ID локально (без API)
            const channelId = this.extractChannelId(channelInput);
            if (!channelId) {
                this.showStatus('error', '❌ Неверный Channel ID или URL');
                return;
            }
            
            // ✅ ИСПРАВЛЕНО: Проверяем кэш
            const cached = Cache.get(channelId);
            if (cached && cached.length > 0) {
                this.allVideos = cached;
                this.showStatus('success', `✅ Загружено из кэша: ${cached.length} видео`);
                this.displayVideos();
                document.getElementById('downloadBtn').disabled = false;
                return;
            }
            
            // ✅ ИСПРАВЛЕНО: Вызываем BACKEND, а не YouTube API напрямую!
            this.showStatus('info', '🔄 Загрузка видео...');
            await this.fetchAllVideosFromBackend(channelId);
            
            // Увеличиваем квоты
            Storage.incrementUserQuota();
            Storage.incrementGlobalQuota();
            
            // Сохраняем в кэш
            Cache.set(channelId, this.allVideos, channelInput);
            Storage.addToHistory({ id: channelId, name: channelInput, videoCount: this.allVideos.length });
            
            this.currentChannel = { id: channelId, name: channelInput };
            this.showStatus('success', `✅ Загружено ${this.allVideos.length} видео`);
            this.displayVideos();
            document.getElementById('downloadBtn').disabled = false;
            this.updateQuotaDisplay();
            this.loadHistory();
            
        } catch (error) {
            this.showStatus('error', `❌ Ошибка: ${error.message}`);
        } finally {
            document.getElementById('loadBtn').disabled = false;
        }
    },
    
    // ✅ НОВАЯ ФУНКЦИЯ: Вызов backend вместо YouTube API
    async function fetchVideos() {
    const quota = getQuotaInfo();
    if (quota.remaining <= 0) {
        showStatus('❌ Лимит запросов исчерпан. Приходите завтра!', 'error');
        return;
    }
    
    const channelInput = document.getElementById('channelId').value.trim();
    if (!channelInput) {
        showStatus('❌ Заполните Channel ID или URL', 'error');
        return;
    }
    
    try {
        const channelId = extractChannelId(channelInput);
        if (!channelId) {
            showStatus('❌ Неверный Channel ID или URL', 'error');
            return;
        }
        
        showStatus('🔄 Загрузка видео...', 'info');
        document.querySelector('.btn-primary').disabled = true;
        
        // ✅ ВЫЗЫВАЕМ BACKEND, А НЕ YOUTUBE API!
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId: channelId })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка загрузки');
        }
        
        const data = await response.json();
        allVideos = data.videos || [];
        channelData = data.channel || {};
        
        incrementQuota();
        displayResults();
        showStatus(`✅ Загружено ${allVideos.length} видео!`, 'success');
        
    } catch (error) {
        showStatus(`❌ Ошибка: ${error.message}`, 'error');
    } finally {
        document.querySelector('.btn-primary').disabled = false;
    }
}

    
    // ✅ Извлечение Channel ID из разных форматов
    extractChannelId(input) {
        // Уже Channel ID?
        if (input.startsWith('UC') && input.length === 24) return input;
        
        // URL формат: youtube.com/@username
        if (input.includes('youtube.com/@')) {
            return input.split('@')[1].split('/')[0].split('?')[0];
        }
        
        // URL формат: youtube.com/c/username
        if (input.includes('youtube.com/c/')) {
            return input.split('/c/')[1].split('/')[0].split('?')[0];
        }
        
        // URL формат: youtube.com/channel/UC...
        if (input.includes('youtube.com/channel/')) {
            return input.split('/channel/')[1].split('/')[0].split('?')[0];
        }
        
        return null;
    },
    
    displayVideos() {
        const list = document.getElementById('videoList');
        if (!list) return;
        
        list.innerHTML = this.allVideos.map((v, i) => `
            <div class="video-item">
                <div class="video-info">
                    <a href="${v.url}" target="_blank" class="video-title">${i + 1}. ${this.escapeHtml(v.title)}</a>
                    <div class="video-meta">${new Date(v.publishedAt).toLocaleDateString('ru-RU')} • ${v.id}</div>
                </div>
                <button class="btn-copy" onclick="App.copyToClipboard('${v.url}')">📋 Копировать</button>
            </div>
        `).join('');
        
        document.getElementById('videoCount').textContent = `${this.allVideos.length}`;
        list.style.display = 'block';
        document.getElementById('noResults').style.display = 'none';
    },
    
    // ✅ Защита от XSS
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },
    
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showStatus('success', '✅ Скопировано в буфер обмена!');
            setTimeout(() => document.getElementById('statusMessage').classList.remove('show'), 2000);
        });
    },
    
    downloadData() {
        if (this.allVideos.length === 0) {
            this.showStatus('error', '❌ Нет данных для экспорта');
            return;
        }
        
        const format = document.getElementById('format')?.value || 'json';
        let content, filename, type;
        
        switch(format) {
            case 'json':
                content = JSON.stringify({
                    channel: this.currentChannel,
                    videos: this.allVideos,
                    exportDate: new Date().toISOString()
                }, null, 2);
                filename = 'youtube-videos.json';
                type = 'application/json';
                break;
            
            case 'csv':
                content = 'Номер,Название,URL,Дата,ID\n';
                this.allVideos.forEach((v, i) => {
                    content += `"${i + 1}","${v.title.replace(/"/g, '""')}","${v.url}","${v.publishedAt}","${v.id}"\n`;
                });
                filename = 'youtube-videos.csv';
                type = 'text/csv';
                break;
            
            case 'txt':
                content = `Канал: ${this.currentChannel.name}\n`;
                content += `Видео: ${this.allVideos.length}\n`;
                content += `Дата: ${new Date().toLocaleString('ru-RU')}\n\n`;
                this.allVideos.forEach((v, i) => {
                    content += `${i + 1}. ${v.title}\n${v.url}\n${v.publishedAt}\n\n`;
                });
                filename = 'youtube-videos.txt';
                type = 'text/plain';
                break;
            
            default: return;
        }
        
        const blob = new Blob([content], { type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        this.showStatus('success', `✅ Файл ${filename} скачан!`);
        setTimeout(() => document.getElementById('statusMessage').classList.remove('show'), 3000);
    },
    
    loadFromHistory(channelId) {
        document.getElementById('channelInput').value = channelId;
    },
    
    loadFavorites() {
        const user = Storage.getUserData();
        const el = document.getElementById('favoritesList');
        if (!el) return;
        
        if (user.favorites.length === 0) {
            el.innerHTML = '<p style="color: var(--color-text-secondary);">Нет избранных</p>';
            return;
        }
        
        el.innerHTML = user.favorites.map(f => `
            <div class="favorite-item">
                <span onclick="App.loadFromHistory('${f.id}')" style="cursor: pointer; flex: 1;">${f.name}</span>
                <button onclick="App.removeFavorite('${f.id}')" class="btn-remove">❌</button>
            </div>
        `).join('');
    },
    
    toggleFavorite() {
        if (!this.currentChannel) {
            this.showStatus('error', '❌ Сначала загрузите канал');
            return;
        }
        
        if (Storage.isFavorite(this.currentChannel.id)) {
            Storage.removeFromFavorites(this.currentChannel.id);
            this.showStatus('success', '✅ Удалено из избранного');
        } else {
            Storage.addToFavorites(this.currentChannel);
            this.showStatus('success', '✅ Добавлено в избранное');
        }
        
        this.loadFavorites();
    },
    
    removeFavorite(id) {
        Storage.removeFromFavorites(id);
        this.loadFavorites();
    },
    
    showStatus(type, message) {
        const el = document.getElementById('statusMessage');
        if (!el) return;
        
        el.className = `status-message show ${type}`;
        el.textContent = message;
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function showStatus(message, type = 'info') {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    
    el.className = `status-message show ${type}`;
    el.textContent = message;
    
    // Автоскрыть через 3 сек для успеха
    if (type === 'success') {
        setTimeout(() => el.classList.remove('show'), 3000);
    }
}

function displayResults() {
    const statsContainer = document.getElementById('statsContainer');
    const videosContainer = document.getElementById('videosContainer');
    const noResults = document.getElementById('noResults');
    
    if (!allVideos || allVideos.length === 0) {
        statsContainer.style.display = 'none';
        videosContainer.style.display = 'none';
        noResults.style.display = 'block';
        return;
    }
    
    document.getElementById('totalVideos').textContent = allVideos.length;
    document.getElementById('channelName').textContent = currentChannel.name || '-';
    
    statsContainer.style.display = 'grid';
    videosContainer.style.display = 'block';
    noResults.style.display = 'none';
    
    filterAndSortVideos();
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function exportData(format) {
    if (!allVideos || allVideos.length === 0) {
        showStatus('❌ Нет данных для экспорта', 'error');
        return;
    }
    
    let content, filename, type;
    
    switch(format) {
        case 'json':
            content = JSON.stringify({
                channel: currentChannel,
                videos: allVideos,
                exportDate: new Date().toISOString()
            }, null, 2);
            filename = 'youtube-videos.json';
            type = 'application/json';
            break;
        
        case 'csv':
            content = 'Номер,Название,URL,Дата,ID\n';
            allVideos.forEach((v, i) => {
                content += `"${i + 1}","${v.title.replace(/"/g, '""')}","${v.url}","${v.publishedAt}","${v.id}"\n`;
            });
            filename = 'youtube-videos.csv';
            type = 'text/csv';
            break;
        
        case 'txt':
            content = `Канал: ${currentChannel.name}\n`;
            content += `Видео: ${allVideos.length}\n`;
            content += `Дата: ${new Date().toLocaleString('ru-RU')}\n\n`;
            allVideos.forEach((v, i) => {
                content += `${i + 1}. ${v.title}\n${v.url}\n${v.publishedAt}\n\n`;
            });
            filename = 'youtube-videos.txt';
            type = 'text/plain';
            break;
        
        default: return;
    }
    
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showStatus(`✅ Файл ${filename} скачан!`, 'success');
}

function copyAllLinks() {
    if (!allVideos || allVideos.length === 0) return;
    
    const links = allVideos.map((v, i) => `${i + 1}. ${v.title}\n${v.url}`).join('\n\n');
    navigator.clipboard.writeText(links).then(() => {
        showStatus('✅ Ссылки скопированы в буфер!', 'success');
    });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showStatus('✅ Скопировано!', 'success');
    });
}

function showApiHelp() {
    alert(`ℹ️ О ПРИЛОЖЕНИИ:\n\n🔐 БЕЗОПАСНОСТЬ: API ключ хранится на сервере (не видим в браузере)\n\n📊 КВОТЫ:\n• 5 запросов в день на пользователя\n• 10,000 единиц в день (глобальный лимит)\n• Сброс квоты в 00:00 MSK\n\n⚠️ ЛИЦЕНЗИЯ:\n• © 2025 YouTube Channel Scraper Pro\n• Авторское произведение\n• Бесплатное распространение для группы\n• При коммерциализации требуется согласование`);
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('sortSelect').value = 'newest';
    filterAndSortVideos();
}
