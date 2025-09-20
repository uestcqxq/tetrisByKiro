/**
 * 错误恢复系统 - 统一的错误处理和恢复机制
 * 提供用户友好的错误提示和自动恢复策略
 */
class ErrorRecoverySystem {
    constructor(config = {}) {
        this.config = {
            maxRetryAttempts: 3,
            retryDelay: 1000,
            enableAutoRecovery: true,
            enableUserNotification: true,
            enableErrorReporting: false,
            fallbackMode: true,
            ...config
        };

        // 错误统计
        this.errorStats = {
            total: 0,
            recovered: 0,
            failed: 0,
            byType: new Map(),
            byModule: new Map()
        };

        // 恢复策略
        this.recoveryStrategies = new Map();
        
        // 错误历史
        this.errorHistory = [];
        this.maxHistorySize = 50;

        // 当前恢复状态
        this.isRecovering = false;
        this.currentRecoveryAttempt = 0;

        // 事件监听器
        this.listeners = {
            error: [],
            recovery: [],
            fallback: []
        };

        this.initializeRecoveryStrategies();
        console.log('错误恢复系统初始化完成');
    }

    /**
     * 初始化恢复策略
     */
    initializeRecoveryStrategies() {
        // 网络错误恢复策略
        this.registerRecoveryStrategy('NetworkError', {
            canRecover: (error) => error.name === 'NetworkError' || error.message.includes('网络'),
            recover: async (error, context) => {
                console.log('尝试网络错误恢复...');
                
                // 检查网络连接
                if (navigator.onLine) {
                    // 重试网络请求
                    if (context.retry && typeof context.retry === 'function') {
                        return await context.retry();
                    }
                } else {
                    // 启用离线模式
                    this.enableOfflineMode();
                    throw new Error('网络不可用，已切换到离线模式');
                }
            }
        });

        // 模块加载错误恢复策略
        this.registerRecoveryStrategy('ModuleLoadError', {
            canRecover: (error) => error.message.includes('模块') || error.message.includes('加载'),
            recover: async (error, context) => {
                console.log('尝试模块加载错误恢复...');
                
                if (context.moduleName && context.fallbackModule) {
                    // 尝试加载备用模块
                    console.log(`尝试加载备用模块: ${context.fallbackModule}`);
                    return await this.loadFallbackModule(context.moduleName, context.fallbackModule);
                } else if (context.isOptional) {
                    // 跳过可选模块
                    console.log('跳过可选模块加载');
                    return null;
                } else {
                    // 启用降级模式
                    this.enableFallbackMode();
                    throw new Error('关键模块加载失败，已启用降级模式');
                }
            }
        });

        // 游戏初始化错误恢复策略
        this.registerRecoveryStrategy('GameInitError', {
            canRecover: (error) => error.message.includes('游戏') || error.message.includes('初始化'),
            recover: async (error, context) => {
                console.log('尝试游戏初始化错误恢复...');
                
                // 重置游戏状态
                this.resetGameState();
                
                // 尝试简化初始化
                if (context.simplifiedInit && typeof context.simplifiedInit === 'function') {
                    return await context.simplifiedInit();
                } else {
                    // 启用基础模式
                    this.enableBasicMode();
                    throw new Error('游戏初始化失败，已启用基础模式');
                }
            }
        });

        // 资源加载错误恢复策略
        this.registerRecoveryStrategy('ResourceError', {
            canRecover: (error) => error.message.includes('资源') || error.message.includes('加载'),
            recover: async (error, context) => {
                console.log('尝试资源加载错误恢复...');
                
                if (context.fallbackResource) {
                    // 尝试加载备用资源
                    console.log(`尝试加载备用资源: ${context.fallbackResource}`);
                    return await this.loadFallbackResource(context.resource, context.fallbackResource);
                } else {
                    // 跳过资源加载
                    console.log('跳过资源加载，使用默认资源');
                    return this.getDefaultResource(context.resourceType);
                }
            }
        });
    }

    /**
     * 注册恢复策略
     */
    registerRecoveryStrategy(errorType, strategy) {
        this.recoveryStrategies.set(errorType, strategy);
    }

    /**
     * 处理错误并尝试恢复
     */
    async handleError(error, context = {}) {
        try {
            console.error('错误恢复系统处理错误:', error);
            
            // 记录错误
            this.recordError(error, context);
            
            // 检查是否可以恢复
            if (!this.config.enableAutoRecovery || this.isRecovering) {
                throw error;
            }

            // 查找合适的恢复策略
            const strategy = this.findRecoveryStrategy(error);
            
            if (strategy) {
                return await this.attemptRecovery(error, context, strategy);
            } else {
                // 没有找到恢复策略，显示用户友好的错误信息
                this.showUserFriendlyError(error, context);
                throw error;
            }

        } catch (recoveryError) {
            console.error('错误恢复失败:', recoveryError);
            this.errorStats.failed++;
            
            // 显示最终错误信息
            this.showFinalError(error, recoveryError, context);
            throw recoveryError;
        }
    }

    /**
     * 查找恢复策略
     */
    findRecoveryStrategy(error) {
        for (const [type, strategy] of this.recoveryStrategies) {
            if (strategy.canRecover(error)) {
                return strategy;
            }
        }
        return null;
    }

    /**
     * 尝试恢复
     */
    async attemptRecovery(error, context, strategy) {
        this.isRecovering = true;
        this.currentRecoveryAttempt = 0;

        try {
            while (this.currentRecoveryAttempt < this.config.maxRetryAttempts) {
                this.currentRecoveryAttempt++;
                
                console.log(`恢复尝试 ${this.currentRecoveryAttempt}/${this.config.maxRetryAttempts}`);
                
                try {
                    // 显示恢复进度
                    this.showRecoveryProgress(this.currentRecoveryAttempt, this.config.maxRetryAttempts);
                    
                    // 执行恢复策略
                    const result = await strategy.recover(error, context);
                    
                    // 恢复成功
                    this.errorStats.recovered++;
                    this.hideRecoveryProgress();
                    this.showRecoverySuccess();
                    
                    console.log('错误恢复成功');
                    this.emit('recovery', { error, result, attempts: this.currentRecoveryAttempt });
                    
                    return result;

                } catch (recoveryError) {
                    console.warn(`恢复尝试 ${this.currentRecoveryAttempt} 失败:`, recoveryError);
                    
                    if (this.currentRecoveryAttempt < this.config.maxRetryAttempts) {
                        // 等待后重试
                        await this.delay(this.config.retryDelay * this.currentRecoveryAttempt);
                    } else {
                        // 所有尝试都失败了
                        throw recoveryError;
                    }
                }
            }

        } finally {
            this.isRecovering = false;
            this.hideRecoveryProgress();
        }
    }

    /**
     * 记录错误
     */
    recordError(error, context) {
        const errorRecord = {
            timestamp: Date.now(),
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            context,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        this.errorHistory.push(errorRecord);
        
        // 限制历史记录大小
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }

        // 更新统计信息
        this.errorStats.total++;
        
        const errorType = error.name || 'Unknown';
        this.errorStats.byType.set(errorType, (this.errorStats.byType.get(errorType) || 0) + 1);
        
        if (context.module) {
            this.errorStats.byModule.set(context.module, (this.errorStats.byModule.get(context.module) || 0) + 1);
        }

        this.emit('error', errorRecord);
    }

    /**
     * 显示用户友好的错误信息
     */
    showUserFriendlyError(error, context) {
        if (!this.config.enableUserNotification) return;

        const errorMessage = this.getUserFriendlyMessage(error, context);
        const errorUI = this.createErrorUI(errorMessage, error, context);
        
        document.body.appendChild(errorUI);
    }

    /**
     * 获取用户友好的错误信息
     */
    getUserFriendlyMessage(error, context) {
        if (error.message.includes('网络') || error.message.includes('Network')) {
            return '网络连接出现问题，请检查您的网络连接后重试。';
        } else if (error.message.includes('模块') || error.message.includes('加载')) {
            return '游戏组件加载失败，可能是网络问题或浏览器兼容性问题。';
        } else if (error.message.includes('游戏') || error.message.includes('初始化')) {
            return '游戏初始化失败，可能是浏览器不支持某些功能。';
        } else if (error.message.includes('超时')) {
            return '操作超时，请检查网络连接或稍后重试。';
        } else {
            return '游戏遇到了一个意外错误，请尝试刷新页面。';
        }
    }

    /**
     * 创建错误UI
     */
    createErrorUI(message, error, context) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-recovery-ui';
        errorDiv.innerHTML = `
            <div class="error-overlay">
                <div class="error-dialog">
                    <div class="error-icon">⚠️</div>
                    <h3>出现了一个问题</h3>
                    <p class="error-message">${message}</p>
                    <div class="error-actions">
                        <button class="btn btn-primary" onclick="this.closest('.error-recovery-ui').remove(); location.reload()">
                            刷新页面
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('.error-recovery-ui').remove()">
                            继续使用
                        </button>
                        <button class="btn btn-link" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                            技术详情
                        </button>
                    </div>
                    <div class="error-details" style="display: none;">
                        <h4>错误详情</h4>
                        <pre>${error.message}</pre>
                        <p><small>时间: ${new Date().toLocaleString()}</small></p>
                    </div>
                </div>
            </div>
        `;

        // 添加样式
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
        `;

        return errorDiv;
    }

    /**
     * 显示恢复进度
     */
    showRecoveryProgress(attempt, maxAttempts) {
        if (!this.config.enableUserNotification) return;

        let progressDiv = document.getElementById('recovery-progress');
        if (!progressDiv) {
            progressDiv = document.createElement('div');
            progressDiv.id = 'recovery-progress';
            progressDiv.innerHTML = `
                <div class="recovery-overlay">
                    <div class="recovery-dialog">
                        <div class="recovery-spinner"></div>
                        <h3>正在尝试恢复...</h3>
                        <p class="recovery-message">尝试 ${attempt}/${maxAttempts}</p>
                        <div class="recovery-progress-bar">
                            <div class="progress-fill" style="width: ${(attempt / maxAttempts) * 100}%"></div>
                        </div>
                    </div>
                </div>
            `;
            
            progressDiv.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10001;
                font-family: Arial, sans-serif;
                color: white;
            `;
            
            document.body.appendChild(progressDiv);
        } else {
            // 更新进度
            const message = progressDiv.querySelector('.recovery-message');
            const progressFill = progressDiv.querySelector('.progress-fill');
            
            if (message) message.textContent = `尝试 ${attempt}/${maxAttempts}`;
            if (progressFill) progressFill.style.width = `${(attempt / maxAttempts) * 100}%`;
        }
    }

    /**
     * 隐藏恢复进度
     */
    hideRecoveryProgress() {
        const progressDiv = document.getElementById('recovery-progress');
        if (progressDiv) {
            progressDiv.remove();
        }
    }

    /**
     * 显示恢复成功信息
     */
    showRecoverySuccess() {
        if (!this.config.enableUserNotification) return;

        const successDiv = document.createElement('div');
        successDiv.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #28a745;
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                z-index: 10002;
                font-family: Arial, sans-serif;
            ">
                ✅ 问题已解决，游戏继续运行
            </div>
        `;
        
        document.body.appendChild(successDiv);
        
        // 3秒后自动消失
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    /**
     * 显示最终错误
     */
    showFinalError(originalError, recoveryError, context) {
        if (!this.config.enableUserNotification) return;

        const finalErrorDiv = document.createElement('div');
        finalErrorDiv.innerHTML = `
            <div class="final-error-overlay">
                <div class="final-error-dialog">
                    <div class="error-icon">❌</div>
                    <h3>无法恢复</h3>
                    <p>很抱歉，我们无法自动解决这个问题。</p>
                    <div class="error-actions">
                        <button class="btn btn-primary" onclick="location.reload()">
                            重新加载页面
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('div').remove()">
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        finalErrorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10003;
            font-family: Arial, sans-serif;
            color: white;
        `;
        
        document.body.appendChild(finalErrorDiv);
    }

    /**
     * 辅助方法
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    enableOfflineMode() {
        console.log('启用离线模式');
        // 实现离线模式逻辑
    }

    enableFallbackMode() {
        console.log('启用降级模式');
        // 实现降级模式逻辑
    }

    enableBasicMode() {
        console.log('启用基础模式');
        // 实现基础模式逻辑
    }

    resetGameState() {
        console.log('重置游戏状态');
        // 实现游戏状态重置逻辑
    }

    async loadFallbackModule(moduleName, fallbackModule) {
        console.log(`加载备用模块: ${moduleName} -> ${fallbackModule}`);
        // 实现备用模块加载逻辑
        return null;
    }

    async loadFallbackResource(resource, fallbackResource) {
        console.log(`加载备用资源: ${resource} -> ${fallbackResource}`);
        // 实现备用资源加载逻辑
        return null;
    }

    getDefaultResource(resourceType) {
        console.log(`获取默认资源: ${resourceType}`);
        // 实现默认资源获取逻辑
        return null;
    }

    /**
     * 事件系统
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`错误恢复系统事件处理错误 (${event}):`, error);
                }
            });
        }
    }

    /**
     * 获取错误统计信息
     */
    getStats() {
        return {
            ...this.errorStats,
            successRate: this.errorStats.total > 0 ? (this.errorStats.recovered / this.errorStats.total) * 100 : 0,
            recentErrors: this.errorHistory.slice(-10)
        };
    }
}

// 导出错误恢复系统
window.ErrorRecoverySystem = ErrorRecoverySystem;
console.log('错误恢复系统模块加载完成');