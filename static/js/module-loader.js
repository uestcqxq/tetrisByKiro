/**
 * ModuleLoader - 模块加载器系统
 * 负责管理各个游戏模块的加载，包括依赖管理、超时控制和加载顺序
 */
class ModuleLoader {
    constructor(options = {}) {
        this.options = {
            timeout: options.timeout || 10000, // 10秒超时
            retryAttempts: options.retryAttempts || 3,
            retryDelay: options.retryDelay || 1000,
            debugMode: options.debugMode || false,
            ...options
        };

        // 模块状态
        this.modules = new Map();
        this.loadingPromises = new Map();
        this.loadOrder = [];
        this.loadedModules = new Set();
        this.failedModules = new Set();
        
        // 事件监听器
        this.listeners = {
            moduleLoaded: [],
            moduleFailed: [],
            allLoaded: [],
            loadProgress: []
        };

        // 定义模块依赖关系
        this.defineModuleDependencies();
    }

    /**
     * 定义模块依赖关系和加载顺序
     */
    defineModuleDependencies() {
        // 核心模块（必须成功加载）
        this.registerModule('ErrorHandler', {
            required: true,
            priority: 1,
            dependencies: [],
            factory: () => {
                if (typeof window.ErrorHandler === 'undefined') {
                    throw new Error('ErrorHandler类未定义');
                }
                return window.ErrorHandler;
            }
        });

        this.registerModule('ErrorRecoverySystem', {
            required: true,
            priority: 2,
            dependencies: ['ErrorHandler'],
            factory: () => {
                if (typeof window.ErrorRecoverySystem === 'undefined') {
                    throw new Error('ErrorRecoverySystem类未定义');
                }
                return window.ErrorRecoverySystem;
            }
        });

        this.registerModule('DeviceDetector', {
            required: true,
            priority: 3,
            dependencies: [],
            factory: () => {
                if (typeof window.DeviceDetector === 'undefined') {
                    throw new Error('DeviceDetector类未定义');
                }
                return window.DeviceDetector;
            }
        });

        this.registerModule('NetworkManager', {
            required: true,
            priority: 4,
            dependencies: [],
            factory: () => {
                if (typeof window.NetworkManager === 'undefined') {
                    throw new Error('NetworkManager类未定义');
                }
                return window.NetworkManager;
            }
        });

        // API和通信模块
        this.registerModule('APIClient', {
            required: true,
            priority: 5,
            dependencies: ['ErrorHandler', 'NetworkManager'],
            factory: () => {
                if (typeof window.APIClient === 'undefined') {
                    throw new Error('APIClient类未定义');
                }
                return window.APIClient;
            }
        });

        this.registerModule('WebSocketClient', {
            required: false,
            priority: 6,
            dependencies: ['ErrorHandler', 'NetworkManager'],
            factory: () => {
                if (typeof window.WebSocketClient === 'undefined') {
                    console.warn('WebSocketClient类未定义，跳过加载');
                    return null;
                }
                return window.WebSocketClient;
            }
        });

        // 存储和资源管理
        this.registerModule('OfflineStorage', {
            required: false,
            priority: 7,
            dependencies: ['ErrorHandler'],
            factory: () => {
                if (typeof window.OfflineStorage === 'undefined') {
                    console.warn('OfflineStorage类未定义，跳过加载');
                    return null;
                }
                return window.OfflineStorage;
            }
        });

        this.registerModule('ResourceManager', {
            required: false,
            priority: 8,
            dependencies: ['ErrorHandler', 'NetworkManager'],
            factory: () => {
                if (typeof window.ResourceManager === 'undefined') {
                    console.warn('ResourceManager类未定义，跳过加载');
                    return null;
                }
                return window.ResourceManager;
            }
        });

        // 性能和优化模块
        this.registerModule('PerformanceOptimizer', {
            required: false,
            priority: 9,
            dependencies: ['DeviceDetector'],
            factory: () => {
                if (typeof window.PerformanceOptimizer === 'undefined') {
                    console.warn('PerformanceOptimizer类未定义，跳过加载');
                    return null;
                }
                return window.PerformanceOptimizer;
            }
        });

        // 输入和控制模块
        this.registerModule('InputController', {
            required: true,
            priority: 10,
            dependencies: ['ErrorHandler'],
            factory: () => {
                if (typeof window.InputController === 'undefined') {
                    throw new Error('InputController类未定义');
                }
                return window.InputController;
            }
        });

        this.registerModule('MobileTouchHandler', {
            required: false,
            priority: 11,
            dependencies: ['DeviceDetector', 'InputController'],
            factory: () => {
                if (typeof window.MobileTouchHandler === 'undefined') {
                    console.warn('MobileTouchHandler类未定义，跳过加载');
                    return null;
                }
                return window.MobileTouchHandler;
            }
        });

        // 游戏核心模块
        this.registerModule('TetrominoManager', {
            required: true,
            priority: 12,
            dependencies: ['ErrorHandler'],
            factory: () => {
                if (typeof window.TetrominoManager === 'undefined') {
                    throw new Error('TetrominoManager类未定义');
                }
                return window.TetrominoManager;
            }
        });

        this.registerModule('BoardManager', {
            required: true,
            priority: 13,
            dependencies: ['ErrorHandler'],
            factory: () => {
                if (typeof window.BoardManager === 'undefined') {
                    throw new Error('BoardManager类未定义');
                }
                return window.BoardManager;
            }
        });

        this.registerModule('ScoringSystem', {
            required: true,
            priority: 14,
            dependencies: ['ErrorHandler'],
            factory: () => {
                if (typeof window.ScoringSystem === 'undefined') {
                    throw new Error('ScoringSystem类未定义');
                }
                return window.ScoringSystem;
            }
        });

        this.registerModule('DifficultyManager', {
            required: true,
            priority: 15,
            dependencies: ['ErrorHandler'],
            factory: () => {
                if (typeof window.DifficultyManager === 'undefined') {
                    throw new Error('DifficultyManager类未定义');
                }
                return window.DifficultyManager;
            }
        });

        // UI和游戏主类
        this.registerModule('UIManager', {
            required: true,
            priority: 16,
            dependencies: ['ErrorHandler', 'APIClient'],
            factory: () => {
                if (typeof window.UIManager === 'undefined') {
                    throw new Error('UIManager类未定义');
                }
                return window.UIManager;
            }
        });

        this.registerModule('TetrisGame', {
            required: true,
            priority: 17,
            dependencies: ['BoardManager', 'TetrominoManager', 'ScoringSystem', 'DifficultyManager', 'UIManager'],
            factory: () => {
                if (typeof window.TetrisGame === 'undefined') {
                    throw new Error('TetrisGame类未定义');
                }
                return window.TetrisGame;
            }
        });
    }

    /**
     * 注册模块
     */
    registerModule(name, config) {
        this.modules.set(name, {
            name,
            required: config.required || false,
            priority: config.priority || 999,
            dependencies: config.dependencies || [],
            factory: config.factory,
            loaded: false,
            failed: false,
            instance: null,
            loadTime: null
        });
    }

    /**
     * 加载所有模块
     */
    async loadAllModules() {
        try {
            this.log('开始加载所有模块...');
            
            // 按优先级排序模块
            this.loadOrder = Array.from(this.modules.values())
                .sort((a, b) => a.priority - b.priority);

            const totalModules = this.loadOrder.length;
            let loadedCount = 0;

            // 逐个加载模块
            for (const moduleConfig of this.loadOrder) {
                try {
                    await this.loadModule(moduleConfig.name);
                    loadedCount++;
                    this.emitProgress(loadedCount, totalModules);
                } catch (error) {
                    this.log(`模块 ${moduleConfig.name} 加载失败:`, error);
                    
                    if (moduleConfig.required) {
                        throw new Error(`必需模块 ${moduleConfig.name} 加载失败: ${error.message}`);
                    }
                }
            }

            this.log(`模块加载完成，成功: ${this.loadedModules.size}, 失败: ${this.failedModules.size}`);
            this.emit('allLoaded', {
                loaded: Array.from(this.loadedModules),
                failed: Array.from(this.failedModules)
            });

            return {
                success: true,
                loaded: Array.from(this.loadedModules),
                failed: Array.from(this.failedModules)
            };

        } catch (error) {
            this.log('模块加载过程失败:', error);
            throw error;
        }
    }

    /**
     * 加载单个模块
     */
    async loadModule(moduleName) {
        const moduleConfig = this.modules.get(moduleName);
        if (!moduleConfig) {
            throw new Error(`未知模块: ${moduleName}`);
        }

        // 如果已经在加载中，返回现有的Promise
        if (this.loadingPromises.has(moduleName)) {
            return this.loadingPromises.get(moduleName);
        }

        // 如果已经加载成功，直接返回
        if (moduleConfig.loaded) {
            return moduleConfig.instance;
        }

        // 创建加载Promise
        const loadPromise = this.doLoadModule(moduleConfig);
        this.loadingPromises.set(moduleName, loadPromise);

        try {
            const result = await loadPromise;
            this.loadingPromises.delete(moduleName);
            return result;
        } catch (error) {
            this.loadingPromises.delete(moduleName);
            throw error;
        }
    }

    /**
     * 执行模块加载
     */
    async doLoadModule(moduleConfig) {
        const startTime = performance.now();
        
        try {
            this.log(`开始加载模块: ${moduleConfig.name}`);

            // 检查依赖
            await this.loadDependencies(moduleConfig);

            // 使用超时保护加载模块
            const instance = await this.loadWithTimeout(moduleConfig);

            // 标记为已加载
            moduleConfig.loaded = true;
            moduleConfig.instance = instance;
            moduleConfig.loadTime = performance.now() - startTime;
            
            this.loadedModules.add(moduleConfig.name);
            this.log(`模块 ${moduleConfig.name} 加载成功，耗时: ${moduleConfig.loadTime.toFixed(2)}ms`);
            
            this.emit('moduleLoaded', {
                name: moduleConfig.name,
                instance,
                loadTime: moduleConfig.loadTime
            });

            return instance;

        } catch (error) {
            moduleConfig.failed = true;
            this.failedModules.add(moduleConfig.name);
            
            this.log(`模块 ${moduleConfig.name} 加载失败:`, error);
            this.emit('moduleFailed', {
                name: moduleConfig.name,
                error,
                loadTime: performance.now() - startTime
            });

            throw error;
        }
    }

    /**
     * 加载模块依赖
     */
    async loadDependencies(moduleConfig) {
        if (!moduleConfig.dependencies || moduleConfig.dependencies.length === 0) {
            return;
        }

        this.log(`加载 ${moduleConfig.name} 的依赖:`, moduleConfig.dependencies);

        const dependencyPromises = moduleConfig.dependencies.map(depName => {
            return this.loadModule(depName);
        });

        await Promise.all(dependencyPromises);
    }

    /**
     * 带超时的模块加载
     */
    async loadWithTimeout(moduleConfig) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`模块 ${moduleConfig.name} 加载超时`));
            }, this.options.timeout);

            try {
                // 尝试获取模块实例
                const instance = moduleConfig.factory();
                
                if (instance) {
                    clearTimeout(timeout);
                    resolve(instance);
                } else {
                    clearTimeout(timeout);
                    reject(new Error(`模块 ${moduleConfig.name} 工厂函数返回空值`));
                }
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    /**
     * 获取已加载的模块实例
     */
    getModule(moduleName) {
        const moduleConfig = this.modules.get(moduleName);
        return moduleConfig?.instance || null;
    }

    /**
     * 检查模块是否已加载
     */
    isModuleLoaded(moduleName) {
        return this.loadedModules.has(moduleName);
    }

    /**
     * 获取加载统计信息
     */
    getLoadStats() {
        const totalModules = this.modules.size;
        const loadedCount = this.loadedModules.size;
        const failedCount = this.failedModules.size;
        const loadingCount = this.loadingPromises.size;

        return {
            total: totalModules,
            loaded: loadedCount,
            failed: failedCount,
            loading: loadingCount,
            progress: totalModules > 0 ? (loadedCount / totalModules) * 100 : 0
        };
    }

    /**
     * 事件监听
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * 触发事件
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.log(`事件监听器错误 (${event}):`, error);
                }
            });
        }
    }

    /**
     * 触发进度事件
     */
    emitProgress(loaded, total) {
        const progress = (loaded / total) * 100;
        this.emit('loadProgress', {
            loaded,
            total,
            progress,
            remaining: total - loaded
        });
    }

    /**
     * 日志输出
     */
    log(...args) {
        if (this.options.debugMode) {
            console.log('[ModuleLoader]', ...args);
        }
    }

    /**
     * 重置加载器状态
     */
    reset() {
        this.loadingPromises.clear();
        this.loadedModules.clear();
        this.failedModules.clear();
        
        // 重置模块状态
        for (const moduleConfig of this.modules.values()) {
            moduleConfig.loaded = false;
            moduleConfig.failed = false;
            moduleConfig.instance = null;
            moduleConfig.loadTime = null;
        }
    }
}

// 导出模块加载器
window.ModuleLoader = ModuleLoader;
console.log('ModuleLoader 模块加载完成');