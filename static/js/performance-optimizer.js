/**
 * 性能优化器 - 游戏性能监控和优化
 * 负责Canvas渲染优化、内存管理和性能监控
 */
class PerformanceOptimizer {
    constructor(config = {}) {
        this.config = {
            targetFPS: 60,
            maxFrameTime: 16.67, // 60 FPS = 16.67ms per frame
            memoryCheckInterval: 5000,
            performanceLogInterval: 10000,
            enableVSync: true,
            enableOffscreenCanvas: true,
            enableImageSmoothing: false,
            maxAnimations: 10,
            ...config
        };

        // 性能监控数据
        this.metrics = {
            frameCount: 0,
            lastFrameTime: 0,
            frameTimeHistory: [],
            averageFPS: 60,
            memoryUsage: 0,
            renderTime: 0,
            updateTime: 0,
            totalGameTime: 0
        };

        // 渲染优化
        this.renderOptimizations = {
            dirtyRegions: new Set(),
            lastRenderState: null,
            offscreenCanvas: null,
            offscreenCtx: null,
            imageCache: new Map(),
            pathCache: new Map()
        };

        // 动画管理
        this.animationManager = {
            activeAnimations: new Map(),
            animationPool: [],
            maxPoolSize: 20
        };

        // 内存管理
        this.memoryManager = {
            objectPool: new Map(),
            gcThreshold: 50 * 1024 * 1024, // 50MB
            lastGCTime: 0
        };

        this.initialize();
    }

    /**
     * 初始化性能优化器
     */
    initialize() {
        this.setupPerformanceMonitoring();
        this.setupMemoryManagement();
        this.setupRenderOptimizations();
        this.startPerformanceLoop();
        
        console.log('性能优化器已初始化');
    }

    /**
     * 设置性能监控
     */
    setupPerformanceMonitoring() {
        // 监控帧率
        this.frameTimeHistory = new Array(60).fill(16.67);
        
        // 监控内存使用
        if (performance.memory) {
            setInterval(() => {
                this.updateMemoryMetrics();
            }, this.config.memoryCheckInterval);
        }

        // 性能日志
        setInterval(() => {
            this.logPerformanceMetrics();
        }, this.config.performanceLogInterval);
    }

    /**
     * 设置内存管理
     */
    setupMemoryManagement() {
        // 创建对象池
        this.createObjectPools();
        
        // 监听内存压力事件
        if ('memory' in performance) {
            this.monitorMemoryPressure();
        }
    }

    /**
     * 设置渲染优化
     */
    setupRenderOptimizations() {
        // 创建离屏Canvas（如果支持）
        if (this.config.enableOffscreenCanvas && 'OffscreenCanvas' in window) {
            this.createOffscreenCanvas();
        }

        // 预加载和缓存图像
        this.preloadAssets();
    }

    /**
     * 开始性能监控循环
     */
    startPerformanceLoop() {
        let lastTime = performance.now();
        
        const performanceLoop = (currentTime) => {
            const deltaTime = currentTime - lastTime;
            
            // 更新性能指标
            this.updatePerformanceMetrics(deltaTime);
            
            // 检查性能问题
            this.checkPerformanceIssues(deltaTime);
            
            lastTime = currentTime;
            requestAnimationFrame(performanceLoop);
        };
        
        requestAnimationFrame(performanceLoop);
    }

    /**
     * 优化Canvas渲染
     */
    optimizeCanvasRendering(canvas, ctx) {
        // 禁用图像平滑以提高性能
        if (!this.config.enableImageSmoothing) {
            ctx.imageSmoothingEnabled = false;
        }

        // 设置最佳渲染质量
        ctx.textRenderingOptimization = 'speed';
        
        // 启用硬件加速（如果可用）
        if (ctx.willReadFrequently !== undefined) {
            ctx.willReadFrequently = false;
        }

        return {
            canvas,
            ctx,
            optimized: true
        };
    }

    /**
     * 脏区域渲染优化
     */
    addDirtyRegion(x, y, width, height) {
        this.renderOptimizations.dirtyRegions.add({
            x: Math.floor(x),
            y: Math.floor(y),
            width: Math.ceil(width),
            height: Math.ceil(height)
        });
    }

    /**
     * 清除脏区域
     */
    clearDirtyRegions() {
        this.renderOptimizations.dirtyRegions.clear();
    }

    /**
     * 获取合并的脏区域
     */
    getMergedDirtyRegions() {
        const regions = Array.from(this.renderOptimizations.dirtyRegions);
        if (regions.length === 0) return null;
        if (regions.length === 1) return regions[0];

        // 合并重叠区域
        let minX = Math.min(...regions.map(r => r.x));
        let minY = Math.min(...regions.map(r => r.y));
        let maxX = Math.max(...regions.map(r => r.x + r.width));
        let maxY = Math.max(...regions.map(r => r.y + r.height));

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * 优化渲染调用
     */
    optimizedRender(ctx, renderFunction, forceFullRender = false) {
        const startTime = performance.now();

        if (forceFullRender || this.renderOptimizations.dirtyRegions.size === 0) {
            // 全屏渲染
            renderFunction(ctx);
        } else {
            // 脏区域渲染
            const dirtyRegion = this.getMergedDirtyRegions();
            if (dirtyRegion) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(dirtyRegion.x, dirtyRegion.y, dirtyRegion.width, dirtyRegion.height);
                ctx.clip();
                
                renderFunction(ctx, dirtyRegion);
                
                ctx.restore();
            }
        }

        this.clearDirtyRegions();
        this.metrics.renderTime = performance.now() - startTime;
    }

    /**
     * 动画对象池管理
     */
    getAnimationFromPool(type = 'default') {
        const pool = this.animationManager.animationPool;
        
        if (pool.length > 0) {
            const animation = pool.pop();
            animation.reset();
            return animation;
        }

        // 创建新动画对象
        return this.createAnimationObject(type);
    }

    /**
     * 回收动画对象到池中
     */
    returnAnimationToPool(animation) {
        if (this.animationManager.animationPool.length < this.animationManager.maxPoolSize) {
            animation.cleanup();
            this.animationManager.animationPool.push(animation);
        }
    }

    /**
     * 创建动画对象
     */
    createAnimationObject(type) {
        return {
            type,
            active: false,
            startTime: 0,
            duration: 1000,
            progress: 0,
            
            reset() {
                this.active = false;
                this.startTime = 0;
                this.progress = 0;
            },
            
            cleanup() {
                // 清理资源
            },
            
            update(currentTime) {
                if (!this.active) return false;
                
                this.progress = Math.min((currentTime - this.startTime) / this.duration, 1);
                return this.progress < 1;
            }
        };
    }

    /**
     * 管理活动动画
     */
    updateAnimations(currentTime) {
        const animations = this.animationManager.activeAnimations;
        const toRemove = [];

        for (const [id, animation] of animations) {
            if (!animation.update(currentTime)) {
                toRemove.push(id);
                this.returnAnimationToPool(animation);
            }
        }

        // 移除完成的动画
        toRemove.forEach(id => animations.delete(id));

        // 限制同时活动的动画数量
        if (animations.size > this.config.maxAnimations) {
            const oldestAnimations = Array.from(animations.entries())
                .sort((a, b) => a[1].startTime - b[1].startTime)
                .slice(0, animations.size - this.config.maxAnimations);

            oldestAnimations.forEach(([id, animation]) => {
                animations.delete(id);
                this.returnAnimationToPool(animation);
            });
        }
    }

    /**
     * 图像缓存管理
     */
    cacheImage(key, imageData) {
        if (this.renderOptimizations.imageCache.size > 50) {
            // 清理最旧的缓存
            const firstKey = this.renderOptimizations.imageCache.keys().next().value;
            this.renderOptimizations.imageCache.delete(firstKey);
        }
        
        this.renderOptimizations.imageCache.set(key, imageData);
    }

    /**
     * 获取缓存的图像
     */
    getCachedImage(key) {
        return this.renderOptimizations.imageCache.get(key);
    }

    /**
     * 路径缓存管理
     */
    cachePath(key, path) {
        this.renderOptimizations.pathCache.set(key, path);
    }

    /**
     * 获取缓存的路径
     */
    getCachedPath(key) {
        return this.renderOptimizations.pathCache.get(key);
    }

    /**
     * 创建对象池
     */
    createObjectPools() {
        // 创建常用对象的池
        this.memoryManager.objectPool.set('point', []);
        this.memoryManager.objectPool.set('rect', []);
        this.memoryManager.objectPool.set('color', []);
    }

    /**
     * 从对象池获取对象
     */
    getFromPool(type) {
        const pool = this.memoryManager.objectPool.get(type);
        if (pool && pool.length > 0) {
            return pool.pop();
        }
        
        // 创建新对象
        switch (type) {
            case 'point':
                return { x: 0, y: 0 };
            case 'rect':
                return { x: 0, y: 0, width: 0, height: 0 };
            case 'color':
                return { r: 0, g: 0, b: 0, a: 1 };
            default:
                return {};
        }
    }

    /**
     * 返回对象到池中
     */
    returnToPool(type, obj) {
        const pool = this.memoryManager.objectPool.get(type);
        if (pool && pool.length < 100) { // 限制池大小
            pool.push(obj);
        }
    }

    /**
     * 更新性能指标
     */
    updatePerformanceMetrics(deltaTime) {
        this.metrics.frameCount++;
        this.metrics.lastFrameTime = deltaTime;
        
        // 更新帧时间历史
        this.metrics.frameTimeHistory.push(deltaTime);
        if (this.metrics.frameTimeHistory.length > 60) {
            this.metrics.frameTimeHistory.shift();
        }
        
        // 计算平均FPS
        const avgFrameTime = this.metrics.frameTimeHistory.reduce((a, b) => a + b, 0) / this.metrics.frameTimeHistory.length;
        this.metrics.averageFPS = 1000 / avgFrameTime;
        
        this.metrics.totalGameTime += deltaTime;
    }

    /**
     * 更新内存指标
     */
    updateMemoryMetrics() {
        if (performance.memory) {
            this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
            
            // 检查是否需要垃圾回收
            if (this.metrics.memoryUsage > this.memoryManager.gcThreshold) {
                this.suggestGarbageCollection();
            }
        }
    }

    /**
     * 检查性能问题
     */
    checkPerformanceIssues(deltaTime) {
        // 检查帧率下降
        if (deltaTime > this.config.maxFrameTime * 2) {
            this.handlePerformanceIssue('frame_drop', { deltaTime });
        }
        
        // 检查平均FPS
        if (this.metrics.averageFPS < this.config.targetFPS * 0.8) {
            this.handlePerformanceIssue('low_fps', { fps: this.metrics.averageFPS });
        }
    }

    /**
     * 处理性能问题
     */
    handlePerformanceIssue(type, data) {
        console.warn(`性能问题检测: ${type}`, data);
        
        switch (type) {
            case 'frame_drop':
                this.optimizeForFrameDrop();
                break;
            case 'low_fps':
                this.optimizeForLowFPS();
                break;
            case 'memory_pressure':
                this.optimizeForMemoryPressure();
                break;
        }
    }

    /**
     * 优化帧率下降
     */
    optimizeForFrameDrop() {
        // 减少动画数量
        if (this.animationManager.activeAnimations.size > 5) {
            const toRemove = Array.from(this.animationManager.activeAnimations.keys()).slice(5);
            toRemove.forEach(id => {
                const animation = this.animationManager.activeAnimations.get(id);
                this.animationManager.activeAnimations.delete(id);
                this.returnAnimationToPool(animation);
            });
        }
        
        // 降低渲染质量
        this.config.enableImageSmoothing = false;
    }

    /**
     * 优化低FPS
     */
    optimizeForLowFPS() {
        // 启用更激进的优化
        this.config.maxAnimations = Math.max(3, this.config.maxAnimations - 2);
        
        // 减少渲染频率
        this.config.targetFPS = Math.max(30, this.config.targetFPS - 10);
    }

    /**
     * 优化内存压力
     */
    optimizeForMemoryPressure() {
        // 清理缓存
        this.renderOptimizations.imageCache.clear();
        this.renderOptimizations.pathCache.clear();
        
        // 清理对象池
        for (const pool of this.memoryManager.objectPool.values()) {
            pool.length = Math.min(pool.length, 10);
        }
        
        // 建议垃圾回收
        this.suggestGarbageCollection();
    }

    /**
     * 建议垃圾回收
     */
    suggestGarbageCollection() {
        const now = Date.now();
        if (now - this.memoryManager.lastGCTime > 5000) {
            if (window.gc) {
                window.gc();
            }
            this.memoryManager.lastGCTime = now;
        }
    }

    /**
     * 监控内存压力
     */
    monitorMemoryPressure() {
        if ('memory' in performance) {
            const checkMemory = () => {
                const memory = performance.memory;
                const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
                
                if (usageRatio > 0.8) {
                    this.handlePerformanceIssue('memory_pressure', { usageRatio });
                }
            };
            
            setInterval(checkMemory, 2000);
        }
    }

    /**
     * 创建离屏Canvas
     */
    createOffscreenCanvas() {
        try {
            this.renderOptimizations.offscreenCanvas = new OffscreenCanvas(300, 600);
            this.renderOptimizations.offscreenCtx = this.renderOptimizations.offscreenCanvas.getContext('2d');
            console.log('离屏Canvas已创建');
        } catch (error) {
            console.warn('无法创建离屏Canvas:', error);
        }
    }

    /**
     * 预加载资源
     */
    preloadAssets() {
        // 预生成常用的渐变和图案
        this.preloadGradients();
        this.preloadPatterns();
    }

    /**
     * 预加载渐变
     */
    preloadGradients() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 预生成常用渐变
        const gradients = {
            'block-highlight': ctx.createLinearGradient(0, 0, 30, 30),
            'background': ctx.createLinearGradient(0, 0, 0, 600)
        };
        
        gradients['block-highlight'].addColorStop(0, 'rgba(255,255,255,0.3)');
        gradients['block-highlight'].addColorStop(1, 'rgba(255,255,255,0.1)');
        
        gradients['background'].addColorStop(0, 'rgba(255,255,255,0.02)');
        gradients['background'].addColorStop(1, 'rgba(255,255,255,0.01)');
        
        this.renderOptimizations.gradientCache = gradients;
    }

    /**
     * 预加载图案
     */
    preloadPatterns() {
        // 预生成网格图案等
        const canvas = document.createElement('canvas');
        canvas.width = 30;
        canvas.height = 30;
        const ctx = canvas.getContext('2d');
        
        // 绘制网格图案
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, 30, 30);
        
        this.renderOptimizations.gridPattern = ctx.createPattern(canvas, 'repeat');
    }

    /**
     * 获取性能报告
     */
    getPerformanceReport() {
        return {
            fps: Math.round(this.metrics.averageFPS),
            frameTime: Math.round(this.metrics.lastFrameTime * 100) / 100,
            memoryUsage: Math.round(this.metrics.memoryUsage / 1024 / 1024 * 100) / 100, // MB
            renderTime: Math.round(this.metrics.renderTime * 100) / 100,
            activeAnimations: this.animationManager.activeAnimations.size,
            cacheSize: this.renderOptimizations.imageCache.size,
            gameTime: Math.round(this.metrics.totalGameTime / 1000), // seconds
            optimizations: {
                offscreenCanvas: !!this.renderOptimizations.offscreenCanvas,
                imageSmoothing: this.config.enableImageSmoothing,
                maxAnimations: this.config.maxAnimations
            }
        };
    }

    /**
     * 记录性能指标
     */
    logPerformanceMetrics() {
        const report = this.getPerformanceReport();
        console.log('性能报告:', report);
        
        // 发送性能数据到分析服务（如果需要）
        this.sendPerformanceData(report);
    }

    /**
     * 发送性能数据
     */
    sendPerformanceData(report) {
        // 可以发送到分析服务或本地存储
        if (window.localStorage) {
            const perfHistory = JSON.parse(localStorage.getItem('tetris_performance_history') || '[]');
            perfHistory.push({
                timestamp: Date.now(),
                ...report
            });
            
            // 只保留最近100条记录
            if (perfHistory.length > 100) {
                perfHistory.splice(0, perfHistory.length - 100);
            }
            
            localStorage.setItem('tetris_performance_history', JSON.stringify(perfHistory));
        }
    }

    /**
     * 获取性能历史
     */
    getPerformanceHistory() {
        if (window.localStorage) {
            return JSON.parse(localStorage.getItem('tetris_performance_history') || '[]');
        }
        return [];
    }

    /**
     * 清理资源
     */
    cleanup() {
        // 清理所有缓存
        this.renderOptimizations.imageCache.clear();
        this.renderOptimizations.pathCache.clear();
        
        // 清理动画
        for (const animation of this.animationManager.activeAnimations.values()) {
            this.returnAnimationToPool(animation);
        }
        this.animationManager.activeAnimations.clear();
        
        // 清理对象池
        this.memoryManager.objectPool.clear();
        
        console.log('性能优化器已清理');
    }
}

// 导出性能优化器
window.PerformanceOptimizer = PerformanceOptimizer;