/**
 * 错误处理和离线支持管理器
 * 处理网络错误、离线状态检测和用户友好的错误提示
 */

class ErrorHandler {
    constructor(config = {}) {
        this.config = {
            maxRetries: 3,
            retryDelay: 1000,
            offlineCheckInterval: 5000,
            errorDisplayDuration: 5000,
            enableOfflineMode: true,
            enableErrorLogging: true,
            ...config
        };
        
        // 错误状态
        this.isOnline = navigator.onLine;
        this.lastOnlineCheck = Date.now();
        this.errorQueue = [];
        this.retryQueue = new Map();
        
        // 事件系统
        this.eventListeners = new Map();
        
        // 错误统计
        this.errorStats = {
            totalErrors: 0,
            networkErrors: 0,
            apiErrors: 0,
            gameErrors: 0,
            recoveredErrors: 0,
            startTime: Date.now()
        };
        
        // DOM元素
        this.errorContainer = null;
        this.offlineIndicator = null;
        this.connectionStatus = null;
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化错误处理器
     */
    init() {
        this.createErrorUI();
        this.setupNetworkMonitoring();
        this.setupGlobalErrorHandlers();
        this.startOfflineCheck();
        
        console.log('错误处理器初始化完成');
    }
    
    /**
     * 创建错误显示UI
     */
    createErrorUI() {
        // 创建错误容器
        this.errorContainer = document.createElement('div');
        this.errorContainer.id = 'error-container';
        this.errorContainer.className = 'error-container';
        this.errorContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
            pointer-events: none;
        `;
        document.body.appendChild(this.errorContainer);
        
        // 创建离线指示器
        this.offlineIndicator = document.createElement('div');
        this.offlineIndicator.id = 'offline-indicator';
        this.offlineIndicator.className = 'offline-indicator hidden';
        this.offlineIndicator.innerHTML = `
            <div class="offline-content">
                <i class="icon-offline">📡</i>
                <span class="offline-text">离线模式</span>
                <div class="offline-details">网络连接已断开</div>
            </div>
        `;
        this.offlineIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: #ff6b6b;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
            z-index: 10001;
            transition: all 0.3s ease;
            transform: translateY(-100px);
        `;
        document.body.appendChild(this.offlineIndicator);
        
        // 创建连接状态指示器
        this.connectionStatus = document.createElement('div');
        this.connectionStatus.id = 'connection-status';
        this.connectionStatus.className = 'connection-status';
        this.connectionStatus.innerHTML = `
            <div class="status-indicator online">
                <span class="status-dot"></span>
                <span class="status-text">在线</span>
            </div>
        `;
        this.connectionStatus.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            z-index: 9999;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
        document.body.appendChild(this.connectionStatus);
        
        // 添加CSS样式
        this.addErrorStyles();
    }
    
    /**
     * 添加错误处理相关的CSS样式
     */
    addErrorStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .error-message {
                background: #ff6b6b;
                color: white;
                padding: 12px 16px;
                margin-bottom: 8px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
                animation: slideInRight 0.3s ease-out;
                pointer-events: auto;
                cursor: pointer;
                position: relative;
                overflow: hidden;
            }
            
            .error-message.warning {
                background: #ffa726;
                box-shadow: 0 4px 12px rgba(255, 167, 38, 0.3);
            }
            
            .error-message.info {
                background: #42a5f5;
                box-shadow: 0 4px 12px rgba(66, 165, 245, 0.3);
            }
            
            .error-message.success {
                background: #66bb6a;
                box-shadow: 0 4px 12px rgba(102, 187, 106, 0.3);
            }
            
            .error-message .error-title {
                font-weight: 600;
                margin-bottom: 4px;
            }
            
            .error-message .error-details {
                font-size: 12px;
                opacity: 0.9;
            }
            
            .error-message .error-actions {
                margin-top: 8px;
                display: flex;
                gap: 8px;
            }
            
            .error-message .error-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .error-message .error-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .error-message .close-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                background: none;
                border: none;
                color: white;
                font-size: 16px;
                cursor: pointer;
                opacity: 0.7;
                transition: opacity 0.2s;
            }
            
            .error-message .close-btn:hover {
                opacity: 1;
            }
            
            .offline-indicator.hidden {
                transform: translateY(-100px) !important;
                opacity: 0;
            }
            
            .offline-indicator:not(.hidden) {
                transform: translateY(0);
                opacity: 1;
            }
            
            .status-indicator {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #66bb6a;
                animation: pulse 2s infinite;
            }
            
            .status-indicator.offline .status-dot {
                background: #ff6b6b;
            }
            
            .status-indicator.connecting .status-dot {
                background: #ffa726;
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }
            
            .error-message.shake {
                animation: shake 0.5s ease-in-out;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * 设置网络监控
     */
    setupNetworkMonitoring() {
        // 监听在线/离线事件
        window.addEventListener('online', () => {
            this.handleOnlineStatusChange(true);
        });
        
        window.addEventListener('offline', () => {
            this.handleOnlineStatusChange(false);
        });
        
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkNetworkStatus();
            }
        });
    }
    
    /**
     * 设置全局错误处理器
     */
    setupGlobalErrorHandlers() {
        // JavaScript错误
        window.addEventListener('error', (event) => {
            this.handleJavaScriptError(event.error, event.filename, event.lineno);
        });
        
        // Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            this.handlePromiseRejection(event.reason);
        });
        
        // 资源加载错误
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleResourceError(event.target);
            }
        }, true);
    }
    
    /**
     * 开始离线检查
     */
    startOfflineCheck() {
        setInterval(() => {
            this.checkNetworkStatus();
        }, this.config.offlineCheckInterval);
    }
    
    /**
     * 检查网络状态
     */
    async checkNetworkStatus() {
        try {
            // 尝试发送一个小的网络请求
            const response = await fetch('/api/health/ping', {
                method: 'GET',
                cache: 'no-cache',
                timeout: 5000
            });
            
            const isOnline = response.ok;
            if (isOnline !== this.isOnline) {
                this.handleOnlineStatusChange(isOnline);
            }
        } catch (error) {
            if (this.isOnline) {
                this.handleOnlineStatusChange(false);
            }
        }
        
        this.lastOnlineCheck = Date.now();
    }
    
    /**
     * 处理在线状态变化
     */
    handleOnlineStatusChange(isOnline) {
        const wasOnline = this.isOnline;
        this.isOnline = isOnline;
        
        if (isOnline && !wasOnline) {
            this.handleBackOnline();
            this.emit('online', { isOnline: true, timestamp: Date.now() });
        } else if (!isOnline && wasOnline) {
            this.handleGoOffline();
            this.emit('offline', { isOnline: false, timestamp: Date.now() });
        }
        
        this.updateConnectionStatus();
    }
    
    /**
     * 处理重新上线
     */
    handleBackOnline() {
        console.log('网络连接已恢复');
        
        // 隐藏离线指示器
        this.hideOfflineIndicator();
        
        // 显示恢复连接消息
        this.showError({
            type: 'success',
            title: '网络已恢复',
            message: '连接已重新建立',
            duration: 3000
        });
        
        // 重试失败的请求
        this.retryFailedRequests();
        
        // 触发自定义事件
        this.dispatchEvent('online', { timestamp: Date.now() });
    }
    
    /**
     * 处理离线
     */
    handleGoOffline() {
        console.log('网络连接已断开');
        
        // 显示离线指示器
        this.showOfflineIndicator();
        
        // 显示离线消息
        this.showError({
            type: 'warning',
            title: '网络连接断开',
            message: '已切换到离线模式，部分功能可能受限',
            duration: 0, // 不自动消失
            actions: [{
                text: '重试连接',
                action: () => this.checkNetworkStatus()
            }]
        });
        
        // 触发自定义事件
        this.dispatchEvent('offline', { timestamp: Date.now() });
    }
    
    /**
     * 显示离线指示器
     */
    showOfflineIndicator() {
        if (this.offlineIndicator) {
            this.offlineIndicator.classList.remove('hidden');
        }
    }
    
    /**
     * 隐藏离线指示器
     */
    hideOfflineIndicator() {
        if (this.offlineIndicator) {
            this.offlineIndicator.classList.add('hidden');
        }
    }
    
    /**
     * 更新连接状态显示
     */
    updateConnectionStatus() {
        if (!this.connectionStatus) return;
        
        const indicator = this.connectionStatus.querySelector('.status-indicator');
        const text = this.connectionStatus.querySelector('.status-text');
        
        if (this.isOnline) {
            indicator.className = 'status-indicator online';
            text.textContent = '在线';
        } else {
            indicator.className = 'status-indicator offline';
            text.textContent = '离线';
        }
    }
    
    /**
     * 显示错误消息
     */
    showError(errorConfig) {
        const {
            type = 'error',
            title,
            message,
            details,
            duration = this.config.errorDisplayDuration,
            actions = [],
            dismissible = true
        } = errorConfig;
        
        // 创建错误元素
        const errorElement = document.createElement('div');
        errorElement.className = `error-message ${type}`;
        
        let actionsHtml = '';
        if (actions.length > 0) {
            actionsHtml = `
                <div class="error-actions">
                    ${actions.map((action, index) => 
                        `<button class="error-btn" data-action="${index}">${action.text}</button>`
                    ).join('')}
                </div>
            `;
        }
        
        errorElement.innerHTML = `
            ${dismissible ? '<button class="close-btn">&times;</button>' : ''}
            <div class="error-title">${title}</div>
            <div class="error-details">${message}</div>
            ${details ? `<div class="error-details" style="margin-top: 4px; font-size: 11px;">${details}</div>` : ''}
            ${actionsHtml}
        `;
        
        // 添加事件监听器
        if (dismissible) {
            const closeBtn = errorElement.querySelector('.close-btn');
            closeBtn.addEventListener('click', () => {
                this.removeError(errorElement);
            });
        }
        
        // 添加操作按钮事件
        actions.forEach((action, index) => {
            const btn = errorElement.querySelector(`[data-action="${index}"]`);
            if (btn) {
                btn.addEventListener('click', () => {
                    action.action();
                    if (action.dismissOnClick !== false) {
                        this.removeError(errorElement);
                    }
                });
            }
        });
        
        // 点击消息体关闭（如果可关闭）
        if (dismissible) {
            errorElement.addEventListener('click', (e) => {
                if (!e.target.closest('.error-btn, .close-btn')) {
                    this.removeError(errorElement);
                }
            });
        }
        
        // 添加到容器
        this.errorContainer.appendChild(errorElement);
        
        // 自动移除
        if (duration > 0) {
            setTimeout(() => {
                this.removeError(errorElement);
            }, duration);
        }
        
        // 更新统计
        this.errorStats.totalErrors++;
        if (type === 'error') {
            this.errorStats.networkErrors++;
        }
        
        return errorElement;
    }
    
    /**
     * 移除错误消息
     */
    removeError(errorElement) {
        if (errorElement && errorElement.parentNode) {
            errorElement.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => {
                if (errorElement.parentNode) {
                    errorElement.parentNode.removeChild(errorElement);
                }
            }, 300);
        }
    }
    
    /**
     * 处理网络错误
     */
    handleNetworkError(error, context = {}) {
        console.error('网络错误:', error, context);
        
        this.errorStats.networkErrors++;
        
        const errorConfig = {
            type: 'error',
            title: '网络错误',
            message: this.getNetworkErrorMessage(error),
            details: context.url ? `请求: ${context.url}` : undefined,
            actions: []
        };
        
        // 如果有重试上下文，添加重试按钮
        if (context.retry) {
            errorConfig.actions.push({
                text: '重试',
                action: () => this.retryRequest(context)
            });
        }
        
        // 如果离线，提供离线模式选项
        if (!this.isOnline) {
            errorConfig.actions.push({
                text: '离线模式',
                action: () => this.enableOfflineMode()
            });
        }
        
        this.showError(errorConfig);
        
        // 记录错误日志
        if (this.config.enableErrorLogging) {
            this.logError('network', error, context);
        }
    }
    
    /**
     * 处理API错误
     */
    handleApiError(error, response, context = {}) {
        console.error('API错误:', error, response, context);
        
        this.errorStats.apiErrors++;
        
        const errorConfig = {
            type: 'error',
            title: 'API错误',
            message: this.getApiErrorMessage(error, response),
            details: context.endpoint ? `接口: ${context.endpoint}` : undefined
        };
        
        // 根据错误类型添加特定操作
        if (response && response.status === 401) {
            errorConfig.actions = [{
                text: '重新登录',
                action: () => this.handleAuthError()
            }];
        } else if (response && response.status >= 500) {
            errorConfig.actions = [{
                text: '重试',
                action: () => this.retryRequest(context)
            }];
        }
        
        this.showError(errorConfig);
        
        // 记录错误日志
        if (this.config.enableErrorLogging) {
            this.logError('api', error, { response, ...context });
        }
    }
    
    /**
     * 处理游戏错误
     */
    handleGameError(error, context = {}) {
        console.error('游戏错误:', error, context);
        
        this.errorStats.gameErrors++;
        
        const errorConfig = {
            type: 'warning',
            title: '游戏错误',
            message: this.getGameErrorMessage(error),
            details: context.action ? `操作: ${context.action}` : undefined,
            actions: [{
                text: '继续游戏',
                action: () => this.recoverFromGameError(context)
            }]
        };
        
        this.showError(errorConfig);
        
        // 记录错误日志
        if (this.config.enableErrorLogging) {
            this.logError('game', error, context);
        }
    }
    
    /**
     * 处理JavaScript错误
     */
    handleJavaScriptError(error, filename, lineno) {
        console.error('JavaScript错误:', error, filename, lineno);
        
        const errorConfig = {
            type: 'error',
            title: 'JavaScript错误',
            message: error.message || '未知错误',
            details: filename ? `文件: ${filename}:${lineno}` : undefined,
            actions: [{
                text: '刷新页面',
                action: () => window.location.reload()
            }]
        };
        
        this.showError(errorConfig);
        
        // 记录错误日志
        if (this.config.enableErrorLogging) {
            this.logError('javascript', error, { filename, lineno });
        }
    }
    
    /**
     * 处理Promise拒绝
     */
    handlePromiseRejection(reason) {
        console.error('未处理的Promise拒绝:', reason);
        
        const errorConfig = {
            type: 'error',
            title: 'Promise错误',
            message: reason.message || '异步操作失败',
            details: reason.stack ? '查看控制台获取详细信息' : undefined
        };
        
        this.showError(errorConfig);
        
        // 记录错误日志
        if (this.config.enableErrorLogging) {
            this.logError('promise', reason);
        }
    }
    
    /**
     * 处理资源加载错误
     */
    handleResourceError(element) {
        console.error('资源加载错误:', element.src || element.href);
        
        const errorConfig = {
            type: 'warning',
            title: '资源加载失败',
            message: `无法加载 ${element.tagName.toLowerCase()}`,
            details: element.src || element.href,
            actions: [{
                text: '重新加载',
                action: () => this.reloadResource(element)
            }]
        };
        
        this.showError(errorConfig);
    }
    
    /**
     * 获取网络错误消息
     */
    getNetworkErrorMessage(error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return '网络连接失败，请检查网络设置';
        }
        if (error.name === 'AbortError') {
            return '请求超时，请稍后重试';
        }
        return error.message || '网络请求失败';
    }
    
    /**
     * 获取API错误消息
     */
    getApiErrorMessage(error, response) {
        if (response) {
            switch (response.status) {
                case 400:
                    return '请求参数错误';
                case 401:
                    return '身份验证失败，请重新登录';
                case 403:
                    return '权限不足';
                case 404:
                    return '请求的资源不存在';
                case 429:
                    return '请求过于频繁，请稍后重试';
                case 500:
                    return '服务器内部错误';
                case 502:
                    return '网关错误';
                case 503:
                    return '服务暂时不可用';
                default:
                    return `服务器错误 (${response.status})`;
            }
        }
        return error.message || 'API请求失败';
    }
    
    /**
     * 获取游戏错误消息
     */
    getGameErrorMessage(error) {
        if (error.message) {
            return error.message;
        }
        return '游戏运行出现问题，但可以继续';
    }
    
    /**
     * 重试请求
     */
    async retryRequest(context) {
        const retryKey = context.retryKey || `${context.method || 'GET'}_${context.url}`;
        
        if (!this.retryQueue.has(retryKey)) {
            this.retryQueue.set(retryKey, {
                attempts: 0,
                context: context
            });
        }
        
        const retryInfo = this.retryQueue.get(retryKey);
        
        if (retryInfo.attempts >= this.config.maxRetries) {
            this.showError({
                type: 'error',
                title: '重试失败',
                message: '已达到最大重试次数',
                duration: 3000
            });
            this.retryQueue.delete(retryKey);
            return;
        }
        
        retryInfo.attempts++;
        
        try {
            // 等待重试延迟
            await new Promise(resolve => 
                setTimeout(resolve, this.config.retryDelay * retryInfo.attempts)
            );
            
            // 执行重试
            if (context.retryFunction) {
                await context.retryFunction();
                this.retryQueue.delete(retryKey);
                this.errorStats.recoveredErrors++;
                
                this.showError({
                    type: 'success',
                    title: '重试成功',
                    message: '操作已成功完成',
                    duration: 2000
                });
            }
        } catch (error) {
            console.error('重试失败:', error);
            // 递归重试
            setTimeout(() => this.retryRequest(context), this.config.retryDelay);
        }
    }
    
    /**
     * 重试所有失败的请求
     */
    async retryFailedRequests() {
        const retryPromises = Array.from(this.retryQueue.entries()).map(
            ([key, retryInfo]) => this.retryRequest(retryInfo.context)
        );
        
        try {
            await Promise.allSettled(retryPromises);
        } catch (error) {
            console.error('批量重试失败:', error);
        }
    }
    
    /**
     * 启用离线模式
     */
    enableOfflineMode() {
        console.log('启用离线模式');
        
        this.showError({
            type: 'info',
            title: '离线模式已启用',
            message: '游戏将在本地运行，得分将在重新连接后同步',
            duration: 3000
        });
        
        // 触发离线模式事件
        this.dispatchEvent('offlineModeEnabled', { timestamp: Date.now() });
    }
    
    /**
     * 处理认证错误
     */
    handleAuthError() {
        console.log('处理认证错误');
        
        // 清除本地存储的认证信息
        localStorage.removeItem('user_id');
        localStorage.removeItem('username');
        
        // 重新生成用户
        if (window.gameManager && window.gameManager.createUser) {
            window.gameManager.createUser();
        }
        
        this.showError({
            type: 'info',
            title: '已重新生成用户',
            message: '请继续游戏',
            duration: 3000
        });
    }
    
    /**
     * 从游戏错误中恢复
     */
    recoverFromGameError(context) {
        console.log('从游戏错误中恢复:', context);
        
        // 根据上下文执行恢复操作
        if (context.recoverFunction) {
            try {
                context.recoverFunction();
                this.errorStats.recoveredErrors++;
            } catch (error) {
                console.error('恢复操作失败:', error);
            }
        }
    }
    
    /**
     * 重新加载资源
     */
    reloadResource(element) {
        const originalSrc = element.src || element.href;
        
        // 添加时间戳避免缓存
        const separator = originalSrc.includes('?') ? '&' : '?';
        const newSrc = `${originalSrc}${separator}_t=${Date.now()}`;
        
        if (element.src) {
            element.src = newSrc;
        } else if (element.href) {
            element.href = newSrc;
        }
    }
    
    /**
     * 记录错误日志
     */
    logError(type, error, context = {}) {
        const logEntry = {
            timestamp: Date.now(),
            type: type,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            context: context,
            userAgent: navigator.userAgent,
            url: window.location.href,
            isOnline: this.isOnline
        };
        
        // 存储到本地存储
        try {
            const logs = JSON.parse(localStorage.getItem('error_logs') || '[]');
            logs.push(logEntry);
            
            // 只保留最近100条日志
            if (logs.length > 100) {
                logs.splice(0, logs.length - 100);
            }
            
            localStorage.setItem('error_logs', JSON.stringify(logs));
        } catch (e) {
            console.error('无法保存错误日志:', e);
        }
        
        // 如果在线，尝试发送到服务器
        if (this.isOnline) {
            this.sendErrorLog(logEntry);
        }
    }
    
    /**
     * 发送错误日志到服务器
     */
    async sendErrorLog(logEntry) {
        try {
            await fetch('/api/errors/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(logEntry)
            });
        } catch (error) {
            console.error('发送错误日志失败:', error);
        }
    }
    
    /**
     * 获取错误统计
     */
    getErrorStats() {
        return {
            ...this.errorStats,
            uptime: Date.now() - this.errorStats.startTime,
            isOnline: this.isOnline,
            lastOnlineCheck: this.lastOnlineCheck,
            queuedRetries: this.retryQueue.size
        };
    }
    
    /**
     * 清除错误统计
     */
    clearErrorStats() {
        this.errorStats = {
            totalErrors: 0,
            networkErrors: 0,
            apiErrors: 0,
            gameErrors: 0,
            recoveredErrors: 0,
            startTime: Date.now()
        };
    }
    
    /**
     * 触发自定义事件
     */
    dispatchEvent(eventName, data) {
        const event = new CustomEvent(`errorHandler:${eventName}`, {
            detail: data
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 销毁错误处理器
     */
    destroy() {
        // 移除DOM元素
        if (this.errorContainer) {
            this.errorContainer.remove();
        }
        if (this.offlineIndicator) {
            this.offlineIndicator.remove();
        }
        if (this.connectionStatus) {
            this.connectionStatus.remove();
        }
        
        // 清除定时器和队列
        this.retryQueue.clear();
        this.errorQueue = [];
        
        console.log('错误处理器已销毁');
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
                console.error('事件监听器执行错误:', error);
            }
        });
    }
}

// 创建全局错误处理器实例
window.errorHandler = new ErrorHandler({
    maxRetries: 3,
    retryDelay: 2000,
    offlineCheckInterval: 10000,
    errorDisplayDuration: 5000,
    enableOfflineMode: true,
    enableErrorLogging: true
});

// 导出错误处理器类
window.ErrorHandler = ErrorHandler;

console.log('错误处理器模块加载完成');