/**
 * 俄罗斯方块游戏 - WebSocket客户端
 * 处理与后端服务器的实时通信
 */

class WebSocketClient {
    constructor(config = {}) {
        this.config = {
            autoConnect: true,
            reconnectAttempts: 5,
            reconnectDelay: 1000,
            heartbeatInterval: 30000, // 30秒心跳
            connectionTimeout: 10000,
            ...config
        };
        
        // 连接状态
        this.socket = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectCount = 0;
        this.heartbeatTimer = null;
        this.connectionTimer = null;
        
        // 事件监听器
        this.eventListeners = new Map();
        
        // 用户信息
        this.currentUser = null;
        this.isSubscribedToLeaderboard = false;
        
        // 连接统计
        this.connectionStats = {
            connectTime: null,
            disconnectTime: null,
            totalReconnects: 0,
            lastPingTime: null,
            lastPongTime: null,
            averageLatency: 0
        };
        
        console.log('WebSocket客户端初始化完成');
        
        // 自动连接
        if (this.config.autoConnect) {
            this.connect();
        }
    }
    
    /**
     * 连接到WebSocket服务器
     */
    connect() {
        if (this.isConnected || this.isConnecting) {
            console.log('WebSocket已连接或正在连接中');
            return;
        }
        
        this.isConnecting = true;
        console.log('正在连接WebSocket服务器...');
        
        try {
            // 检查Socket.IO是否可用
            if (typeof io === 'undefined') {
                throw new Error('Socket.IO库未加载');
            }
            
            // 创建Socket.IO连接
            this.socket = io({
                transports: ['websocket', 'polling'],
                timeout: this.config.connectionTimeout,
                forceNew: true
            });
            
            // 设置连接超时
            this.connectionTimer = setTimeout(() => {
                if (!this.isConnected) {
                    console.error('WebSocket连接超时');
                    this.handleConnectionError(new Error('连接超时'));
                }
            }, this.config.connectionTimeout);
            
            // 注册Socket.IO事件
            this.registerSocketEvents();
            
        } catch (error) {
            console.error('WebSocket连接失败:', error);
            this.handleConnectionError(error);
        }
    }
    
    /**
     * 断开WebSocket连接
     */
    disconnect() {
        console.log('断开WebSocket连接');
        
        this.isConnecting = false;
        this.clearTimers();
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.isConnected = false;
        this.connectionStats.disconnectTime = Date.now();
        
        // 触发断开连接事件
        this.emit('disconnected', {
            reason: 'manual',
            timestamp: Date.now()
        });
    }
    
    /**
     * 注册Socket.IO事件监听器
     */
    registerSocketEvents() {
        if (!this.socket) return;
        
        // 连接成功
        this.socket.on('connect', () => {
            console.log('WebSocket连接成功');
            this.handleConnectionSuccess();
        });
        
        // 连接失败
        this.socket.on('connect_error', (error) => {
            console.error('WebSocket连接错误:', error);
            this.handleConnectionError(error);
        });
        
        // 断开连接
        this.socket.on('disconnect', (reason) => {
            console.log('WebSocket连接断开:', reason);
            this.handleDisconnection(reason);
        });
        
        // 连接确认
        this.socket.on('connection_confirmed', (data) => {
            console.log('服务器连接确认:', data);
            this.emit('connectionConfirmed', data);
        });
        
        // 排行榜相关事件
        this.socket.on('leaderboard_updated', (data) => {
            console.log('排行榜更新:', data);
            this.emit('leaderboardUpdated', data);
        });
        
        this.socket.on('leaderboard_data', (data) => {
            console.log('收到排行榜数据:', data);
            this.emit('leaderboardData', data);
        });
        
        this.socket.on('leaderboard_subscription_confirmed', (data) => {
            console.log('排行榜订阅确认:', data);
            this.isSubscribedToLeaderboard = data.subscribed;
            this.emit('leaderboardSubscriptionChanged', data);
        });
        
        // 用户排名相关事件
        this.socket.on('rank_changed', (data) => {
            console.log('用户排名变化:', data);
            this.emit('rankChanged', data);
        });
        
        this.socket.on('user_rank_data', (data) => {
            console.log('收到用户排名数据:', data);
            this.emit('userRankData', data);
        });
        
        // 游戏相关事件
        this.socket.on('game_saved', (data) => {
            console.log('游戏得分已保存:', data);
            this.emit('gameSaved', data);
        });
        
        this.socket.on('login_confirmed', (data) => {
            console.log('用户登录确认:', data);
            this.emit('loginConfirmed', data);
        });
        
        // 统计信息事件
        this.socket.on('online_users_count', (data) => {
            console.log('在线用户数更新:', data);
            this.emit('onlineUsersCount', data);
        });
        
        this.socket.on('leaderboard_stats', (data) => {
            console.log('排行榜统计信息:', data);
            this.emit('leaderboardStats', data);
        });
        
        // 心跳响应
        this.socket.on('pong', (data) => {
            this.connectionStats.lastPongTime = Date.now();
            const latency = this.connectionStats.lastPongTime - this.connectionStats.lastPingTime;
            this.updateLatencyStats(latency);
            this.emit('pong', { ...data, latency });
        });
        
        // 错误处理
        this.socket.on('error', (error) => {
            console.error('WebSocket服务器错误:', error);
            this.emit('serverError', error);
        });
    }
    
    /**
     * 处理连接成功
     */
    handleConnectionSuccess() {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectCount = 0;
        this.connectionStats.connectTime = Date.now();
        
        // 清除连接超时定时器
        if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
        }
        
        // 启动心跳
        this.startHeartbeat();
        
        // 如果有用户信息，发送登录事件
        if (this.currentUser) {
            this.sendUserLogin(this.currentUser.id);
        }
        
        // 触发连接成功事件
        this.emit('connected', {
            timestamp: this.connectionStats.connectTime,
            reconnectCount: this.connectionStats.totalReconnects
        });
    }
    
    /**
     * 处理连接错误
     */
    handleConnectionError(error) {
        this.isConnecting = false;
        
        // 清除连接超时定时器
        if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
        }
        
        // 触发连接错误事件
        this.emit('connectionError', {
            error: error.message || error,
            timestamp: Date.now(),
            reconnectCount: this.reconnectCount
        });
        
        // 尝试重连
        this.attemptReconnect();
    }
    
    /**
     * 处理断开连接
     */
    handleDisconnection(reason) {
        this.isConnected = false;
        this.isConnecting = false;
        this.connectionStats.disconnectTime = Date.now();
        
        // 停止心跳
        this.stopHeartbeat();
        
        // 触发断开连接事件
        this.emit('disconnected', {
            reason,
            timestamp: this.connectionStats.disconnectTime
        });
        
        // 如果不是手动断开，尝试重连
        if (reason !== 'io client disconnect') {
            this.attemptReconnect();
        }
    }
    
    /**
     * 尝试重连
     */
    attemptReconnect() {
        if (this.reconnectCount >= this.config.reconnectAttempts) {
            console.error('WebSocket重连次数已达上限');
            this.emit('reconnectFailed', {
                attempts: this.reconnectCount,
                timestamp: Date.now()
            });
            return;
        }
        
        this.reconnectCount++;
        this.connectionStats.totalReconnects++;
        
        const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectCount - 1); // 指数退避
        
        console.log(`${delay}ms后尝试第${this.reconnectCount}次重连...`);
        
        setTimeout(() => {
            if (!this.isConnected && !this.isConnecting) {
                this.emit('reconnecting', {
                    attempt: this.reconnectCount,
                    maxAttempts: this.config.reconnectAttempts,
                    delay
                });
                this.connect();
            }
        }, delay);
    }
    
    /**
     * 启动心跳检测
     */
    startHeartbeat() {
        this.stopHeartbeat(); // 确保没有重复的心跳
        
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected && this.socket) {
                this.connectionStats.lastPingTime = Date.now();
                this.socket.emit('ping');
            }
        }, this.config.heartbeatInterval);
    }
    
    /**
     * 停止心跳检测
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    
    /**
     * 清除所有定时器
     */
    clearTimers() {
        this.stopHeartbeat();
        
        if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
        }
    }
    
    /**
     * 更新延迟统计
     */
    updateLatencyStats(latency) {
        if (this.connectionStats.averageLatency === 0) {
            this.connectionStats.averageLatency = latency;
        } else {
            // 使用指数移动平均
            this.connectionStats.averageLatency = 
                this.connectionStats.averageLatency * 0.8 + latency * 0.2;
        }
    }
    
    // ==================== 用户相关方法 ====================
    
    /**
     * 设置当前用户
     */
    setUser(user) {
        this.currentUser = user;
        
        // 如果已连接，发送登录事件
        if (this.isConnected) {
            this.sendUserLogin(user.id);
        }
    }
    
    /**
     * 发送用户登录事件
     */
    sendUserLogin(userId) {
        if (!this.isConnected || !this.socket) {
            console.warn('WebSocket未连接，无法发送用户登录事件');
            return;
        }
        
        this.socket.emit('user_login', { user_id: userId });
    }
    
    /**
     * 发送游戏开始事件
     */
    sendGameStarted(userId) {
        if (!this.isConnected || !this.socket) {
            console.warn('WebSocket未连接，无法发送游戏开始事件');
            return;
        }
        
        this.socket.emit('game_started', { user_id: userId });
    }
    
    /**
     * 发送游戏结束事件
     */
    sendGameFinished(gameData) {
        if (!this.isConnected || !this.socket) {
            console.warn('WebSocket未连接，无法发送游戏结束事件');
            return;
        }
        
        this.socket.emit('game_finished', gameData);
    }
    
    // ==================== 排行榜相关方法 ====================
    
    /**
     * 请求排行榜数据
     */
    requestLeaderboard(limit = 10) {
        if (!this.isConnected || !this.socket) {
            console.warn('WebSocket未连接，无法请求排行榜');
            return;
        }
        
        this.socket.emit('request_leaderboard', { limit });
    }
    
    /**
     * 订阅排行榜更新
     */
    subscribeToLeaderboard() {
        if (!this.isConnected || !this.socket) {
            console.warn('WebSocket未连接，无法订阅排行榜更新');
            return;
        }
        
        this.socket.emit('subscribe_leaderboard');
    }
    
    /**
     * 取消订阅排行榜更新
     */
    unsubscribeFromLeaderboard() {
        if (!this.isConnected || !this.socket) {
            console.warn('WebSocket未连接，无法取消订阅排行榜更新');
            return;
        }
        
        this.socket.emit('unsubscribe_leaderboard');
    }
    
    /**
     * 请求用户排名
     */
    requestUserRank(userId) {
        if (!this.isConnected || !this.socket) {
            console.warn('WebSocket未连接，无法请求用户排名');
            return;
        }
        
        this.socket.emit('request_user_rank', { user_id: userId });
    }
    
    /**
     * 获取排行榜统计信息
     */
    getLeaderboardStats() {
        if (!this.isConnected || !this.socket) {
            console.warn('WebSocket未连接，无法获取排行榜统计');
            return;
        }
        
        this.socket.emit('get_leaderboard_stats');
    }
    
    /**
     * 获取在线用户数
     */
    getOnlineCount() {
        if (!this.isConnected || !this.socket) {
            console.warn('WebSocket未连接，无法获取在线用户数');
            return;
        }
        
        this.socket.emit('get_online_count');
    }
    
    // ==================== 事件系统 ====================
    
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
                console.error(`事件监听器错误 (${event}):`, error);
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
    
    // ==================== 状态查询方法 ====================
    
    /**
     * 获取连接状态
     */
    getConnectionState() {
        return {
            isConnected: this.isConnected,
            isConnecting: this.isConnecting,
            reconnectCount: this.reconnectCount,
            isSubscribedToLeaderboard: this.isSubscribedToLeaderboard,
            stats: { ...this.connectionStats }
        };
    }
    
    /**
     * 获取连接统计信息
     */
    getConnectionStats() {
        const stats = { ...this.connectionStats };
        
        if (stats.connectTime && this.isConnected) {
            stats.connectionDuration = Date.now() - stats.connectTime;
        }
        
        return stats;
    }
    
    /**
     * 检查连接健康状态
     */
    isHealthy() {
        if (!this.isConnected) return false;
        
        // 检查最近是否有心跳响应
        if (this.connectionStats.lastPongTime) {
            const timeSinceLastPong = Date.now() - this.connectionStats.lastPongTime;
            return timeSinceLastPong < this.config.heartbeatInterval * 2;
        }
        
        return true;
    }
}

// 导出WebSocket客户端类
window.WebSocketClient = WebSocketClient;

// 创建全局WebSocket客户端实例
window.wsClient = new WebSocketClient({
    autoConnect: false, // 手动控制连接时机
    reconnectAttempts: 5,
    reconnectDelay: 2000,
    heartbeatInterval: 30000
});

console.log('WebSocket客户端模块加载完成');