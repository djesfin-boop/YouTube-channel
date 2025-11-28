// ============================================
// ADMIN.JS - Admin Panel Logic
// YouTube Channel Scraper Pro 3.0
// ============================================

const Admin = {
    init() {
        if (!this.checkAuth()) return;
        this.bindEvents();
        this.loadDashboard();
        this.loadApiKeyStatus();
    },

    checkAuth() {
        const pwd = sessionStorage.getItem('admin_auth');
        if (pwd !== 'admin') {
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('adminPanel').style.display = 'none';
            return false;
        }
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        return true;
    },

    login() {
        const pwd = document.getElementById('adminPassword').value;
        if (pwd === 'admin') {
            sessionStorage.setItem('admin_auth', 'admin');
            this.checkAuth();
            this.loadDashboard();
            this.loadApiKeyStatus();
        } else {
            alert('Неверный пароль!');
        }
    },

    logout() {
        sessionStorage.removeItem('admin_auth');
        this.checkAuth();
    },

    loadApiKeyStatus() {
        const apiKey = localStorage.getItem('youtube_api_key');
        const statusEl = document.getElementById('apiKeyStatus');
        const inputEl = document.getElementById('apiKeyInput');
        
        if (apiKey) {
            statusEl.textContent = '✅ API ключ сохранён (' + apiKey.substring(0, 10) + '...)';
            statusEl.style.color = '#4CAF50';
            inputEl.value = apiKey;
        } else {
            statusEl.textContent = '⚠️ API ключ не установлен';
            statusEl.style.color = '#ff9800';
        }
    },

    saveApiKey() {
        const apiKey = document.getElementById('apiKeyInput').value.trim();
        if (!apiKey) {
            alert('Введите API ключ!');
            return;
        }
        if (!apiKey.startsWith('AIza')) {
            alert('Некорректный формат API ключа. Ключ должен начинаться с AIza');
            return;
        }
        localStorage.setItem('youtube_api_key', apiKey);
        this.loadApiKeyStatus();
        alert('✅ API ключ успешно сохранён!');
    },

    loadDashboard() {
        const quota = Storage.getQuota();
        document.getElementById('totalRequests').textContent = quota.used;
        
        const cache = Cache.getAll();
        document.getElementById('cachedChannels').textContent = Object.keys(cache).length;
        
        const favorites = Storage.getFavorites();
        document.getElementById('favoriteChannels').textContent = favorites.length;
        
        this.renderCacheList(cache);
        this.renderFavoritesList(favorites);
    },

    renderCacheList(cache) {
        const container = document.getElementById('cacheList');
        const channels = Object.keys(cache);
        
        if (channels.length === 0) {
            container.innerHTML = '<p>Кэш пуст</p>';
            return;
        }
        
        container.innerHTML = channels.map(id => {
            const data = cache[id];
            return `<div class="cache-item">
                <span>${data.channelTitle || id}</span>
                <span>${data.videos?.length || 0} видео</span>
                <button onclick="Admin.removeFromCache('${id}')">Удалить</button>
            </div>`;
        }).join('');
    },

    renderFavoritesList(favorites) {
        const container = document.getElementById('favoritesList');
        
        if (favorites.length === 0) {
            container.innerHTML = '<p>Нет избранных</p>';
            return;
        }
        
        container.innerHTML = favorites.map(fav => {
            return `<div class="favorite-item">
                <span>${fav.title}</span>
                <button onclick="Admin.removeFavorite('${fav.id}')">Удалить</button>
            </div>`;
        }).join('');
    },

    clearCache() {
        if (confirm('Очистить весь кэш?')) {
            Cache.clear();
            this.loadDashboard();
            alert('Кэш очищен!');
        }
    },

    removeFromCache(channelId) {
        Cache.remove(channelId);
        this.loadDashboard();
    },

    resetQuota() {
        if (confirm('Сбросить счётчик запросов?')) {
            Storage.resetQuota();
            this.loadDashboard();
            alert('Счётчик сброшен!');
        }
    },

    clearFavorites() {
        if (confirm('Очистить все избранные?')) {
            localStorage.removeItem('yt_favorites');
            this.loadDashboard();
            alert('Избранные очищены!');
        }
    },

    removeFavorite(id) {
        const favorites = Storage.getFavorites().filter(f => f.id !== id);
        localStorage.setItem('yt_favorites', JSON.stringify(favorites));
        this.loadDashboard();
    },

    bindEvents() {
        document.getElementById('adminPassword')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
    }
};

document.addEventListener('DOMContentLoaded', () => Admin.init());
