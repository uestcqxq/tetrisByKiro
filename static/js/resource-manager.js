/**
 * 资源管理器 - 游戏资源预加载和缓存管理
 * 负责图像、音频、字体等资源的加载和缓存
 */
class ResourceManager {
    constructor(config = {}) {
        this.config = {
            maxCacheSize: 50 * 1024 * 1024, // 50MB
            preloadTimeout: 10000, // 10秒
            enableCompression: true,
            enableLazyLoading: true,
            cacheExpiry: 24 * 60 * 60 * 1000, // 24小时
            ...config
        };

        // 资源缓存
        this.cache = {
            images: new Map(),
            audio: new Map(),
            fonts: new Map(),
            data: new Map(),
            metadata: new Map()
        };

        // 加载状态
        this.loadingState = {
            total: 0,
            loaded: 0,
            failed: 0,
            progress: 0
        };

        // 预加载队列
        this.preloadQueue = [];
        this.isPreloading = false;

        // 事件系统
        this.eventListeners = new Map();

        this.initialize();
    }

    /**
     * 初始化资源管理器
     */
    initialize() {
        this.setupCacheManagement();
        this.loadCachedResources();
        this.preloadCriticalResources();
        
        console.log('资源管理器已初始化');
    }

    /**
     * 设置缓存管理
     */
    setupCacheManagement() {
        // 监听存储空间
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            this.monitorStorageUsage();
        }

        // 定期清理过期缓存
        setInterval(() => {
            this.cleanExpiredCache();
        }, 60000); // 每分钟检查一次
    }

    /**
     * 预加载关键资源
     */
    async preloadCriticalResources() {
        const criticalResources = [
            // 游戏界面图像
            { type: 'image', id: 'game-background', url: '/static/images/game-bg.png', critical: true },
            { type: 'image', id: 'block-textures', url: '/static/images/blocks.png', critical: true },
            
            // 音效文件
            { type: 'audio', id: 'line-clear', url: '/static/audio/line-clear.mp3', critical: false },
            { type: 'audio', id: 'tetris', url: '/static/audio/tetris.mp3', critical: false },
            { type: 'audio', id: 'game-over', url: '/static/audio/game-over.mp3', critical: false },
            
            // 字体文件
            { type: 'font', id: 'game-font', url: '/static/fonts/game-font.woff2', critical: true },
            
            // 游戏数据
            { type: 'data', id: 'tetromino-shapes', url: '/static/data/tetrominoes.json', critical: true },
            { type: 'data', id: 'level-config', url: '/static/data/levels.json', critical: true }
        ];

        await this.preloadResources(criticalResources);
    }

    /**
     * 预加载资源列表
     */
    async preloadResources(resources) {
        if (this.isPreloading) {
            console.warn('资源预加载已在进行中');
            return;
        }

        this.isPreloading = true;
        this.loadingState.total = resources.length;
        this.loadingState.loaded = 0;
        this.loadingState.failed = 0;

        const loadPromises = resources.map(resource => this.loadResource(resource));
        
        try {
            await Promise.allSettled(loadPromises);
            this.emit('preloadComplete', this.loadingState);
        } catch (error) {
            console.error('资源预加载失败:', error);
            this.emit('preloadError', error);
        } finally {
            this.isPreloading = false;
        }
    }

    /**
     * 加载单个资源
     */
    async loadResource(resource) {
        const { type, id, url, critical = false } = resource;
        
        try {
            // 检查缓存
            const cached = this.getFromCache(type, id);
            if (cached && !this.isCacheExpired(cached)) {
                this.loadingState.loaded++;
                this.updateProgress();
                return cached.data;
            }

            // 加载资源
            let data;
            switch (type) {
                case 'image':
                    data = await this.loadImage(url);
                    break;
                case 'audio':
                    data = await this.loadAudio(url);
                    break;
                case 'font':
                    data = await this.loadFont(id, url);
                    break;
                case 'data':
                    data = await this.loadData(url);
                    break;
                default:
                    throw new Error(`不支持的资源类型: ${type}`);
            }

            // 缓存资源
            this.addToCache(type, id, data, { critical, url });
            
            this.loadingState.loaded++;
            this.updateProgress();
            this.emit('resourceLoaded', { type, id, data });
            
            return data;
            
        } catch (error) {
            console.error(`加载资源失败 ${type}:${id}:`, error);
            this.loadingState.failed++;
            this.updateProgress();
            this.emit('resourceError', { type, id, error });
            
            if (critical) {
                throw error;
            }
            return null;
        }
    }

    /**
     * 加载图像
     */
    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            const timeout = setTimeout(() => {
                reject(new Error(`图像加载超时: ${url}`));
            }, this.config.preloadTimeout);
            
            img.onload = () => {
                clearTimeout(timeout);
                resolve(img);
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error(`图像加载失败: ${url}`));
            };
            
            img.src = url;
        });
    }

    /**
     * 加载音频
     */
    loadAudio(url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            
            const timeout = setTimeout(() => {
                reject(new Error(`音频加载超时: ${url}`));
            }, this.config.preloadTimeout);
            
            audio.addEventListener('canplaythrough', () => {
                clearTimeout(timeout);
                resolve(audio);
            }, { once: true });
            
            audio.addEventListener('error', () => {
                clearTimeout(timeout);
                reject(new Error(`音频加载失败: ${url}`));
            }, { once: true });
            
            audio.src = url;
            audio.load();
        });
    }

    /**
     * 加载字体
     */
    async loadFont(fontFamily, url) {
        if (!('FontFace' in window)) {
            console.warn('浏览器不支持FontFace API');
            return null;
        }

        try {
            const font = new FontFace(fontFamily, `url(${url})`);
            const loadedFont = await font.load();
            document.fonts.add(loadedFont);
            return loadedFont;
        } catch (error) {
            throw new Error(`字体加载失败: ${url}`);
        }
    }

    /**
     * 加载数据文件
     */
    async loadData(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`数据加载失败: ${response.status} ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return await response.text();
        }
    }

    /**
     * 添加到缓存
     */
    addToCache(type, id, data, metadata = {}) {
        const cacheEntry = {
            data,
            timestamp: Date.now(),
            size: this.estimateSize(data),
            metadata
        };

        this.cache[type].set(id, cacheEntry);
        this.cache.metadata.set(`${type}:${id}`, cacheEntry);

        // 检查缓存大小
        this.checkCacheSize();
    }

    /**
     * 从缓存获取
     */
    getFromCache(type, id) {
        return this.cache[type].get(id);
    }

    /**
     * 检查缓存是否过期
     */
    isCacheExpired(cacheEntry) {
        return Date.now() - cacheEntry.timestamp > this.config.cacheExpiry;
    }

    /**
     * 估算数据大小
     */
    estimateSize(data) {
        if (data instanceof HTMLImageElement) {
            return data.width * data.height * 4; // RGBA
        } else if (data instanceof HTMLAudioElement) {
            return data.duration * 44100 * 2 * 2; // 估算
        } else if (typeof data === 'string') {
            return data.length * 2; // UTF-16
        } else if (typeof data === 'object') {
            return JSON.stringify(data).length * 2;
        }
        return 1024; // 默认1KB
    }

    /**
     * 检查缓存大小
     */
    checkCacheSize() {
        const totalSize = this.getTotalCacheSize();
        
        if (totalSize > this.config.maxCacheSize) {
            this.cleanCache();
        }
    }

    /**
     * 获取总缓存大小
     */
    getTotalCacheSize() {
        let totalSize = 0;
        
        for (const cache of Object.values(this.cache)) {
            if (cache instanceof Map) {
                for (const entry of cache.values()) {
                    totalSize += entry.size || 0;
                }
            }
        }
        
        return totalSize;
    }

    /**
     * 清理缓存
     */
    cleanCache() {
        // 收集所有缓存条目
        const allEntries = [];
        
        for (const [type, cache] of Object.entries(this.cache)) {
            if (cache instanceof Map) {
                for (const [id, entry] of cache) {
                    allEntries.push({
                        type,
                        id,
                        entry,
                        key: `${type}:${id}`
                    });
                }
            }
        }

        // 按时间排序（最旧的优先清理）
        allEntries.sort((a, b) => a.entry.timestamp - b.entry.timestamp);

        // 清理非关键资源
        let currentSize = this.getTotalCacheSize();
        const targetSize = this.config.maxCacheSize * 0.8; // 清理到80%

        for (const item of allEntries) {
            if (currentSize <= targetSize) break;
            
            // 不清理关键资源
            if (item.entry.metadata.critical) continue;
            
            this.cache[item.type].delete(item.id);
            this.cache.metadata.delete(item.key);
            currentSize -= item.entry.size;
        }

        console.log(`缓存清理完成，当前大小: ${Math.round(currentSize / 1024 / 1024)}MB`);
    }

    /**
     * 清理过期缓存
     */
    cleanExpiredCache() {
        let cleanedCount = 0;
        
        for (const [type, cache] of Object.entries(this.cache)) {
            if (cache instanceof Map) {
                for (const [id, entry] of cache) {
                    if (this.isCacheExpired(entry) && !entry.metadata.critical) {
                        cache.delete(id);
                        this.cache.metadata.delete(`${type}:${id}`);
                        cleanedCount++;
                    }
                }
            }
        }

        if (cleanedCount > 0) {
            console.log(`清理了 ${cleanedCount} 个过期缓存条目`);
        }
    }

    /**
     * 监控存储使用情况
     */
    async monitorStorageUsage() {
        try {
            const estimate = await navigator.storage.estimate();
            const usageRatio = estimate.usage / estimate.quota;
            
            if (usageRatio > 0.8) {
                console.warn('存储空间不足，开始清理缓存');
                this.cleanCache();
            }
            
            // 定期检查
            setTimeout(() => this.monitorStorageUsage(), 30000);
        } catch (error) {
            console.error('无法获取存储使用情况:', error);
        }
    }

    /**
     * 更新加载进度
     */
    updateProgress() {
        this.loadingState.progress = this.loadingState.loaded / this.loadingState.total;
        this.emit('progressUpdate', this.loadingState);
    }

    /**
     * 获取资源
     */
    getResource(type, id) {
        const cached = this.getFromCache(type, id);
        if (cached && !this.isCacheExpired(cached)) {
            return cached.data;
        }
        return null;
    }

    /**
     * 预加载图像精灵
     */
    async preloadSprites(spriteConfig) {
        const { url, sprites } = spriteConfig;
        
        try {
            const image = await this.loadImage(url);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 为每个精灵创建单独的canvas
            for (const [id, config] of Object.entries(sprites)) {
                const { x, y, width, height } = config;
                
                canvas.width = width;
                canvas.height = height;
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
                
                // 创建新图像对象
                const spriteImage = new Image();
                spriteImage.src = canvas.toDataURL();
                
                this.addToCache('sprite', id, spriteImage, { 
                    source: url, 
                    bounds: { x, y, width, height } 
                });
            }
            
            console.log(`精灵图加载完成: ${Object.keys(sprites).length} 个精灵`);
        } catch (error) {
            console.error('精灵图加载失败:', error);
        }
    }

    /**
     * 创建纹理图集
     */
    createTextureAtlas(textures) {
        const atlasSize = 512; // 512x512 图集
        const canvas = document.createElement('canvas');
        canvas.width = atlasSize;
        canvas.height = atlasSize;
        const ctx = canvas.getContext('2d');
        
        const atlas = {
            canvas,
            textures: new Map(),
            nextX: 0,
            nextY: 0,
            rowHeight: 0
        };
        
        for (const [id, image] of textures) {
            if (atlas.nextX + image.width > atlasSize) {
                atlas.nextX = 0;
                atlas.nextY += atlas.rowHeight;
                atlas.rowHeight = 0;
            }
            
            if (atlas.nextY + image.height > atlasSize) {
                console.warn('纹理图集空间不足');
                break;
            }
            
            ctx.drawImage(image, atlas.nextX, atlas.nextY);
            
            atlas.textures.set(id, {
                x: atlas.nextX,
                y: atlas.nextY,
                width: image.width,
                height: image.height
            });
            
            atlas.nextX += image.width;
            atlas.rowHeight = Math.max(atlas.rowHeight, image.height);
        }
        
        this.addToCache('atlas', 'main', atlas, { type: 'texture_atlas' });
        return atlas;
    }

    /**
     * 加载缓存的资源
     */
    loadCachedResources() {
        try {
            const cachedData = localStorage.getItem('tetris_resource_cache');
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                // 这里可以恢复一些轻量级的缓存数据
                console.log('已加载缓存的资源元数据');
            }
        } catch (error) {
            console.error('加载缓存资源失败:', error);
        }
    }

    /**
     * 保存缓存元数据
     */
    saveCacheMetadata() {
        try {
            const metadata = {};
            for (const [key, entry] of this.cache.metadata) {
                metadata[key] = {
                    timestamp: entry.timestamp,
                    size: entry.size,
                    metadata: entry.metadata
                };
            }
            
            localStorage.setItem('tetris_resource_cache', JSON.stringify(metadata));
        } catch (error) {
            console.error('保存缓存元数据失败:', error);
        }
    }

    /**
     * 事件系统
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`事件处理器错误 ${event}:`, error);
                }
            });
        }
    }

    /**
     * 获取缓存统计
     */
    getCacheStats() {
        const stats = {
            totalSize: this.getTotalCacheSize(),
            itemCount: 0,
            typeBreakdown: {}
        };

        for (const [type, cache] of Object.entries(this.cache)) {
            if (cache instanceof Map) {
                const count = cache.size;
                let size = 0;
                
                for (const entry of cache.values()) {
                    size += entry.size || 0;
                }
                
                stats.typeBreakdown[type] = { count, size };
                stats.itemCount += count;
            }
        }

        return stats;
    }

    /**
     * 清理所有缓存
     */
    clearAllCache() {
        for (const cache of Object.values(this.cache)) {
            if (cache instanceof Map) {
                cache.clear();
            }
        }
        
        // 清理本地存储
        localStorage.removeItem('tetris_resource_cache');
        
        console.log('所有缓存已清理');
    }

    /**
     * 销毁资源管理器
     */
    destroy() {
        this.saveCacheMetadata();
        this.clearAllCache();
        this.eventListeners.clear();
        
        console.log('资源管理器已销毁');
    }
}

// 导出资源管理器
window.ResourceManager = ResourceManager;