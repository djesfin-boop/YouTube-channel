// ==========================================
// APP.JS - Main Application Logic
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
            el.innerHTML = `<span>Осталось: <strong>${quota.remaining}</strong> / ${quota.limit}</span>`;
            if (quota.remaining === 0) el.classList.add('exhausted');
        }
        const bar = document.getElementById('quotaBar');
        if (bar) bar.style.width = ((quota.used / quota.limit) * 100) + '%';
    },

    async loadVideos() {
        const quota = Storage.checkUserQuota();
        if (!quota.canRequest) {
            this.showStatus('error', 'Лимит запросов исчерпан. Приходите завтра!');
            return;
        }
        const admin = Storage.getAdminData();
        const apiKey = admin.apiKey || document.getElementById('apiKey')?.value?.trim();
        const channelInput = document.getElementById('channelInput')?.value?.trim();
        if (!apiKey || !channelInput) {
            this.showStatus('error', 'Заполните все поля');
            return;
        }
        this.allVideos = [];
        document.getElementById('videoList').style.display = 'none';
        document.getElementById('downloadBtn').disabled = true;
        document.getElementById('loadBtn').disabled = true;
        try {
            // Check cache first
            const channelId = await this.getChannelId(apiKey, channelInput);
            const cached = Cache.get(channelId);
            if (cached) {
                this.allVideos = cached;
                this.showStatus('success', `Загружено из кэша: ${cached.length} видео`);
                this.displayVideos();
                document.getElementById('downloadBtn').disabled = false;
                document.getElementById('loadBtn').disabled = false;
                return;
            }
            this.showStatus('info', 'Загрузка видео...');
            await this.fetchAllVideos(apiKey, channelId);
            Storage.incrementUserQuota();
            Storage.incrementGlobalQuota();
            Cache.set(channelId, this.allVideos, channelInput);
            Storage.addToHistory({ id: channelId, name: channelInput, videoCount: this.allVideos.length });
            this.currentChannel = { id: channelId, name: channelInput };
            this.showStatus('success', `Загружено ${this.allVideos.length} видео`);
            this.displayVideos();
            document.getElementById('downloadBtn').disabled = false;
            this.updateQuotaDisplay();
            this.loadHistory();
        } catch (error) {
            this.showStatus('error', `Ошибка: ${error.message}`);
        } finally {
            document.getElementById('loadBtn').disabled = false;
        }
    },

    async getChannelId(apiKey, input) {
        if (input.startsWith('UC') && input.length === 24) return input;
        let username = input;
        if (input.includes('youtube.com/@')) username = input.split('@')[1].split('/')[0].split('?')[0];
        else if (input.includes('youtube.com/c/')) username = input.split('/c/')[1].split('/')[0].split('?')[0];
        else if (input.includes('youtube.com/channel/')) return input.split('/channel/')[1].split('/')[0].split('?')[0];
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(username)}&key=${apiKey}&maxResults=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        if (!data.items?.length) throw new Error('Канал не найден');
        return data.items[0].id.channelId;
    },

    async fetchAllVideos(apiKey, channelId) {
        let pageToken = '';
        do {
            const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet&order=date&maxResults=50&type=video${pageToken ? '&pageToken=' + pageToken : ''}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            if (data.items) {
                this.allVideos = this.allVideos.concat(data.items.map(item => ({
                    videoId: item.id.videoId,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    publishedAt: item.snippet.publishedAt,
                    thumbnail: item.snippet.thumbnails?.high?.url || '',
                    url: `https://www.youtube.com/watch?v=${item.id.videoId}`
                })));
            }
            pageToken = data.nextPageToken || '';
            this.showStatus('info', `Загружено ${this.allVideos.length} видео...`);
        } while (pageToken);
    },

    displayVideos() {
        const list = document.getElementById('videoList');
        list.innerHTML = this.allVideos.map(v => `
            <div class="video-item">
                <div class="video-title">${v.title}</div>
                <div class="video-meta">${new Date(v.publishedAt).toLocaleDateString('ru-RU')} | <a href="${v.url}" target="_blank">${v.videoId}</a></div>
            </div>
        `).join('');
        list.style.display = 'block';
    },

    downloadData() {
        const format = document.getElementById('exportFormat')?.value || 'json';
        let content, type, ext;
        if (format === 'csv') {
            content = 'ID,Title,Date,URL\n' + this.allVideos.map(v => `"${v.videoId}","${v.title.replace(/"/g,'""')}","${v.publishedAt}","${v.url}"`).join('\n');
            type = 'text/csv';
            ext = 'csv';
        } else {
            content = JSON.stringify(this.allVideos, null, 2);
            type = 'application/json';
            ext = 'json';
        }
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `youtube_videos_${Date.now()}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
    },

    showStatus(type, msg) {
        const el = document.getElementById('status');
        el.className = type;
        el.textContent = msg;
        el.style.display = 'block';
    },

    loadHistory() {
        const user = Storage.getUserData();
        const el = document.getElementById('historyList');
        if (!el) return;
        el.innerHTML = user.history.map(h => `
            <div class="history-item" onclick="App.loadFromHistory('${h.id}')">
                <span>${h.name}</span>
                <small>${h.videoCount} видео | ${new Date(h.date).toLocaleDateString('ru-RU')}</small>
            </div>
        `).join('') || '<p>История пуста</p>';
    },

    loadFromHistory(channelId) {
        document.getElementById('channelInput').value = channelId;
    },

    loadFavorites() {
        const user = Storage.getUserData();
        const el = document.getElementById('favoritesList');
        if (!el) return;
        el.innerHTML = user.favorites.map(f => `
            <div class="favorite-item">
                <span onclick="App.loadFromHistory('${f.id}')">${f.name}</span>
                <button onclick="App.removeFavorite('${f.id}')">✕</button>
            </div>
        `).join('') || '<p>Нет избранных</p>';
    },

    toggleFavorite() {
        if (!this.currentChannel) return;
        if (Storage.isFavorite(this.currentChannel.id)) {
            Storage.removeFromFavorites(this.currentChannel.id);
        } else {
            Storage.addToFavorites(this.currentChannel);
        }
        this.loadFavorites();
    },

    removeFavorite(id) {
        Storage.removeFromFavorites(id);
        this.loadFavorites();
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
