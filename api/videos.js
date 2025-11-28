// ==========================================
// VERCEL API FUNCTION: /api/videos.js
// ==========================================
// Разместить в папке: api/videos.js

export default async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { channelId, pageToken } = req.body;
    
    // Валидация Channel ID
    if (!channelId || !/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
      return res.status(400).json({ error: 'Invalid Channel ID' });
    }

    // API ключ из переменных окружения (НИКОГДА НА КЛИЕНТЕ!)
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Получить информацию о канале
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&id=${channelId}&key=${apiKey}`;
    const channelResponse = await fetch(channelUrl);
    
    if (!channelResponse.ok) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const channelData = await channelResponse.json();
    
    if (!channelData.items || channelData.items.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = channelData.items[0];
    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

    // Получить видео из плейлиста
    const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    playlistUrl.searchParams.append('part', 'snippet,contentDetails');
    playlistUrl.searchParams.append('playlistId', uploadsPlaylistId);
    playlistUrl.searchParams.append('maxResults', '50');
    playlistUrl.searchParams.append('key', apiKey);
    
    if (pageToken) {
      playlistUrl.searchParams.append('pageToken', pageToken);
    }

    const playlistResponse = await fetch(playlistUrl.toString());
    
    if (!playlistResponse.ok) {
      return res.status(500).json({ error: 'Error fetching videos' });
    }

    const playlistData = await playlistResponse.json();

    // Подготовить видео
    const videos = playlistData.items?.map(item => ({
      id: item.contentDetails.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`
    })) || [];

    return res.status(200).json({
      channel: {
        name: channel.snippet.title,
        id: channel.id,
        description: channel.snippet.description,
        subscriberCount: channel.statistics.subscriberCount,
        videoCount: channel.statistics.videoCount
      },
      videos: videos,
      nextPageToken: playlistData.nextPageToken || null
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
