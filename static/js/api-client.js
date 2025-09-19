/**
 * 俄罗斯方块游戏 - API客户端
 * 处理与后端服务器的HTTP通信
 */

class APIClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
        this.defaultTimeout = 10000; // 10秒超时
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1秒重试延迟
        
        // 网络状态监控
        this.isOnline = navigator.onLine;
        this.setupNetworkMonitoring();
        
        // 请求队列（离线时使用）
        this.requestQueue = [];
        
        console.log('API客户端初始化完成');
    }
    
    /**
     * 设置网络状态监控
     */
    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            console.log('网络连接已恢复');
            this.isOnline = true;
            this.processQueuedRequests();
            this.notifyNetworkStatus(true);
        });
        
        window.addEventListener('offline', () => {
            console.log('网络连接已断开');
            this.isOnline = false;
            this.notifyNetworkStatus(false);
        });
    }
    
    /**
     * 通知网络状态变化
     */
    notifyNetworkStatus(isOnline) {
        const event = new CustomEvent('networkStatusChanged', {
            detail: { isOnline }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 处理排队的请求
     */
    async processQueuedRequests() {
        if (this.requestQueue.length === 0) return;
        
        console.log(`处理 ${this.requestQueue.length} 个排队的请求`);
        
        const queuedRequests = [...this.requestQueue];
        this.requestQueue = [];
        
        for (const request of queuedRequests) {
            try {
                const result = await this.makeRequest(request.url, request.options);
                if (request.resolve) {
                    request.resolve(result);
                }
            } catch (error) {
                if (request.reject) {
                    request.reject(error);
                }
            }
        }
    }
    
    /**
     * 创建HTTP请求
     */
    async makeRequest(url, options = {}) {
        const fullURL = this.baseURL + url;
        
        // 设置默认选项
        const requestOptions = {
            timeout: this.defaultTimeout,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        // 如果离线且不是GET请求，加入队列
        if (!this.isOnline && options.method !== 'GET') {
            return new Promise((resolve, reject) => {
                this.requestQueue.push({
                    url,
                    options: requestOptions,
                    resolve,
                    reject
                });
                console.log('请求已加入离线队列:', url);
            });
        }
        
        // 执行请求（带重试机制）
        return this.executeRequestWithRetry(fullURL, requestOptions);
    }
    
    /**
     * 执行带重试机制的请求
     */
    async executeRequestWithRetry(url, options, retryCount = 0) {
        try {
            const response = await this.fetchWithTimeout(url, options);
            
            if (!response.ok) {
                throw new APIError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    await this.parseErrorResponse(response)
                );
            }
            
            return await response.json();
            
        } catch (error) {
            // 如果是网络错误且还有重试次数
            if (this.shouldRetry(error, retryCount)) {
                console.log(`请求失败，${this.retryDelay}ms后重试 (${retryCount + 1}/${this.maxRetries}):`, error.message);
                
                await this.delay(this.retryDelay * Math.pow(2, retryCount)); // 指数退避
                return this.executeRequestWithRetry(url, options, retryCount + 1);
            }
            
            throw error;
        }
    }
    
    /**
     * 带超时的fetch请求
     */
    async fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new APIError('请求超时', 408);
            }
            throw error;
        }
    }
    
    /**
     * 判断是否应该重试
     */
    shouldRetry(error, retryCount) {
        if (retryCount >= this.maxRetries) return false;
        
        // 网络错误或服务器错误可以重试
        if (error instanceof TypeError || // 网络错误
            error.name === 'AbortError' || // 超时
            (error instanceof APIError && error.status >= 500)) { // 服务器错误
            return true;
        }
        
        return false;
    }
    
    /**
     * 解析错误响应
     */
    async parseErrorResponse(response) {
        try {
            const errorData = await response.json();
            return errorData.error || errorData.message || '未知错误';
        } catch {
            return response.statusText || '请求失败';
        }
    }
    
    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // ==================== 用户管理API ====================
    
    /**
     * 创建新用户
     * @param {string} username - 可选的用户名
     * @returns {Promise<Object>} 用户信息
     */
    async createUser(username = null) {
        try {
            const requestBody = username ? { username } : {};
            
            const response = await this.makeRequest('/api/users', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });
            
            console.log('用户创建成功:', response.data);
            return response.data;
            
        } catch (error) {
            console.error('创建用户失败:', error);
            throw new APIError('创建用户失败: ' + error.message, error.status);
        }
    }
    
    /**
     * 获取用户信息
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>} 用户信息
     */
    async getUser(userId) {
        try {
            if (!userId) {
                throw new APIError('用户ID不能为空', 400);
            }
            
            const response = await this.makeRequest(`/api/users/${userId}`, {
                method: 'GET'
            });
            
            return response.data;
            
        } catch (error) {
            console.error('获取用户信息失败:', error);
            throw new APIError('获取用户信息失败: ' + error.message, error.status);
        }
    }
    
    // ==================== 游戏数据API ====================
    
    /**
     * 提交游戏得分
     * @param {Object} gameData - 游戏数据
     * @param {string} gameData.user_id - 用户ID
     * @param {number} gameData.score - 得分
     * @param {number} gameData.level - 级别
     * @param {number} gameData.lines_cleared - 消除行数
     * @param {number} gameData.game_duration - 游戏时长（秒）
     * @returns {Promise<Object>} 游戏记录
     */
    async submitGameScore(gameData) {
        try {
            // 验证游戏数据
            this.validateGameData(gameData);
            
            const response = await this.makeRequest('/api/games', {
                method: 'POST',
                body: JSON.stringify(gameData)
            });
            
            console.log('游戏得分提交成功:', response.data);
            return response.data;
            
        } catch (error) {
            console.error('提交游戏得分失败:', error);
            throw new APIError('提交游戏得分失败: ' + error.message, error.status);
        }
    }
    
    /**
     * 验证游戏数据
     */
    validateGameData(gameData) {
        const requiredFields = ['user_id', 'score', 'level', 'lines_cleared', 'game_duration'];
        
        for (const field of requiredFields) {
            if (!(field in gameData)) {
                throw new APIError(`缺少必需字段: ${field}`, 400);
            }
        }
        
        if (typeof gameData.score !== 'number' || gameData.score < 0) {
            throw new APIError('得分必须是非负数字', 400);
        }
        
        if (typeof gameData.level !== 'number' || gameData.level < 1) {
            throw new APIError('级别必须是正数字', 400);
        }
        
        if (typeof gameData.lines_cleared !== 'number' || gameData.lines_cleared < 0) {
            throw new APIError('消除行数必须是非负数字', 400);
        }
        
        if (typeof gameData.game_duration !== 'number' || gameData.game_duration < 0) {
            throw new APIError('游戏时长必须是非负数字', 400);
        }
    }
    
    // ==================== 排行榜API ====================
    
    /**
     * 获取排行榜
     * @param {number} limit - 返回记录数量限制
     * @returns {Promise<Array>} 排行榜数据
     */
    async getLeaderboard(limit = 10) {
        try {
            if (limit < 1 || limit > 100) {
                throw new APIError('limit参数必须在1-100之间', 400);
            }
            
            const response = await this.makeRequest(`/api/leaderboard?limit=${limit}`, {
                method: 'GET'
            });
            
            return response.data;
            
        } catch (error) {
            console.error('获取排行榜失败:', error);
            throw new APIError('获取排行榜失败: ' + error.message, error.status);
        }
    }
    
    /**
     * 获取用户排名
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>} 用户排名信息
     */
    async getUserRank(userId) {
        try {
            if (!userId) {
                throw new APIError('用户ID不能为空', 400);
            }
            
            const response = await this.makeRequest(`/api/users/${userId}/rank`, {
                method: 'GET'
            });
            
            return response.data;
            
        } catch (error) {
            console.error('获取用户排名失败:', error);
            throw new APIError('获取用户排名失败: ' + error.message, error.status);
        }
    }
    
    // ==================== 批量操作 ====================
    
    /**
     * 批量获取游戏数据（排行榜 + 用户排名）
     * @param {string} userId - 用户ID
     * @param {number} leaderboardLimit - 排行榜限制
     * @returns {Promise<Object>} 包含排行榜和用户排名的对象
     */
    async getGameData(userId, leaderboardLimit = 10) {
        try {
            const [leaderboard, userRank] = await Promise.allSettled([
                this.getLeaderboard(leaderboardLimit),
                userId ? this.getUserRank(userId) : Promise.resolve(null)
            ]);
            
            const result = {
                leaderboard: leaderboard.status === 'fulfilled' ? leaderboard.value : [],
                userRank: userRank.status === 'fulfilled' ? userRank.value : null,
                errors: []
            };
            
            if (leaderboard.status === 'rejected') {
                result.errors.push('获取排行榜失败: ' + leaderboard.reason.message);
            }
            
            if (userRank.status === 'rejected' && userId) {
                result.errors.push('获取用户排名失败: ' + userRank.reason.message);
            }
            
            return result;
            
        } catch (error) {
            console.error('批量获取游戏数据失败:', error);
            throw new APIError('批量获取游戏数据失败: ' + error.message, error.status);
        }
    }
    
    // ==================== 健康检查 ====================
    
    /**
     * 检查API服务器状态
     * @returns {Promise<boolean>} 服务器是否可用
     */
    async checkServerHealth() {
        try {
            await this.makeRequest('/api/leaderboard?limit=1', {
                method: 'GET',
                timeout: 5000 // 较短的超时时间
            });
            return true;
        } catch (error) {
            console.warn('服务器健康检查失败:', error.message);
            return false;
        }
    }
}

/**
 * API错误类
 */
class APIError extends Error {
    constructor(message, status = 0, details = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.details = details;
    }
    
    /**
     * 判断是否为网络错误
     */
    isNetworkError() {
        return this.status === 0 || this.status === 408;
    }
    
    /**
     * 判断是否为客户端错误
     */
    isClientError() {
        return this.status >= 400 && this.status < 500;
    }
    
    /**
     * 判断是否为服务器错误
     */
    isServerError() {
        return this.status >= 500;
    }
    
    /**
     * 获取用户友好的错误消息
     */
    getUserFriendlyMessage() {
        if (this.isNetworkError()) {
            return '网络连接失败，请检查网络设置';
        } else if (this.status === 404) {
            return '请求的资源不存在';
        } else if (this.isClientError()) {
            return this.message || '请求参数错误';
        } else if (this.isServerError()) {
            return '服务器暂时不可用，请稍后重试';
        } else {
            return this.message || '未知错误';
        }
    }
}

// 导出API客户端和错误类
window.APIClient = APIClient;
window.APIError = APIError;

// 创建全局API客户端实例
window.apiClient = new APIClient();

console.log('API客户端模块加载完成');