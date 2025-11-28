// ==========================================
// ADMIN.JS - Admin Panel Logic
// YouTube Channel Scraper Pro 3.0
// ==========================================

const Admin = {
    init() {
        if (!this.checkAuth()) return;
        this.bindEvents();
        this.loadDashboard();
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
        } else {
            alert('Wrong password');
        }
    },

    logout() {
        sessionStorage.removeItem('admin_auth');
        location.reload();
    },

    bindEvents() {
        document.getElementById('saveApiKey')?.addEventListener('click', () => this.saveApiKey());
        document.getElementById('saveUserLimit')?.addEventListener('click', () => this.saveUserLimit());
        document.getElementById('clearCache')?.addEventListener('click', () => this.clearCache());
    },

    loadDashboard() {
        const admin = Storage.getAdminData();
        const quota = admin.dailyQuota;
        const percent = Math.round((quota.used / quota.total) * 100);
        
        document.getElementById('quotaUsed').textContent = quota.used;
        document.getElementById('quotaTotal').textContent = quota.total;
        document.getElementById('quotaPercent').textContent = percent + '%';
        document.getElementById('quotaBar').style.width = percent + '%';
        document.getElementById('quotaBar').className = 'quota-bar ' + this.getQuotaColor(percent);
        
        document.getElementById('apiKeyInput').value = admin.apiKey || '';
        document.getElementById('apiKeyStatus').textContent = admin.apiKeyStatus;
        document.getElementById('userLimitInput').value = admin.userLimits.default;
        
        this.loadUsersTable(admin);
        this.loadCacheStats();
    },

    getQuotaColor(percent) {
        if (percent >= 95) return 'critical';
        if (percent >= 80) return 'warning';
        return 'normal';
    },

    loadUsersTable(admin) {
        const tbody = document.getElementById('usersTable');
        if (!tbody) return;
        const users = Object.entries(admin.users);
        tbody.innerHTML = users.length ? users.map(([id, u]) => `
            <tr>
                <td>${id.substring(0, 15)}...</td>
                <td>${u.quotaUsed}</td>
                <td><span class="badge ${u.blocked ? 'blocked' : 'active'}">${u.blocked ? 'Blocked' : 'Active'}</span></td>
                <td>
                    <button onclick="Admin.toggleUserBlock('${id}')">${u.blocked ? 'Unblock' : 'Block'}</button>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="4">No users yet</td></tr>';
    },

    loadCacheStats() {
        const stats = Cache.getStats();
        document.getElementById('cacheChannels').textContent = stats.channels;
        document.getElementById('cacheSize').textContent = stats.sizeMB + ' MB';
    },

    saveApiKey() {
        const key = document.getElementById('apiKeyInput').value.trim();
        const admin = Storage.getAdminData();
        admin.apiKey = key;
        admin.apiKeyStatus = key ? 'active' : 'inactive';
        admin.apiKeyLastChecked = Date.now();
        Storage.saveAdminData(admin);
        this.loadDashboard();
        alert('API Key saved!');
    },

    saveUserLimit() {
        const limit = parseInt(document.getElementById('userLimitInput').value) || 5;
        const admin = Storage.getAdminData();
        admin.userLimits.default = limit;
        Storage.saveAdminData(admin);
        alert('User limit updated to ' + limit);
    },

    toggleUserBlock(userId) {
        const admin = Storage.getAdminData();
        if (admin.users[userId]) {
            admin.users[userId].blocked = !admin.users[userId].blocked;
            Storage.saveAdminData(admin);
            this.loadDashboard();
        }
    },

    clearCache() {
        if (confirm('Clear all cached channels?')) {
            Cache.clear();
            this.loadCacheStats();
            alert('Cache cleared!');
        }
    },

    addToPriority() {
        const channelId = document.getElementById('priorityChannelId').value.trim();
        if (!channelId) return;
        const admin = Storage.getAdminData();
        if (!admin.cachePriority.includes(channelId)) {
            admin.cachePriority.push(channelId);
            Storage.saveAdminData(admin);
            this.loadPriorityList();
        }
        document.getElementById('priorityChannelId').value = '';
    },

    removePriority(channelId) {
        const admin = Storage.getAdminData();
        admin.cachePriority = admin.cachePriority.filter(id => id !== channelId);
        Storage.saveAdminData(admin);
        this.loadPriorityList();
    },

    loadPriorityList() {
        const admin = Storage.getAdminData();
        const el = document.getElementById('priorityList');
        if (!el) return;
        el.innerHTML = admin.cachePriority.map(id => `
            <div class="priority-item">
                <span>${id}</span>
                <button onclick="Admin.removePriority('${id}')">Remove</button>
            </div>
        `).join('') || '<p>No priority channels</p>';
    }
};

document.addEventListener('DOMContentLoaded', () => Admin.init());
