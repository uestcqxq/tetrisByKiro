/**
 * ResourceManager - 资源管理器
 * 负责管理游戏资源的加载、缓存和优化
 */
class ResourceManager {
    constructor(config = {}) {
        this.config = {
            maxCacheSize: 50 * 1024 * 1024, // 50MB
            enableCache: true,
            debugMode: false,
            ...config
        };

        // 资源缓存
        this.cache = new Map();
        this.loadingPromises = new Map();
        
        // 加载状态
        this.loadingState = {
            total: 0,
            loaded: 0,
            failed: 0,
            progress: 0
        };

        // 关键资源列表
        this.criticalResources = [];
        
        console.log('资源管理器已初始化');
    }

    /**
     * 设置关键资源列表
     */
    setCriticalResources(resources) {
        this.criticalResources = resources;
    }

    /**
     * 预加载关键资源
     */
    async preloadResources() {
        try {
            console.log('开始预加载关键资源...');
            
            if (this.criticalResources.length === 0) {
                console.log('没有关键资源需要预加载');
                return;
            }

            this.loadingState.total = this.criticalResources.length;
            this.loadingState.loaded = 0;
            this.loadingState.failed = 0;

            const loadPromises = this.criticalResources.map(resource => 
                this.loadResource(resource.url, resource.type)
                    .catch(error => {
                        console.warn(`资源加载失败: ${resource.url}`, error);
                        this.loadingState.failed++;
                        return null;
                    })
            );

            const results = await Promise.all(loadPromises);
            
            console.log(`关键资源预加载完成: 成功 ${this.loadingState.loaded}, 失败 ${this.loadingState.failed}`);
            return results;
            
        } catch (error) {
            console.error('预加载关键资源失败:', error);
            throw error;
        }
    }

    /**
     * 加载单个资源
     */
    async loadResource(url, type = 'auto') {
        try {
            // 检查缓存
            if (this.config.enableCache && this.cache.has(url)) {
                console.log(`从缓存加载资源: ${url}`);
                return this.cache.get(url);
            }

            // 检查是否正在加载
            if (this.loadingPromises.has(url)) {
                return this.loadingPromises.get(url);
            }

            console.log(`开始加载资源: ${url}`);
            
            // 创建加载Promise
            const loadPromise = this.doLoadResource(url, type);
            this.loadingPromises.set(url, loadPromise);

            const resource = await loadPromise;
            
            // 缓存资源
            if (this.config.enableCache && resource) {
                this.cache.set(url, resource);
            }

            this.loadingPromises.delete(url);
            this.loadingState.loaded++;
            this.updateProgress();

            return resource;

        } catch (error) {
            this.loadingPromises.delete(url);
            this.loadingState.failed++;
            this.updateProgress();
            throw error;
        }
    }

    /**
     * 执行资源加载
     */
    async doLoadResource(url, type) {
        const resourceType = type === 'auto' ? this.detectResourceType(url) : type;
        
        switch (resourceType) {
            case 'image':
                return this.loadImage(url);
            case 'audio':
                return this.loadAudio(url);
            case 'json':
                return this.loadJSON(url);
            case 'text':
                return this.loadText(url);
            default:
                throw new Error(`不支持的资源类型: ${resourceType}`);
        }
    }

    /**
     * 检测资源类型
     */
    detectResourceType(url) {
        const extension = url.split('.').pop().toLowerCase();
        
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
            return 'image';
        } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(extension)) {
            return 'audio';
        } else if (extension === 'json') {
            return 'json';
        } else {
            return 'text';
        }
    }

    /**
     * 加载图片
     */
    async loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`图片加载失败: ${url}`));
            img.src = url;
        });
    }

    /**
     * 加载音频
     */
    async loadAudio(url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => resolve(audio);
            audio.onerror = () => reject(new Error(`音频加载失败: ${url}`));
            audio.src = url;
        });
    }

    /**
     * 加载JSON
     */
    async loadJSON(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`JSON加载失败: ${url} (${response.status})`);
        }
        return response.json();
    }

    /**
     * 加载文本
     */
    async loadText(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`文本加载失败: ${url} (${response.status})`);
        }
        return response.text();
    }

    /**
     * 更新加载进度
     */
    updateProgress() {
        if (this.loadingState.total > 0) {
            this.loadingState.progress = 
                (this.loadingState.loaded + this.loadingState.failed) / this.loadingState.total;
        }
    }

    /**
     * 获取缓存的资源
     */
    getCachedResource(url) {
        return this.cache.get(url);
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cache.clear();
        console.log('资源缓存已清除');
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            ...this.loadingState,
            cacheSize: this.cache.size,
            cacheKeys: Array.from(this.cache.keys())
        };
    }
}

// 导出资源管理器
window.ResourceManager = ResourceManager;

console.log('资源管理器模块加载完成');