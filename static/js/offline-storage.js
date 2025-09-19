/**
 * 离线存储管理器
 * 处理游戏进度、设置和离线数据的本地存储
 */

class OfflineStorage {
    constructor(config = {}) {
        this.config = {
            storagePrefix: 'tetris_',
            maxOfflineGames: 50,
            maxStorageSize: 5 * 1024 * 1024, // 5MB
            syncRetryAttempts: 3,
            syncRetryDelay: 2000,
            enableCompression: true,
            ...config
        };
        
        // 存储状态
        this.isAvailable = this.checkStorageAvailability();
        this.pendingSyncData = [];
        this.syncQueue = new Map();
        
        // 存储统计
        this.storageStats = {
            totalItems: 0,
            totalSize: 0,
            lastSync: null,
            pendingSync: 0,
            syncErrors: 0
        };
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化离线存储
     */
    init() {
        if (!this.isAvailable) {
            console.warn('本地存储不可用');
            return;
        }
        
        this.updateStorageStats();
        this.loadPendingSyncData();
        this.setupStorageEventListeners();
        
        console.log('离线存储管理器初始化完成');
    }
    
    /**
     * 检查存储可用性
     */
    checkStorageAvailability() {
        try {
            const testKey = this.getStorageKey('test');
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.error('本地存储不可用:', error);
            return false;
        }
    }
    
    /**
     * 获取存储键名
     */
    getStorageKey(key) {
        return `${this.config.storagePrefix}${key}`;
    }
    
    /**
     * 设置存储事件监听器
     */
    setupStorageEventListeners() {
        // 监听存储变化
        window.addEventListener('storage', (event) => {
            if (event.key && event.key.startsWith(this.config.storagePrefix)) {
                this.handleStorageChange(event);
            }
        });
        
        // 监听页面卸载，保存待同步数据
        window.addEventListener('beforeunload', () => {
            this.savePendingSyncData();
        });
        
        // 监听网络状态变化
        window.addEventListener('errorHandler:online', () => {
            this.syncOfflineData();
        });
    }
    
    /**
     * 保存游戏进度
     */
    saveGameProgress(gameState) {
        if (!this.isAvailable) return false;
        
        try {
            const progressData = {
                gameState: gameState,
                timestamp: Date.now(),
                version: '1.0'
            };
            
            const compressed = this.config.enableCompression ? 
                this.compressData(progressData) : progressData;
            
            this.setItem('current_game', compressed);
            
            console.log('游戏进度已保存');
            return true;
        } catch (error) {
            console.error('保存游戏进度失败:', error);
            return false;
        }
    }
    
    /**
     * 加载游戏进度
     */
    loadGameProgress() {
        if (!this.isAvailable) return null;
        
        try {
            const compressed = this.getItem('current_game');
            if (!compressed) return null;
            
            const progressData = this.config.enableCompression ? 
                this.decompressData(compressed) : compressed;
            
            // 检查数据版本和有效性
            if (this.validateGameProgress(progressData)) {
                console.log('游戏进度已加载');
                return progressData.gameState;
            }
            
            return null;
        } catch (error) {
            console.error('加载游戏进度失败:', error);
            return null;
        }
    }
    
    /**
     * 验证游戏进度数据
     */
    validateGameProgress(progressData) {
        if (!progressData || !progressData.gameState) {
            return false;
        }
        
        // 检查时间戳（不超过24小时）
        const maxAge = 24 * 60 * 60 * 1000; // 24小时
        if (Date.now() - progressData.timestamp > maxAge) {
            console.log('游戏进度数据过期');
            return false;
        }
        
        // 检查必要字段
        const gameState = progressData.gameState;
        const requiredFields = ['score', 'level', 'lines', 'board'];
        
        for (const field of requiredFields) {
            if (!(field in gameState)) {
                console.log(`游戏进度缺少必要字段: ${field}`);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 清除游戏进度
     */
    clearGameProgress() {
        if (!this.isAvailable) return;
        
        try {
            this.removeItem('current_game');
            console.log('游戏进度已清除');
        } catch (error) {
            console.error('清除游戏进度失败:', error);
        }
    }
    
    /**
     * 保存游戏设置
     */
    saveGameSettings(settings) {
        if (!this.isAvailable) return false;
        
        try {
            const settingsData = {
                settings: settings,
                timestamp: Date.now(),
                version: '1.0'
            };
            
            this.setItem('game_settings', settingsData);
            
            console.log('游戏设置已保存');
            return true;
        } catch (error) {
            console.error('保存游戏设置失败:', error);
            return false;
        }
    }
    
    /**
     * 加载游戏设置
     */
    loadGameSettings() {
        if (!this.isAvailable) return null;
        
        try {
            const settingsData = this.getItem('game_settings');
            if (settingsData && settingsData.settings) {
                console.log('游戏设置已加载');
                return settingsData.settings;
            }
            
            return null;
        } catch (error) {
            console.error('加载游戏设置失败:', error);
            return null;
        }
    }
    
    /**
     * 保存离线游戏记录
     */
    saveOfflineGame(gameData) {
        if (!this.isAvailable) return false;
        
        try {
            // 获取现有的离线游戏记录
            const offlineGames = this.getOfflineGames();
            
            // 添加新记录
            const gameRecord = {
                ...gameData,
                id: this.generateId(),
                timestamp: Date.now(),
                synced: false
            };
            
            offlineGames.push(gameRecord);
            
            // 限制记录数量
            if (offlineGames.length > this.config.maxOfflineGames) {
                offlineGames.splice(0, offlineGames.length - this.config.maxOfflineGames);
            }
            
            this.setItem('offline_games', offlineGames);
            this.pendingSyncData.push(gameRecord);
            
            console.log('离线游戏记录已保存');
            return gameRecord.id;
        } catch (error) {
            console.error('保存离线游戏记录失败:', error);
            return false;
        }
    }
    
    /**
     * 获取离线游戏记录
     */
    getOfflineGames() {
        if (!this.isAvailable) return [];
        
        try {
            return this.getItem('offline_games') || [];
        } catch (error) {
            console.error('获取离线游戏记录失败:', error);
            return [];
        }
    }
    
    /**
     * 获取未同步的游戏记录
     */
    getUnsyncedGames() {
        const offlineGames = this.getOfflineGames();
        return offlineGames.filter(game => !game.synced);
    }
    
    /**
     * 标记游戏记录为已同步
     */
    markGameAsSynced(gameId) {
        if (!this.isAvailable) return false;
        
        try {
            const offlineGames = this.getOfflineGames();
            const gameIndex = offlineGames.findIndex(game => game.id === gameId);
            
            if (gameIndex !== -1) {
                offlineGames[gameIndex].synced = true;
                offlineGames[gameIndex].syncedAt = Date.now();
                this.setItem('offline_games', offlineGames);
                
                // 从待同步队列中移除
                this.pendingSyncData = this.pendingSyncData.filter(game => game.id !== gameId);
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('标记游戏记录同步状态失败:', error);
            return false;
        }
    }
    
    /**
     * 同步离线数据到服务器
     */
    async syncOfflineData() {
        if (!this.isAvailable || !navigator.onLine) {
            console.log('无法同步离线数据：存储不可用或网络离线');
            return;
        }
        
        const unsyncedGames = this.getUnsyncedGames();
        if (unsyncedGames.length === 0) {
            console.log('没有需要同步的离线数据');
            return;
        }
        
        console.log(`开始同步 ${unsyncedGames.length} 条离线游戏记录`);
        
        let syncedCount = 0;
        let errorCount = 0;
        
        for (const game of unsyncedGames) {
            try {
                const success = await this.syncSingleGame(game);
                if (success) {
                    this.markGameAsSynced(game.id);
                    syncedCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                console.error('同步游戏记录失败:', error);
                errorCount++;
            }
        }
        
        // 更新统计信息
        this.storageStats.lastSync = Date.now();
        this.storageStats.pendingSync = unsyncedGames.length - syncedCount;
        this.storageStats.syncErrors += errorCount;
        
        console.log(`同步完成: 成功 ${syncedCount} 条, 失败 ${errorCount} 条`);
        
        // 触发同步完成事件
        this.dispatchEvent('syncCompleted', {
            syncedCount,
            errorCount,
            totalAttempted: unsyncedGames.length
        });
    }
    
    /**
     * 同步单个游戏记录
     */
    async syncSingleGame(game) {
        try {
            const response = await fetch('/api/games', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: game.user_id,
                    score: game.score,
                    level: game.level,
                    lines_cleared: game.lines_cleared,
                    game_duration: game.game_duration
                })
            });
            
            if (response.ok) {
                console.log(`游戏记录 ${game.id} 同步成功`);
                return true;
            } else {
                console.error(`游戏记录 ${game.id} 同步失败:`, response.status);
                return false;
            }
        } catch (error) {
            console.error(`游戏记录 ${game.id} 同步异常:`, error);
            return false;
        }
    }
    
    /**
     * 保存用户数据
     */
    saveUserData(userData) {
        if (!this.isAvailable) return false;
        
        try {
            const userDataWithTimestamp = {
                ...userData,
                timestamp: Date.now()
            };
            
            this.setItem('user_data', userDataWithTimestamp);
            
            console.log('用户数据已保存');
            return true;
        } catch (error) {
            console.error('保存用户数据失败:', error);
            return false;
        }
    }
    
    /**
     * 加载用户数据
     */
    loadUserData() {
        if (!this.isAvailable) return null;
        
        try {
            const userData = this.getItem('user_data');
            if (userData) {
                console.log('用户数据已加载');
                return userData;
            }
            
            return null;
        } catch (error) {
            console.error('加载用户数据失败:', error);
            return null;
        }
    }
    
    /**
     * 保存排行榜缓存
     */
    saveLeaderboardCache(leaderboardData) {
        if (!this.isAvailable) return false;
        
        try {
            const cacheData = {
                leaderboard: leaderboardData,
                timestamp: Date.now(),
                ttl: 5 * 60 * 1000 // 5分钟TTL
            };
            
            this.setItem('leaderboard_cache', cacheData);
            
            console.log('排行榜缓存已保存');
            return true;
        } catch (error) {
            console.error('保存排行榜缓存失败:', error);
            return false;
        }
    }
    
    /**
     * 加载排行榜缓存
     */
    loadLeaderboardCache() {
        if (!this.isAvailable) return null;
        
        try {
            const cacheData = this.getItem('leaderboard_cache');
            if (!cacheData) return null;
            
            // 检查缓存是否过期
            if (Date.now() - cacheData.timestamp > cacheData.ttl) {
                this.removeItem('leaderboard_cache');
                return null;
            }
            
            console.log('排行榜缓存已加载');
            return cacheData.leaderboard;
        } catch (error) {
            console.error('加载排行榜缓存失败:', error);
            return null;
        }
    }
    
    /**
     * 压缩数据
     */
    compressData(data) {
        try {
            // 简单的JSON压缩（移除空格）
            const jsonString = JSON.stringify(data);
            return {
                compressed: true,
                data: jsonString
            };
        } catch (error) {
            console.error('数据压缩失败:', error);
            return data;
        }
    }
    
    /**
     * 解压缩数据
     */
    decompressData(compressedData) {
        try {
            if (compressedData.compressed) {
                return JSON.parse(compressedData.data);
            }
            return compressedData;
        } catch (error) {
            console.error('数据解压缩失败:', error);
            return null;
        }
    }
    
    /**
     * 设置存储项
     */
    setItem(key, value) {
        if (!this.isAvailable) return false;
        
        try {
            const storageKey = this.getStorageKey(key);
            const serializedValue = JSON.stringify(value);
            
            // 检查存储大小
            if (this.getStorageSize() + serializedValue.length > this.config.maxStorageSize) {
                this.cleanupOldData();
            }
            
            localStorage.setItem(storageKey, serializedValue);
            this.updateStorageStats();
            
            return true;
        } catch (error) {
            console.error('设置存储项失败:', error);
            return false;
        }
    }
    
    /**
     * 获取存储项
     */
    getItem(key) {
        if (!this.isAvailable) return null;
        
        try {
            const storageKey = this.getStorageKey(key);
            const serializedValue = localStorage.getItem(storageKey);
            
            if (serializedValue === null) return null;
            
            return JSON.parse(serializedValue);
        } catch (error) {
            console.error('获取存储项失败:', error);
            return null;
        }
    }
    
    /**
     * 移除存储项
     */
    removeItem(key) {
        if (!this.isAvailable) return false;
        
        try {
            const storageKey = this.getStorageKey(key);
            localStorage.removeItem(storageKey);
            this.updateStorageStats();
            
            return true;
        } catch (error) {
            console.error('移除存储项失败:', error);
            return false;
        }
    }
    
    /**
     * 清理旧数据
     */
    cleanupOldData() {
        console.log('开始清理旧数据');
        
        try {
            // 清理过期的缓存
            this.removeItem('leaderboard_cache');
            
            // 清理旧的游戏进度（超过24小时）
            const gameProgress = this.getItem('current_game');
            if (gameProgress && gameProgress.timestamp) {
                const maxAge = 24 * 60 * 60 * 1000; // 24小时
                if (Date.now() - gameProgress.timestamp > maxAge) {
                    this.removeItem('current_game');
                }
            }
            
            // 清理已同步的旧游戏记录
            const offlineGames = this.getOfflineGames();
            const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7天前
            
            const filteredGames = offlineGames.filter(game => {
                return !game.synced || game.timestamp > cutoffTime;
            });
            
            if (filteredGames.length < offlineGames.length) {
                this.setItem('offline_games', filteredGames);
                console.log(`清理了 ${offlineGames.length - filteredGames.length} 条旧游戏记录`);
            }
            
            this.updateStorageStats();
        } catch (error) {
            console.error('清理旧数据失败:', error);
        }
    }
    
    /**
     * 获取存储大小
     */
    getStorageSize() {
        if (!this.isAvailable) return 0;
        
        let totalSize = 0;
        
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.config.storagePrefix)) {
                    const value = localStorage.getItem(key);
                    totalSize += key.length + (value ? value.length : 0);
                }
            }
        } catch (error) {
            console.error('计算存储大小失败:', error);
        }
        
        return totalSize;
    }
    
    /**
     * 更新存储统计
     */
    updateStorageStats() {
        if (!this.isAvailable) return;
        
        try {
            let itemCount = 0;
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.config.storagePrefix)) {
                    itemCount++;
                }
            }
            
            this.storageStats.totalItems = itemCount;
            this.storageStats.totalSize = this.getStorageSize();
            this.storageStats.pendingSync = this.getUnsyncedGames().length;
        } catch (error) {
            console.error('更新存储统计失败:', error);
        }
    }
    
    /**
     * 加载待同步数据
     */
    loadPendingSyncData() {
        this.pendingSyncData = this.getUnsyncedGames();
        console.log(`加载了 ${this.pendingSyncData.length} 条待同步数据`);
    }
    
    /**
     * 保存待同步数据
     */
    savePendingSyncData() {
        // 待同步数据已经保存在 offline_games 中
        console.log('待同步数据已保存');
    }
    
    /**
     * 处理存储变化
     */
    handleStorageChange(event) {
        console.log('存储发生变化:', event.key);
        this.updateStorageStats();
        
        // 触发存储变化事件
        this.dispatchEvent('storageChanged', {
            key: event.key,
            oldValue: event.oldValue,
            newValue: event.newValue
        });
    }
    
    /**
     * 生成唯一ID
     */
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 获取存储统计
     */
    getStorageStats() {
        this.updateStorageStats();
        return {
            ...this.storageStats,
            isAvailable: this.isAvailable,
            maxStorageSize: this.config.maxStorageSize,
            storageUsagePercent: (this.storageStats.totalSize / this.config.maxStorageSize) * 100
        };
    }
    
    /**
     * 清除所有数据
     */
    clearAllData() {
        if (!this.isAvailable) return false;
        
        try {
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.config.storagePrefix)) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
            
            // 重置状态
            this.pendingSyncData = [];
            this.syncQueue.clear();
            this.updateStorageStats();
            
            console.log('所有离线数据已清除');
            return true;
        } catch (error) {
            console.error('清除所有数据失败:', error);
            return false;
        }
    }
    
    /**
     * 导出数据
     */
    exportData() {
        if (!this.isAvailable) return null;
        
        try {
            const exportData = {
                timestamp: Date.now(),
                version: '1.0',
                data: {}
            };
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.config.storagePrefix)) {
                    const shortKey = key.replace(this.config.storagePrefix, '');
                    exportData.data[shortKey] = localStorage.getItem(key);
                }
            }
            
            return exportData;
        } catch (error) {
            console.error('导出数据失败:', error);
            return null;
        }
    }
    
    /**
     * 导入数据
     */
    importData(importData) {
        if (!this.isAvailable || !importData || !importData.data) {
            return false;
        }
        
        try {
            for (const [key, value] of Object.entries(importData.data)) {
                const fullKey = this.getStorageKey(key);
                localStorage.setItem(fullKey, value);
            }
            
            this.updateStorageStats();
            this.loadPendingSyncData();
            
            console.log('数据导入成功');
            return true;
        } catch (error) {
            console.error('导入数据失败:', error);
            return false;
        }
    }
    
    /**
     * 触发自定义事件
     */
    dispatchEvent(eventName, data) {
        const event = new CustomEvent(`offlineStorage:${eventName}`, {
            detail: data
        });
        window.dispatchEvent(event);
    }
}

// 创建全局离线存储实例
window.offlineStorage = new OfflineStorage({
    storagePrefix: 'tetris_',
    maxOfflineGames: 100,
    maxStorageSize: 10 * 1024 * 1024, // 10MB
    syncRetryAttempts: 3,
    syncRetryDelay: 2000,
    enableCompression: true
});

// 导出离线存储类
window.OfflineStorage = OfflineStorage;

console.log('离线存储模块加载完成');
</content>