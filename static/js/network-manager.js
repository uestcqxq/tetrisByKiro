/**
 * 网络状态管理器
 * 监控网络连接状态，处理在线/离线切换
 */

class NetworkManager {
    constructor(config = {}) {
        this.config = {
            pingInterval: 30000, // 30秒
            pingTimeout: 5000,   // 5秒超时
            pingUrl: '/api/health/ping',
            maxPingFailures: 3,
            reconnectDelay: 2000,
            enableDetailedMonitoring: true,
            ...config
        };
        
        // 网络状态
        this.isOnline = navigator.onLine;
        this.lastOnlineTime = Date.now();
        this.lastOfflineTime = null;
        this.connectionQuality = 'unknown';
        
        // 监控状态
        this.pingTimer = null;
        this.pingFailureCount = 0;
        this.isMonitoring = false;
        
        // 网络统计
        this.networkStats = {
            totalPings: 0,
            successfulPings: 0,
            failedPings: 0,
            averageLatency: 0,
            minLatency: Infinity,
            maxLatency: 0,
            connectionChanges: 0,
            totalOnlineTime: 0,
            totalOfflineTime: 0,
            startTime: Date.now()
        };
        
        // 事件监听器
        this.eventListeners = new Map();
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化网络管理器
     */
    init() {
        this.setupNetworkEventListeners();
        this.startMonitoring();
        
        console.log('网络状态管理器初始化完成');
    }
    
    /**
     * 设置网络事件监听器
     */
    setupNetworkEventListeners() {
        // 监听浏览器网络状态变化
        window.addEventListener('online', () => {
            this.handleNetworkChange(true, 'browser_event');
        });
        
        window.addEventListener('offline', () => {
            this.handleNetworkChange(false, 'browser_event');
        });
        
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isMonitoring) {
                // 页面重新可见时立即检查网络状态
                this.performPing();
            }
        });
        
        // 监听焦点变化
        window.addEventListener('focus', () => {
            if (this.isMonitoring) {
                this.performPing();
            }
        });
    }
    
    /**
     * 开始网络监控
     */
    startMonitoring() {
        if (this.isMonitoring) {
            console.log('网络监控已在运行');
            return;
        }
        
        this.isMonitoring = true;
        
        // 立即执行一次ping
        this.performPing();
        
        // 设置定期ping
        this.pingTimer = setInterval(() => {
            this.performPing();
        }, this.config.pingInterval);
        
        console.log('网络监控已启动');
    }
    
    /**
     * 停止网络监控
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        
        console.log('网络监控已停止');
    }
    
    /**
     * 执行网络ping测试
     */
    async performPing() {
        if (!this.isMonitoring) return;
        
        const startTime = Date.now();
        this.networkStats.totalPings++;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.pingTimeout);
            
            const response = await fetch(this.config.pingUrl, {
                method: 'GET',
                cache: 'no-cache',
                signal: controller.signal,
                headers: {
                    'X-Ping-Test': 'true'
                }
            });
            
            clearTimeout(timeoutId);
            
            const latency = Date.now() - startTime;
            
            if (response.ok) {
                this.handlePingSuccess(latency);
            } else {
                this.handlePingFailure(new Error(`HTTP ${response.status}`));
            }
            
        } catch (error) {
            this.handlePingFailure(error);
        }
    }
    
    /**
     * 处理ping成功
     */
    handlePingSuccess(latency) {
        this.networkStats.successfulPings++;
        this.pingFailureCount = 0;
        
        // 更新延迟统计
        this.updateLatencyStats(latency);
        
        // 评估连接质量
        this.assessConnectionQuality(latency);
        
        // 如果之前是离线状态，现在恢复在线
        if (!this.isOnline) {
            this.handleNetworkChange(true, 'ping_success');
        }
        
        // 触发ping成功事件
        this.emit('pingSuccess', {
            latency,
            timestamp: Date.now(),
            quality: this.connectionQuality
        });
    }
    
    /**
     * 处理ping失败
     */
    handlePingFailure(error) {
        this.networkStats.failedPings++;
        this.pingFailureCount++;
        
        console.log(`网络ping失败 (${this.pingFailureCount}/${this.config.maxPingFailures}):`, error.message);
        
        // 如果连续失败次数达到阈值，标记为离线
        if (this.pingFailureCount >= this.config.maxPingFailures && this.isOnline) {
            this.handleNetworkChange(false, 'ping_failure');
        }
        
        // 触发ping失败事件
        this.emit('pingFailure', {
            error: error.message,
            failureCount: this.pingFailureCount,
            timestamp: Date.now()
        });
    }
    
    /**
     * 更新延迟统计
     */
    updateLatencyStats(latency) {
        // 更新平均延迟（指数移动平均）
        if (this.networkStats.averageLatency === 0) {
            this.networkStats.averageLatency = latency;
        } else {
            this.networkStats.averageLatency = 
                this.networkStats.averageLatency * 0.8 + latency * 0.2;
        }
        
        // 更新最小和最大延迟
        this.networkStats.minLatency = Math.min(this.networkStats.minLatency, latency);
        this.networkStats.maxLatency = Math.max(this.networkStats.maxLatency, latency);
    }
    
    /**
     * 评估连接质量
     */
    assessConnectionQuality(latency) {
        let quality;
        
        if (latency < 100) {
            quality = 'excellent';
        } else if (latency < 300) {
            quality = 'good';
        } else if (latency < 1000) {
            quality = 'fair';
        } else {
            quality = 'poor';
        }
        
        if (quality !== this.connectionQuality) {
            const oldQuality = this.connectionQuality;
            this.connectionQuality = quality;
            
            this.emit('qualityChanged', {
                oldQuality,
                newQuality: quality,
                latency,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * 处理网络状态变化
     */
    handleNetworkChange(isOnline, source) {
        const wasOnline = this.isOnline;
        const now = Date.now();
        
        if (isOnline === wasOnline) {
            return; // 状态没有变化
        }
        
        // 更新状态
        this.isOnline = isOnline;
        this.networkStats.connectionChanges++;
        
        if (isOnline) {
            // 从离线变为在线
            this.lastOnlineTime = now;
            
            if (this.lastOfflineTime) {
                this.networkStats.totalOfflineTime += now - this.lastOfflineTime;
            }
            
            console.log(`网络已连接 (来源: ${source})`);
            
            // 重置ping失败计数
            this.pingFailureCount = 0;
            
            // 立即执行一次ping来确认连接
            setTimeout(() => this.performPing(), 1000);
            
        } else {
            // 从在线变为离线
            this.lastOfflineTime = now;
            this.connectionQuality = 'offline';
            
            if (this.lastOnlineTime) {
                this.networkStats.totalOnlineTime += now - this.lastOnlineTime;
            }
            
            console.log(`网络已断开 (来源: ${source})`);
        }
        
        // 触发网络状态变化事件
        this.emit('statusChanged', {
            isOnline,
            wasOnline,
            source,
            timestamp: now,
            connectionQuality: this.connectionQuality
        });
        
        // 触发具体的在线/离线事件
        if (isOnline) {
            this.emit('online', {
                source,
                timestamp: now,
                offlineDuration: this.lastOfflineTime ? now - this.lastOfflineTime : 0
            });
        } else {
            this.emit('offline', {
                source,
                timestamp: now,
                onlineDuration: this.lastOnlineTime ? now - this.lastOnlineTime : 0
            });
        }
    }
    
    /**
     * 手动检查网络状态
     */
    async checkNetworkStatus() {
        console.log('手动检查网络状态');
        await this.performPing();
    }
    
    /**
     * 获取网络状态信息
     */
    getNetworkStatus() {
        const now = Date.now();
        
        return {
            isOnline: this.isOnline,
            connectionQuality: this.connectionQuality,
            lastOnlineTime: this.lastOnlineTime,
            lastOfflineTime: this.lastOfflineTime,
            currentSessionDuration: this.isOnline ? 
                (this.lastOnlineTime ? now - this.lastOnlineTime : 0) :
                (this.lastOfflineTime ? now - this.lastOfflineTime : 0),
            pingFailureCount: this.pingFailureCount,
            isMonitoring: this.isMonitoring
        };
    }
    
    /**
     * 获取网络统计信息
     */
    getNetworkStats() {
        const now = Date.now();
        const uptime = now - this.networkStats.startTime;
        
        // 计算当前会话时间
        let currentOnlineTime = this.networkStats.totalOnlineTime;
        let currentOfflineTime = this.networkStats.totalOfflineTime;
        
        if (this.isOnline && this.lastOnlineTime) {
            currentOnlineTime += now - this.lastOnlineTime;
        } else if (!this.isOnline && this.lastOfflineTime) {
            currentOfflineTime += now - this.lastOfflineTime;
        }
        
        return {
            ...this.networkStats,
            uptime,
            currentOnlineTime,
            currentOfflineTime,
            onlinePercentage: uptime > 0 ? (currentOnlineTime / uptime) * 100 : 0,
            offlinePercentage: uptime > 0 ? (currentOfflineTime / uptime) * 100 : 0,
            successRate: this.networkStats.totalPings > 0 ? 
                (this.networkStats.successfulPings / this.networkStats.totalPings) * 100 : 0,
            averageLatencyRounded: Math.round(this.networkStats.averageLatency)
        };
    }
    
    /**
     * 获取连接质量描述
     */
    getQualityDescription(quality = this.connectionQuality) {
        const descriptions = {
            'excellent': '优秀 (<100ms)',
            'good': '良好 (100-300ms)',
            'fair': '一般 (300-1000ms)',
            'poor': '较差 (>1000ms)',
            'offline': '离线',
            'unknown': '未知'
        };
        
        return descriptions[quality] || '未知';
    }
    
    /**
     * 获取连接质量颜色
     */
    getQualityColor(quality = this.connectionQuality) {
        const colors = {
            'excellent': '#4CAF50',
            'good': '#8BC34A',
            'fair': '#FF9800',
            'poor': '#F44336',
            'offline': '#9E9E9E',
            'unknown': '#607D8B'
        };
        
        return colors[quality] || '#607D8B';
    }
    
    /**
     * 重置网络统计
     */
    resetStats() {
        this.networkStats = {
            totalPings: 0,
            successfulPings: 0,
            failedPings: 0,
            averageLatency: 0,
            minLatency: Infinity,
            maxLatency: 0,
            connectionChanges: 0,
            totalOnlineTime: 0,
            totalOfflineTime: 0,
            startTime: Date.now()
        };
        
        console.log('网络统计已重置');
    }
    
    /**
     * 设置配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // 如果ping间隔改变，重启监控
        if (newConfig.pingInterval && this.isMonitoring) {
            this.stopMonitoring();
            this.startMonitoring();
        }
        
        console.log('网络管理器配置已更新');
    }
    
    /**
     * 添加事件监听器
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
    
    /**
     * 移除事件监听器
     */
    off(event, callback) {
        if (!this.eventListeners.has(event)) return;
        
        const listeners = this.eventListeners.get(event);
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }
    
    /**
     * 触发事件
     */
    emit(event, data) {
        if (!this.eventListeners.has(event)) return;
        
        const listeners = this.eventListeners.get(event);
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`网络事件监听器错误 (${event}):`, error);
            }
        });
    }
    
    /**
     * 一次性事件监听器
     */
    once(event, callback) {
        const onceCallback = (data) => {
            callback(data);
            this.off(event, onceCallback);
        };
        this.on(event, onceCallback);
    }
    
    /**
     * 创建网络状态显示组件
     */
    createStatusDisplay() {
        const statusDisplay = document.createElement('div');
        statusDisplay.id = 'network-status-display';
        statusDisplay.className = 'network-status-display';
        
        this.updateStatusDisplay(statusDisplay);
        
        // 监听状态变化更新显示
        this.on('statusChanged', () => this.updateStatusDisplay(statusDisplay));
        this.on('qualityChanged', () => this.updateStatusDisplay(statusDisplay));
        
        return statusDisplay;
    }
    
    /**
     * 更新状态显示
     */
    updateStatusDisplay(element) {
        if (!element) return;
        
        const status = this.getNetworkStatus();
        const quality = this.getQualityDescription();
        const color = this.getQualityColor();
        
        element.innerHTML = `
            <div class="network-indicator" style="background-color: ${color}">
                <span class="status-text">${status.isOnline ? '在线' : '离线'}</span>
                <span class="quality-text">${quality}</span>
            </div>
        `;
        
        element.style.cssText = `
            position: fixed;
            bottom: 60px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            z-index: 9998;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
    }
    
    /**
     * 销毁网络管理器
     */
    destroy() {
        this.stopMonitoring();
        this.eventListeners.clear();
        
        console.log('网络状态管理器已销毁');
    }
}

// 创建全局网络管理器实例
window.networkManager = new NetworkManager({
    pingInterval: 30000,
    pingTimeout: 5000,
    pingUrl: '/api/health/ping',
    maxPingFailures: 3,
    reconnectDelay: 2000,
    enableDetailedMonitoring: true
});

// 导出网络管理器类
window.NetworkManager = NetworkManager;

console.log('网络状态管理器模块加载完成');
</content>