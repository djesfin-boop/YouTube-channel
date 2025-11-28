require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet());
app.use(express.json());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // 100 запросов за 15 минут
    message: 'Слишком много запросов, попробуйте позже'
});

app.use(limiter);

// ========== STORAGE (В РЕАЛЬНОЙ ЖИЗНИ - БД) ==========
const userQuotas = new Map(); // Хранилище квоты по IP
const QUOTA_LIMIT = 5; // Запросов в день

function resetDailyQuotas() {
    userQuotas.clear();
}

// Сброс квоты каждый день в 00:00 МСК
const scheduleDailyReset = () => {
    const now = new Date();
    const mskOffset = 3 * 60 * 60 * 1000; // МСК +3
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilReset = tomorrow.getTime() - now.getTime();
    setTimeout(() => {
        resetDailyQuotas();
        console.log('✅ Квоты сброшены');
        scheduleDailyReset(); // Запланировать следующий сброс
    }, timeUntilReset);
};

scheduleDailyReset();

// ========== HELPER FUNCTIONS ==========
function getUserIP(req) {
    return req.ip || req.connection.remoteAddress;
}

function checkUserQuota(userIP) {
    if (!userQuotas.has(userIP)) {
        userQuotas.set(userIP, { used: 0, resetTime: Date.now() });
    }
    
    const quota = userQuotas.get(userIP);
    return {
        used: quota.used,
        limit: QUOTA_LIMIT,
        remaining: Math.max(0, QUOTA_LIMIT - quota.used),
        canRequest: quota.used < QUOTA_LIMIT
    };
}

function incrementUserQuota(userIP) {
    const quota = userQuotas.get(userIP);
    quota.used++;
    userQuotas.set(userIP, quota);
}

// ========== API ENDPOINTS ==========

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Проверить квоту
app.get('/api/quota', (req, res) => {
    const userIP = getUserIP(req);
    const quota = checkUserQuota(userIP);
    
    res.json({
        success: true,
        quota: quota
    });
});

// Поиск канала по названию
app.post('/api/search', async (req, res) => {
    try {
        const { channelInput } = req.body;
        const userIP = getUserIP(req);
        
        // Проверить квоту
        const quota = checkUserQuota(userIP);
        if (!quota.canRequest) {
            return res.status(429).json({
                success: false,
                error: 'Лимит запросов исчерпан. Приходите завтра.',
                quota: quota
            });
        }
        
        if (!channelInput) {
            return res.status(400).json({
                success: false,
                error: 'Не указан Channel ID или URL'
            });
        }
        
        // Получить Channel ID
        let channelId = channelInput;
        
        if (channelInput.includes('youtube.com')) {
            if (channelInput.includes('youtube.com/@')) {
                const username = channelInput.split('@')[1].split('/')[0];
                channelId = await getChannelIdByUsername(username);
            } else if (channelInput.includes('youtube.com/c/')) {
                const username = channelInput.split('/c/')[1].split('/')[0];
                channelId = await getChannelIdByUsername(username);
            } else if (channelInput.includes('youtube.com/channel/')) {
                channelId = channelInput.split('/channel/')[1].split('/')[0];
            }
        }
        
        if (!channelId.startsWith('UC')) {
            return res.status(400).json({
                success: false,
                error: 'Неверный Channel ID'
            });
        }
        
        // Инкрементировать квоту
        incrementUserQuota(userIP);
        
        res.json({
            success: true,
            channelId: channelId,
            userIP: userIP // Для отладки (удалить в продакшене)
        });
        
    } catch (error) {
        console.error('Error in /api/search:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Внутренняя ошибка сервера'
        });
    }
});

// Получить видео канала
app.post('/api/videos', async (req, res) => {
    try {
        const { channelId } = req.body;
        const userIP = getUserIP(req);
        
        if (!channelId) {
            return res.status(400).json({
                success: false,
                error: 'Не указан Channel ID'
            });
        }
        
        const videos = [];
        let pageToken = '';
        let pageCount = 0;
        const maxPages = 5; // Максимум 5 страниц = 250 видео
        
        console.log(`📥 Загружаю видео канала ${channelId} для ${userIP}`);
        
        do {
            const url = 'https://www.googleapis.com/youtube/v3/search';
            
            const response = await axios.get(url, {
                params: {
                    key: process.env.YOUTUBE_API_KEY,
                    channelId: channelId,
                    part: 'snippet',
                    order: 'date',
                    maxResults: 50,
                    type: 'video',
                    pageToken: pageToken
                },
                timeout: 10000
            });
            
            if (response.data.error) {
                throw new Error(response.data.error.message);
            }
            
            if (response.data.items) {
                videos.push(...response.data.items.map(item => ({
                    videoId: item.id.videoId,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    publishedAt: item.snippet.publishedAt,
                    thumbnail: item.snippet.thumbnails?.high?.url || '',
                    url: `https://www.youtube.com/watch?v=${item.id.videoId}`
                })));
            }
            
            pageToken = response.data.nextPageToken;
            pageCount++;
            
            console.log(`✅ Загружено ${videos.length} видео (страница ${pageCount})`);
            
        } while (pageToken && pageCount < maxPages);
        
        res.json({
            success: true,
            videos: videos,
            totalCount: videos.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in /api/videos:', error.message);
        
        if (error.response?.data?.error?.code === 'quotaExceeded') {
            return res.status(429).json({
                success: false,
                error: 'YouTube API квота исчерпана'
            });
        }
        
        if (error.response?.data?.error?.code === 'channelNotFound') {
            return res.status(404).json({
                success: false,
                error: 'Канал не найден'
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message || 'Ошибка при загрузке видео'
        });
    }
});

// ========== HELPER FUNCTION ==========
async function getChannelIdByUsername(username) {
    const url = 'https://www.googleapis.com/youtube/v3/search';
    
    const response = await axios.get(url, {
        params: {
            key: process.env.YOUTUBE_API_KEY,
            q: username,
            part: 'snippet',
            type: 'channel',
            maxResults: 1
        },
        timeout: 10000
    });
    
    if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Канал не найден');
    }
    
    return response.data.items[0].id.channelId;
}

// ========== 404 HANDLER ==========
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint не найден',
        path: req.path,
        method: req.method
    });
});

// ========== ERROR HANDLER ==========
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    
    res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║  🚀 YouTube Scraper Backend Server 🚀  ║
╚════════════════════════════════════════╝

📍 Server: http://localhost:${PORT}
🔑 API Key: ${process.env.YOUTUBE_API_KEY ? '✅ Loaded' : '❌ Missing'}
📊 Quota Limit: ${QUOTA_LIMIT} запросов/день
🌍 Frontend URL: ${process.env.FRONTEND_URL || 'Not configured'}

Available endpoints:
  GET  /health
  GET  /api/quota
  POST /api/search
  POST /api/videos

Press Ctrl+C to stop server
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
