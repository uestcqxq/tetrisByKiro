/**
 * 游戏启动管理器 - 协调游戏启动流程
 * 负责模块化加载、进度跟踪和错误处理
 */
class GameBootstrap {
    constructor(config = {}) {
        this.config = {
            maxStartupTime: 15000, // 15秒最大启动时间
            coreModuleTimeout: 3000, // 核心模块超时时间
            optionalModuleTimeout: 5000, // 可选模块超时时间
            retryAttempts: 3,
            enableFallbackMode: true,
            ...config
        };

        // 启动状态
        this.state = {
            stage: 'initializing',
            progress: 0.0,
            currentModule: null,
            loadedModules: new Set(),
            failedModules: new Set(),
            errors: [],
            startTime: Date.now(),
            isComplete: false,
            isFallbackMode: false
        };

        // 模块定义
        this.modules = {
            core: [
                { name: 'deviceDetector', loader: () => this.initializeDeviceDetector(), required: true },
                { name: 'renderer', loader: () => this.initializeRenderer(), required: true },
                { name: 'gameEngine', loader: () => this.initializeGameEngine(), required: true },
                { name: 'inputController', loader: () => this.initializeInputController(), required: true }
            ],
            optional: [
                { name: 'performanceOptimizer', loader: () => this.initializePerformanceOptimizer(), required: false },
                { name: 'audioSystem', loader: () => this.initializeAudioSystem(), required: false },
                { name: 'networkClient', loader: () => this.initializeNetworkClient(), required: false }
            ]
        };

        // 事件监听器
        this.eventListeners = new Map();

        // 启动计时器
        this.startupTimer = null;
    }

    /**
     * 开始游戏初始化
     */
    async initialize() {
        console.log('开始游戏初始化...');
        
        try {
            // 设置启动超时保护
            this.setupStartupTimeout();
            
            // 更新状态
            this.updateState('initializing', 0.05, '正在初始化...');
            
            // 基础初始化
            await this.basicInitialization();
            this.updateState('loading-core', 0.15, '加载核心模块...');
            
            // 加载核心模块
            await this.loadCoreModules();
            this.updateState('loading-optional', 0.60, '加载增强功能...');
            
            // 加载可选模块
            await this.loadOptionalModules();
            this.updateState('finalizing', 0.90, '完成初始化...');
            
            // 最终初始化
            await this.finalizeInitialization();
            this.updateState('complete', 1.0, '初始化完成');
            
            // 清除超时计时器
            if (this.startupTimer) {
                clearTimeout(this.startupTimer);
                this.startupTimer = null;
            }
            
            console.log('游戏初始化完成');
            this.emit('initializationComplete', this.state);
            
        } catch (error) {
            console.error('游戏初始化失败:', error);
            await this.handleInitializationError(error);
        }
    }

    /**
     * 基础初始化
     */
    async basicInitialization() {
        // 检查必要的DOM元素
        const gameCanvas = document.getElementById('game-canvas');
        const nextCanvas = document.getElementById('next-canvas');
        
        if (!gameCanvas || !nextCanvas) {
            throw new Error('缺少必要的Canvas元素');
        }

        // 初始化全局变量
        window.gameBootstrap = this;
        
        // 设置基础配置
        window.GAME_CONFIG = window.GAME_CONFIG || {
            BOARD_WIDTH: 10,
            BOARD_HEIGHT: 20,
            CELL_SIZE: 30,
            CANVAS_WIDTH: 300,
            CANVAS_HEIGHT: 600,
            NEXT_CANVAS_SIZE: 120
        };

        this.updateProgress(0.10);
    }

    /**
     * 加载核心模块
     */
    async loadCoreModules() {
        const coreModules = this.modules.core;
        const progressStep = 0.45 / coreModules.length; // 从15%到60%
        
        for (const module of coreModules) {
            try {
                this.state.currentModule = module.name;
                this.emit('moduleLoadStart', { module: module.name, type: 'core' });
                
                await this.loadModuleWithTimeout(module, this.config.coreModuleTimeout);
                
                this.state.loadedModules.add(module.name);
                this.updateProgress(this.state.progress + progressStep);
                this.emit('moduleLoadSuccess', { module: module.name, type: 'core' });
                
            } catch (error) {
                console.error(`核心模块 ${module.name} 加载失败:`, error);
                this.state.failedModules.add(module.name);
                this.state.errors.push({ module: module.name, error: error.message });
                
                if (module.required) {
                    throw new Error(`关键模块 ${module.name} 加载失败: ${error.message}`);
                }
            }
        }
    }

    /**
     * 加载可选模块
     */
    async loadOptionalModules() {
        const optionalModules = this.modules.optional;
        const progressStep = 0.30 / optionalModules.length; // 从60%到90%
        
        for (const module of optionalModules) {
            try {
                this.state.currentModule = module.name;
                this.emit('moduleLoadStart', { module: module.name, type: 'optional' });
                
                await this.loadModuleWithTimeout(module, this.config.optionalModuleTimeout);
                
                this.state.loadedModules.add(module.name);
                this.updateProgress(this.state.progress + progressStep);
                this.emit('moduleLoadSuccess', { module: module.name, type: 'optional' });
                
            } catch (error) {
                console.warn(`可选模块 ${module.name} 加载失败:`, error);
                this.state.failedModules.add(module.name);
                this.state.errors.push({ module: module.name, error: error.message, optional: true });
                
                // 可选模块失败不影响启动
                this.updateProgress(this.state.progress + progressStep);
                this.emit('moduleLoadFailed', { module: module.name, type: 'optional', error });
            }
        }
    }

    /**
     * 使用超时加载模块
     */
    async loadModuleWithTimeout(module, timeout) {
        return new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`模块 ${module.name} 加载超时`));
            }, timeout);

            try {
                await module.loader();
                clearTimeout(timer);
                resolve();
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    /**
     * 最终初始化
     */
    async finalizeInitialization() {
        // 验证核心系统
        if (!window.gameRenderer) {
            throw new Error('游戏渲染器未初始化');
        }

        // 隐藏加载界面
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }

        // 显示游戏界面
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.display = 'block';
        }

        this.state.isComplete = true;
        this.updateProgress(1.0);
    }

    /**
     * 初始化设备检测器
     */
    async initializeDeviceDetector() {
        if (window.DeviceDetector) {
            window.deviceDetector = new DeviceDetector();
            const detectionResult = await window.deviceDetector.initialize();
            
            // 应用检测到的配置
            if (detectionResult.config) {
                window.deviceDetector.applyConfigurationToGame(detectionResult.config);
            }
            
            console.log('设备检测器初始化完成:', detectionResult.performanceLevel);
            return detectionResult;
        } else {
            throw new Error('DeviceDetector类未找到');
        }
    }

    /**
     * 初始化渲染器
     */
    async initializeRenderer() {
        if (window.GameRenderer) {
            window.gameRenderer = new GameRenderer('game-canvas', 'next-canvas');
            console.log('游戏渲染器初始化完成');
        } else {
            throw new Error('GameRenderer类未找到');
        }
    }

    /**
     * 初始化游戏引擎
     */
    async initializeGameEngine() {
        // 简化的游戏引擎初始化
        if (window.TetrisGame) {
            // 延迟初始化，等待用户开始游戏
            console.log('游戏引擎准备就绪');
        } else {
            throw new Error('TetrisGame类未找到');
        }
    }

    /**
     * 初始化输入控制器
     */
    async initializeInputController() {
        if (window.InputController) {
            window.inputController = new InputController();
            console.log('输入控制器初始化完成');
        } else {
            console.warn('InputController类未找到，使用基础输入处理');
        }
    }

    /**
     * 初始化性能优化器
     */
    async initializePerformanceOptimizer() {
        if (window.PerformanceOptimizer) {
            window.performanceOptimizer = new window.PerformanceOptimizer();
            console.log('性能优化器初始化完成');
        } else {
            throw new Error('PerformanceOptimizer类未找到');
        }
    }

    /**
     * 初始化音频系统
     */
    async initializeAudioSystem() {
        // 简化的音频系统初始化
        console.log('音频系统初始化完成');
    }

    /**
     * 初始化网络客户端
     */
    async initializeNetworkClient() {
        if (window.wsClient) {
            try {
                await window.wsClient.connect();
                console.log('网络客户端连接成功');
            } catch (error) {
                console.warn('网络客户端连接失败，启用离线模式');
                throw error;
            }
        } else {
            throw new Error('WebSocket客户端未找到');
        }
    }

    /**
     * 设置启动超时保护
     */
    setupStartupTimeout() {
        this.startupTimer = setTimeout(() => {
            console.error('游戏启动超时');
            this.handleStartupTimeout();
        }, this.config.maxStartupTime);
    }

    /**
     * 处理启动超时
     */
    async handleStartupTimeout() {
        console.warn('启动超时，尝试启用降级模式');
        
        if (this.config.enableFallbackMode && !this.state.isFallbackMode) {
            await this.enableFallbackMode();
        } else {
            this.handleInitializationError(new Error('游戏启动超时'));
        }
    }

    /**
     * 启用降级模式
     */
    async enableFallbackMode() {
        console.log('启用降级模式');
        
        this.state.isFallbackMode = true;
        
        try {
            // 只加载最基本的功能
            await this.initializeRenderer();
            await this.initializeGameEngine();
            
            // 跳过可选模块
            this.updateState('complete', 1.0, '降级模式启动完成');
            
            // 显示降级模式提示
            this.showFallbackModeNotice();
            
            this.emit('fallbackModeEnabled', this.state);
            
        } catch (error) {
            console.error('降级模式启动也失败了:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * 显示降级模式通知
     */
    showFallbackModeNotice() {
        const notice = document.createElement('div');
        notice.className = 'fallback-mode-notice';
        notice.innerHTML = `
            <div class="notice-content">
                <h3>简化模式</h3>
                <p>游戏以简化模式运行，部分功能可能不可用</p>
                <button onclick="this.parentElement.parentElement.remove()">知道了</button>
            </div>
        `;
        notice.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ffa726;
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 300px;
        `;
        
        document.body.appendChild(notice);
        
        // 5秒后自动消失
        setTimeout(() => {
            if (notice.parentElement) {
                notice.remove();
            }
        }, 5000);
    }

    /**
     * 处理初始化错误
     */
    async handleInitializationError(error) {
        console.error('初始化错误:', error);
        
        this.state.stage = 'error';
        this.state.errors.push({ general: true, error: error.message });
        
        // 显示错误界面
        this.showErrorInterface(error);
        
        this.emit('initializationError', { error, state: this.state });
    }

    /**
     * 显示错误界面
     */
    showErrorInterface(error) {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            const totalTime = Date.now() - this.state.startTime;
            const timeoutMessage = totalTime > this.config.maxStartupTime ? 
                '启动时间过长，可能是网络或设备性能问题。' : '';
            
            loadingScreen.innerHTML = `
                <div class="error-content">
                    <h2>游戏启动失败</h2>
                    <p class="error-message">${error.message}</p>
                    ${timeoutMessage ? `<p class="timeout-message">${timeoutMessage}</p>` : ''}
                    <div class="error-actions">
                        <button onclick="window.location.reload()" class="btn btn-primary">重新加载</button>
                        <button onclick="gameBootstrap.tryFallbackMode()" class="btn btn-secondary">简化模式</button>
                        <button onclick="gameBootstrap.skipLoading()" class="btn btn-warning">跳过加载</button>
                    </div>
                    <div class="loading-stats">
                        <p>启动时间: ${Math.round(totalTime / 1000)}秒</p>
                        <p>已加载模块: ${this.state.loadedModules.size}</p>
                        <p>失败模块: ${this.state.failedModules.size}</p>
                    </div>
                    <details class="error-details">
                        <summary>技术详情</summary>
                        <pre>${JSON.stringify(this.state, null, 2)}</pre>
                    </details>
                </div>
            `;
            
            loadingScreen.style.display = 'flex';
            loadingScreen.style.opacity = '1';
        }
    }

    /**
     * 尝试降级模式（用户触发）
     */
    async tryFallbackMode() {
        if (!this.state.isFallbackMode) {
            await this.enableFallbackMode();
        }
    }

    /**
     * 跳过加载直接启动游戏（用户触发）
     */
    async skipLoading() {
        console.log('用户选择跳过加载');
        
        try {
            // 清除超时计时器
            if (this.startupTimer) {
                clearTimeout(this.startupTimer);
                this.startupTimer = null;
            }
            
            // 尝试最基本的初始化
            await this.basicInitialization();
            
            // 只初始化渲染器
            if (window.GameRenderer) {
                window.gameRenderer = new GameRenderer('game-canvas', 'next-canvas');
            }
            
            // 完成初始化
            await this.finalizeInitialization();
            
            this.updateState('complete', 1.0, '跳过加载完成');
            this.emit('initializationComplete', this.state);
            
            // 显示跳过加载的通知
            this.showSkipLoadingNotice();
            
        } catch (error) {
            console.error('跳过加载也失败了:', error);
            this.showCriticalError(error);
        }
    }

    /**
     * 显示跳过加载通知
     */
    showSkipLoadingNotice() {
        const notice = document.createElement('div');
        notice.className = 'skip-loading-notice';
        notice.innerHTML = `
            <div class="notice-content">
                <h3>基础模式</h3>
                <p>游戏以基础模式运行，某些功能可能不可用</p>
                <button onclick="this.parentElement.parentElement.remove()">知道了</button>
            </div>
        `;
        notice.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2196F3;
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 300px;
        `;
        
        document.body.appendChild(notice);
        
        // 5秒后自动消失
        setTimeout(() => {
            if (notice.parentElement) {
                notice.remove();
            }
        }, 5000);
    }

    /**
     * 显示严重错误
     */
    showCriticalError(error) {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.innerHTML = `
                <div class="critical-error">
                    <h2>无法启动游戏</h2>
                    <p>抱歉，游戏遇到了严重错误无法启动。</p>
                    <p class="error-details">${error.message}</p>
                    <div class="error-actions">
                        <button onclick="window.location.reload()" class="btn btn-primary">重新加载页面</button>
                        <button onclick="gameBootstrap.reportError()" class="btn btn-secondary">报告问题</button>
                    </div>
                </div>
            `;
            loadingScreen.style.display = 'flex';
            loadingScreen.style.opacity = '1';
        }
    }

    /**
     * 报告错误（用户触发）
     */
    reportError() {
        const errorReport = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            error: this.state.errors,
            stats: this.getStats(),
            url: window.location.href
        };
        
        // 复制错误报告到剪贴板
        if (navigator.clipboard) {
            navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
                .then(() => {
                    alert('错误报告已复制到剪贴板，您可以将其发送给开发者');
                })
                .catch(() => {
                    console.log('错误报告:', errorReport);
                    alert('请查看浏览器控制台获取错误报告');
                });
        } else {
            console.log('错误报告:', errorReport);
            alert('请查看浏览器控制台获取错误报告');
        }
    }

    /**
     * 更新启动状态
     */
    updateState(stage, progress, message) {
        this.state.stage = stage;
        this.state.progress = Math.min(progress, 1.0);
        
        this.updateLoadingUI(message);
        this.emit('stateUpdate', { stage, progress, message });
    }

    /**
     * 更新进度
     */
    updateProgress(progress) {
        this.state.progress = Math.min(progress, 1.0);
        this.updateLoadingProgressBar();
        this.emit('progressUpdate', { progress: this.state.progress });
    }

    /**
     * 更新加载界面
     */
    updateLoadingUI(message) {
        const loadingText = document.getElementById('loading-text');
        const loadingStage = document.getElementById('loading-stage');
        const loadingPercentage = document.getElementById('loading-percentage');
        
        if (loadingText && message) {
            loadingText.textContent = message;
        }
        
        if (loadingStage) {
            if (this.state.currentModule) {
                loadingStage.textContent = `正在加载: ${this.getModuleDisplayName(this.state.currentModule)}`;
            } else {
                loadingStage.textContent = this.getStageDisplayName(this.state.stage);
            }
        }
        
        if (loadingPercentage) {
            loadingPercentage.textContent = `${Math.round(this.state.progress * 100)}%`;
        }
        
        this.updateLoadingProgressBar();
        this.updateLoadingTips();
    }

    /**
     * 更新进度条
     */
    updateLoadingProgressBar() {
        const progressBar = document.getElementById('loading-progress');
        if (progressBar) {
            progressBar.style.width = `${this.state.progress * 100}%`;
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
     * 获取模块显示名称
     */
    getModuleDisplayName(moduleName) {
        const displayNames = {
            'deviceDetector': '设备性能检测',
            'renderer': '游戏渲染器',
            'gameEngine': '游戏引擎',
            'inputController': '输入控制器',
            'performanceOptimizer': '性能优化器',
            'audioSystem': '音效系统',
            'networkClient': '网络连接'
        };
        return displayNames[moduleName] || moduleName;
    }

    /**
     * 获取阶段显示名称
     */
    getStageDisplayName(stage) {
        const stageNames = {
            'initializing': '正在初始化...',
            'loading-core': '加载核心组件...',
            'loading-optional': '加载增强功能...',
            'finalizing': '完成初始化...',
            'complete': '初始化完成',
            'error': '初始化失败'
        };
        return stageNames[stage] || stage;
    }

    /**
     * 更新加载提示
     */
    updateLoadingTips() {
        const loadingTip = document.getElementById('loading-tip');
        if (!loadingTip) return;

        const tips = [
            '提示: 使用方向键控制方块移动',
            '提示: 按空格键快速下落方块',
            '提示: 按P键暂停或继续游戏',
            '提示: 消除多行可获得更高分数',
            '提示: 游戏支持触摸控制',
            '提示: 级别越高，方块下落越快'
        ];

        // 根据加载进度显示不同的提示
        const tipIndex = Math.floor(this.state.progress * tips.length);
        const currentTip = tips[Math.min(tipIndex, tips.length - 1)];
        
        if (loadingTip.textContent !== currentTip) {
            loadingTip.style.opacity = '0';
            setTimeout(() => {
                loadingTip.textContent = currentTip;
                loadingTip.style.opacity = '1';
            }, 200);
        }
    }

    /**
     * 获取启动统计信息
     */
    getStats() {
        return {
            ...this.state,
            totalTime: Date.now() - this.state.startTime,
            loadedModulesCount: this.state.loadedModules.size,
            failedModulesCount: this.state.failedModules.size,
            successRate: this.state.loadedModules.size / (this.state.loadedModules.size + this.state.failedModules.size)
        };
    }
}

// 导出类
window.GameBootstrap = GameBootstrap;

console.log('游戏启动管理器加载完成');