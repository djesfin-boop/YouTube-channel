// ==========================================
// STORAGE.JS - Core localStorage management
// YouTube Channel Scraper Pro 3.0
// ==========================================

const Storage = {
    KEYS: {
        ADMIN: 'yt_scraper_admin',
        USER: 'yt_scraper_user',
        CACHE: 'yt_scraper_cache'
    },

    // ========== ADMIN DATA ==========
    getAdminData() {
        const data = localStorage.getItem(this.KEYS.ADMIN);
        if (data) return JSON.parse(data);
        return {
            apiKey: '',
            apiKeyStatus: 'inactive',
            apiKeyLastChecked: null,
            dailyQuota: {
                total: 10000,
                used: 0,
                timestamp: new Date().toDateString(),
                resetTime: '00:00 MSK'
            },
            userLimits: { default: 5, vip: 10 },
            users: {},
            alerts: {
                percent80: false,
                percent95: false,
                percent100: false,
                email: '',
                telegramChatId: ''
            },
            cachePriority: []
        };
    },

    saveAdminData(data) {
        localStorage.setItem(this.KEYS.ADMIN, JSON.stringify(data));
    },

    // ========== USER DATA ==========
    getUserData() {
        const data = localStorage.getItem(this.KEYS.USER);
        if (data) return JSON.parse(data);
        return {
            odnorazo: this.generateUserId(),
            quotaToday: 0,
            quotaLimit: 5,
            quotaDate: new Date().toDateString(),
            history: [],
            favorites: []
        };
    },

    saveUserData(data) {
        localStorage.setItem(this.KEYS.USER, JSON.stringify(data));
    },

    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // ========== QUOTA MANAGEMENT ==========
    checkAndResetDailyQuota() {
        const admin = this.getAdminData();
        const today = new Date().toDateString();
        if (admin.dailyQuota.timestamp !== today) {
            admin.dailyQuota.used = 0;
            admin.dailyQuota.timestamp = today;
            admin.alerts.percent80 = false;
            admin.alerts.percent95 = false;
            admin.alerts.percent100 = false;
            Object.keys(admin.users).forEach(userId => {
                admin.users[userId].quotaUsed = 0;
                admin.users[userId].blocked = false;
            });
            this.saveAdminData(admin);
        }
        return admin;
    },

    checkUserQuota() {
        const user = this.getUserData();
        const admin = this.getAdminData();
        const today = new Date().toDateString();
        if (user.quotaDate !== today) {
            user.quotaToday = 0;
            user.quotaDate = today;
            this.saveUserData(user);
        }
        const limit = admin.userLimits.default;
        return {
            used: user.quotaToday,
            limit: limit,
            remaining: Math.max(0, limit - user.quotaToday),
            canRequest: user.quotaToday < limit
        };
    },

    incrementUserQuota() {
        const user = this.getUserData();
        const admin = this.getAdminData();
        user.quotaToday++;
        this.saveUserData(user);
        if (!admin.users[user.odnorazo]) {
            admin.users[user.odnorazo] = {
                quotaUsed: 0,
                blocked: false,
                since: new Date().toISOString()
            };
        }
        admin.users[user.odnorazo].quotaUsed = user.quotaToday;
        this.saveAdminData(admin);
        return user.quotaToday;
    },

    incrementGlobalQuota(amount = 1) {
        const admin = this.getAdminData();
        admin.dailyQuota.used += amount;
        this.saveAdminData(admin);
        return this.checkQuotaAlerts(admin);
    },

    checkQuotaAlerts(admin) {
        const percent = (admin.dailyQuota.used / admin.dailyQuota.total) * 100;
        if (percent >= 80 && !admin.alerts.percent80) {
            admin.alerts.percent80 = true;
            this.saveAdminData(admin);
            return { alert: '80%', percent };
        }
        if (percent >= 95 && !admin.alerts.percent95) {
            admin.alerts.percent95 = true;
            this.saveAdminData(admin);
            return { alert: '95%', percent };
        }
        if (percent >= 100 && !admin.alerts.percent100) {
            admin.alerts.percent100 = true;
            this.saveAdminData(admin);
            return { alert: '100%', percent };
        }
        return null;
    },

    // ========== HISTORY ==========
    addToHistory(channel) {
        const user = this.getUserData();
        user.history = user.history.filter(h => h.id !== channel.id);
        user.history.unshift({
            id: channel.id,
            name: channel.name,
            date: new Date().toISOString(),
            videoCount: channel.videoCount
        });
        user.history = user.history.slice(0, 25);
        this.saveUserData(user);
    },

    // ========== FAVORITES ==========
    addToFavorites(channel) {
        const user = this.getUserData();
        if (!user.favorites.find(f => f.id === channel.id)) {
            user.favorites.push({ id: channel.id, name: channel.name });
            this.saveUserData(user);
        }
    },

    removeFromFavorites(channelId) {
        const user = this.getUserData();
        user.favorites = user.favorites.filter(f => f.id !== channelId);
        this.saveUserData(user);
    },

    isFavorite(channelId) {
        const user = this.getUserData();
        return user.favorites.some(f => f.id === channelId);
    }
};

Storage.checkAndResetDailyQuota();
