// ==========================================
// CACHE.JS - FIFO Caching System
// YouTube Channel Scraper Pro 3.0
// ==========================================

const Cache = {
    KEY: 'yt_scraper_cache',
    MAX_CHANNELS: 100,

    getCache() {
        const data = localStorage.getItem(this.KEY);
        return data ? JSON.parse(data) : { channels: {}, order: [] };
    },

    saveCache(cache) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(cache));
        } catch (e) {
            this.cleanup();
            localStorage.setItem(this.KEY, JSON.stringify(cache));
        }
    },

    get(channelId) {
        const cache = this.getCache();
        const entry = cache.channels[channelId];
        if (!entry) return null;
        const age = Date.now() - entry.timestamp;
        if (age > 24 * 60 * 60 * 1000) {
            this.remove(channelId);
            return null;
        }
        return entry.data;
    },

    set(channelId, data, channelName = '') {
        const cache = this.getCache();
        const admin = typeof Storage !== 'undefined' ? Storage.getAdminData() : { cachePriority: [] };
        const isPriority = admin.cachePriority.includes(channelId);
        while (cache.order.length >= this.MAX_CHANNELS) {
            const toRemove = cache.order.find(id => !admin.cachePriority.includes(id));
            if (toRemove) {
                delete cache.channels[toRemove];
                cache.order = cache.order.filter(id => id !== toRemove);
            } else break;
        }
        cache.channels[channelId] = {
            data: data,
            name: channelName,
            timestamp: Date.now(),
            priority: isPriority
        };
        cache.order = cache.order.filter(id => id !== channelId);
        if (isPriority) {
            cache.order.unshift(channelId);
        } else {
            cache.order.push(channelId);
        }
        this.saveCache(cache);
    },

    remove(channelId) {
        const cache = this.getCache();
        delete cache.channels[channelId];
        cache.order = cache.order.filter(id => id !== channelId);
        this.saveCache(cache);
    },

    cleanup() {
        const cache = this.getCache();
        const admin = typeof Storage !== 'undefined' ? Storage.getAdminData() : { cachePriority: [] };
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000;
        Object.keys(cache.channels).forEach(id => {
            const entry = cache.channels[id];
            const isPriority = admin.cachePriority.includes(id);
            if (!isPriority && (now - entry.timestamp > maxAge)) {
                delete cache.channels[id];
                cache.order = cache.order.filter(i => i !== id);
            }
        });
        this.saveCache(cache);
    },

    clear() {
        localStorage.removeItem(this.KEY);
    },

    getStats() {
        const cache = this.getCache();
        const size = new Blob([JSON.stringify(cache)]).size;
        return {
            channels: Object.keys(cache.channels).length,
            sizeMB: (size / 1024 / 1024).toFixed(2),
            order: cache.order
        };
    },

    getAll() {
        return this.getCache().channels;
    }
};
