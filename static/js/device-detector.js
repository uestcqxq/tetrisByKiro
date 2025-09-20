/**
 * 简化设备性能检测器
 * 快速确定设备性能等级并提供自动配置调整
 */
class DeviceDetector {
    constructor() {
        this.performanceLevel = 'medium'; // low, medium, high
        this.deviceInfo = {
            isMobile: false,
            isTablet: false,
            isDesktop: false,
            hasTouch: false,
            screenSize: 'medium',
            memoryLevel: 'medium',
            cpuLevel: 'medium',
            gpuLevel: 'medium'
        };
        
        this.detectionResults = {
            completed: false,
            detectionTime: 0,
            confidence: 0,
            fallbackUsed: false
        };
        
        // 性能配置映射
        this.performanceConfigs = {
            low: {
                enableAnimations: false,
                maxAnimations: 0,
                targetFPS: 30,
                enableGradients: false,
                enableShadows: false,
                enableParticles: false,
                renderQuality: 'low',
                audioChannels: 1,
                preloadAssets: false
            },
            medium: {
                enableAnimations: true,
                maxAnimations: 5,
                targetFPS: 45,
                enableGradients: true,
                enableShadows: false,
                enableParticles: true,
                renderQuality: 'medium',
                audioChannels: 2,
                preloadAssets: true
            },
            high: {
                enableAnimations: true,
                maxAnimations: 10,
                targetFPS: 60,
                enableGradients: true,
                enableShadows: true,
                enableParticles: true,
                renderQuality: 'high',
                audioChannels: 4,
                preloadAssets: true
            }
        };
        
        // 检测超时时间（毫秒）
        this.detectionTimeout = 2000;
    }

    /**
     * 初始化设备检测
     */
    async initialize() {
        const startTime = performance.now();
        
        try {
            console.log('开始设备性能检测...');
            
            // 快速基础检测
            await this.performBasicDetection();
            
            // 性能基准测试（简化版）
            await this.performSimpleBenchmark();
            
            // 确定性能等级
            this.determinePerformanceLevel();
            
            // 生成配置
            const config = this.generateConfiguration();
            
            this.detectionResults.completed = true;
            this.detectionResults.detectionTime = performance.now() - startTime;
            this.detectionResults.confidence = this.calculateConfidence();
            
            console.log(`设备检测完成 - 性能等级: ${this.performanceLevel}, 耗时: ${Math.round(this.detectionResults.detectionTime)}ms`);
            
            return {
                performanceLevel: this.performanceLevel,
                deviceInfo: this.deviceInfo,
                config: config,
                results: this.detectionResults
            };
            
        } catch (error) {
            console.warn('设备检测失败，使用默认配置:', error);
            return this.getFallbackConfiguration();
        }
    }

    /**
     * 执行基础设备检测
     */
    async performBasicDetection() {
        // 检测设备类型
        this.detectDeviceType();
        
        // 检测屏幕信息
        this.detectScreenInfo();
        
        // 检测内存信息
        this.detectMemoryInfo();
        
        // 检测触摸支持
        this.detectTouchSupport();
        
        // 检测浏览器性能API支持
        this.detectBrowserCapabilities();
    }

    /**
     * 检测设备类型
     */
    detectDeviceType() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        // 移动设备检测
        this.deviceInfo.isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        
        // 平板检测
        this.deviceInfo.isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent) || 
                                  (this.deviceInfo.isMobile && window.innerWidth > 768);
        
        // 桌面设备
        this.deviceInfo.isDesktop = !this.deviceInfo.isMobile && !this.deviceInfo.isTablet;
        
        console.log('设备类型检测:', {
            mobile: this.deviceInfo.isMobile,
            tablet: this.deviceInfo.isTablet,
            desktop: this.deviceInfo.isDesktop
        });
    }

    /**
     * 检测屏幕信息
     */
    detectScreenInfo() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const pixelRatio = window.devicePixelRatio || 1;
        
        // 屏幕尺寸分类
        if (width <= 480) {
            this.deviceInfo.screenSize = 'small';
        } else if (width <= 1024) {
            this.deviceInfo.screenSize = 'medium';
        } else {
            this.deviceInfo.screenSize = 'large';
        }
        
        // 高分辨率屏幕检测
        this.deviceInfo.isHighDPI = pixelRatio > 1.5;
        this.deviceInfo.screenResolution = { width, height, pixelRatio };
        
        console.log('屏幕信息:', {
            size: this.deviceInfo.screenSize,
            resolution: `${width}x${height}`,
            pixelRatio: pixelRatio,
            highDPI: this.deviceInfo.isHighDPI
        });
    }

    /**
     * 检测内存信息
     */
    detectMemoryInfo() {
        try {
            // 尝试获取设备内存信息（Chrome支持）
            if (navigator.deviceMemory) {
                const memory = navigator.deviceMemory;
                if (memory <= 2) {
                    this.deviceInfo.memoryLevel = 'low';
                } else if (memory <= 4) {
                    this.deviceInfo.memoryLevel = 'medium';
                } else {
                    this.deviceInfo.memoryLevel = 'high';
                }
                console.log(`设备内存: ${memory}GB, 等级: ${this.deviceInfo.memoryLevel}`);
            } else {
                // 基于设备类型推测
                if (this.deviceInfo.isMobile) {
                    this.deviceInfo.memoryLevel = 'low';
                } else if (this.deviceInfo.isTablet) {
                    this.deviceInfo.memoryLevel = 'medium';
                } else {
                    this.deviceInfo.memoryLevel = 'medium';
                }
                console.log('内存信息不可用，基于设备类型推测:', this.deviceInfo.memoryLevel);
            }
        } catch (error) {
            console.warn('内存检测失败:', error);
            this.deviceInfo.memoryLevel = 'medium';
        }
    }

    /**
     * 检测触摸支持
     */
    detectTouchSupport() {
        this.deviceInfo.hasTouch = 'ontouchstart' in window || 
                                  navigator.maxTouchPoints > 0 || 
                                  navigator.msMaxTouchPoints > 0;
        
        console.log('触摸支持:', this.deviceInfo.hasTouch);
    }

    /**
     * 检测浏览器性能能力
     */
    detectBrowserCapabilities() {
        this.deviceInfo.capabilities = {
            webGL: this.detectWebGLSupport(),
            canvas: this.detectCanvasSupport(),
            webWorkers: typeof Worker !== 'undefined',
            requestAnimationFrame: typeof requestAnimationFrame !== 'undefined',
            performanceAPI: typeof performance !== 'undefined' && typeof performance.now !== 'undefined'
        };
        
        console.log('浏览器能力:', this.deviceInfo.capabilities);
    }

    /**
     * 检测WebGL支持
     */
    detectWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!gl;
        } catch (error) {
            return false;
        }
    }

    /**
     * 检测Canvas支持
     */
    detectCanvasSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext && canvas.getContext('2d'));
        } catch (error) {
            return false;
        }
    }

    /**
     * 执行简化的性能基准测试
     */
    async performSimpleBenchmark() {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.warn('性能测试超时，使用默认评估');
                this.deviceInfo.cpuLevel = 'medium';
                this.deviceInfo.gpuLevel = 'medium';
                resolve();
            }, this.detectionTimeout);

            try {
                // CPU性能测试（简化版）
                const cpuScore = this.testCPUPerformance();
                
                // GPU性能测试（简化版）
                const gpuScore = this.testGPUPerformance();
                
                // 评估性能等级
                this.deviceInfo.cpuLevel = this.evaluatePerformanceLevel(cpuScore, [100, 300]);
                this.deviceInfo.gpuLevel = this.evaluatePerformanceLevel(gpuScore, [50, 150]);
                
                clearTimeout(timeout);
                resolve();
                
            } catch (error) {
                console.warn('性能测试失败:', error);
                this.deviceInfo.cpuLevel = 'medium';
                this.deviceInfo.gpuLevel = 'medium';
                clearTimeout(timeout);
                resolve();
            }
        });
    }

    /**
     * CPU性能测试
     */
    testCPUPerformance() {
        const startTime = performance.now();
        
        // 简单的计算密集型任务
        let result = 0;
        for (let i = 0; i < 100000; i++) {
            result += Math.sqrt(i) * Math.sin(i);
        }
        
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // 分数越高表示性能越好（执行时间越短）
        const score = Math.max(1, 1000 / executionTime);
        
        console.log(`CPU测试: ${Math.round(executionTime)}ms, 分数: ${Math.round(score)}`);
        return score;
    }

    /**
     * GPU性能测试（Canvas渲染）
     */
    testGPUPerformance() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            
            const startTime = performance.now();
            
            // 简单的渲染测试
            for (let i = 0; i < 1000; i++) {
                ctx.fillStyle = `hsl(${i % 360}, 50%, 50%)`;
                ctx.fillRect(i % 200, (i * 2) % 200, 10, 10);
            }
            
            const endTime = performance.now();
            const executionTime = endTime - startTime;
            
            // 分数越高表示性能越好
            const score = Math.max(1, 500 / executionTime);
            
            console.log(`GPU测试: ${Math.round(executionTime)}ms, 分数: ${Math.round(score)}`);
            return score;
            
        } catch (error) {
            console.warn('GPU测试失败:', error);
            return 50; // 默认中等分数
        }
    }

    /**
     * 评估性能等级
     */
    evaluatePerformanceLevel(score, thresholds) {
        if (score < thresholds[0]) {
            return 'low';
        } else if (score < thresholds[1]) {
            return 'medium';
        } else {
            return 'high';
        }
    }

    /**
     * 确定整体性能等级
     */
    determinePerformanceLevel() {
        const factors = [];
        
        // 设备类型权重
        if (this.deviceInfo.isMobile) {
            factors.push('low');
        } else if (this.deviceInfo.isTablet) {
            factors.push('medium');
        } else {
            factors.push('high');
        }
        
        // 内存等级
        factors.push(this.deviceInfo.memoryLevel);
        
        // CPU等级
        factors.push(this.deviceInfo.cpuLevel);
        
        // GPU等级
        factors.push(this.deviceInfo.gpuLevel);
        
        // 屏幕尺寸影响
        if (this.deviceInfo.screenSize === 'small') {
            factors.push('low');
        } else if (this.deviceInfo.screenSize === 'large') {
            factors.push('high');
        }
        
        // 计算平均等级
        const levelScores = factors.map(level => {
            switch (level) {
                case 'low': return 1;
                case 'medium': return 2;
                case 'high': return 3;
                default: return 2;
            }
        });
        
        const averageScore = levelScores.reduce((sum, score) => sum + score, 0) / levelScores.length;
        
        // 确定最终等级
        if (averageScore <= 1.5) {
            this.performanceLevel = 'low';
        } else if (averageScore <= 2.5) {
            this.performanceLevel = 'medium';
        } else {
            this.performanceLevel = 'high';
        }
        
        console.log('性能等级评估:', {
            factors: factors,
            averageScore: averageScore.toFixed(2),
            finalLevel: this.performanceLevel
        });
    }

    /**
     * 生成基于性能等级的配置
     */
    generateConfiguration() {
        const baseConfig = { ...this.performanceConfigs[this.performanceLevel] };
        
        // 根据具体设备特性调整配置
        if (this.deviceInfo.isMobile) {
            // 移动设备特殊优化
            baseConfig.enableAnimations = baseConfig.enableAnimations && this.performanceLevel !== 'low';
            baseConfig.maxAnimations = Math.min(baseConfig.maxAnimations, 3);
            baseConfig.targetFPS = Math.min(baseConfig.targetFPS, 45);
        }
        
        if (this.deviceInfo.screenSize === 'small') {
            // 小屏幕优化
            baseConfig.renderQuality = 'low';
            baseConfig.enableShadows = false;
        }
        
        if (!this.deviceInfo.capabilities.webGL) {
            // 无WebGL支持时的降级
            baseConfig.renderQuality = 'low';
            baseConfig.enableGradients = false;
        }
        
        if (this.deviceInfo.hasTouch) {
            // 触摸设备优化
            baseConfig.touchOptimized = true;
            baseConfig.buttonSize = 'large';
        }
        
        console.log('生成的配置:', baseConfig);
        return baseConfig;
    }

    /**
     * 计算检测置信度
     */
    calculateConfidence() {
        let confidence = 0.5; // 基础置信度
        
        // 有设备内存信息
        if (navigator.deviceMemory) {
            confidence += 0.2;
        }
        
        // 性能测试完成
        if (this.deviceInfo.cpuLevel && this.deviceInfo.gpuLevel) {
            confidence += 0.2;
        }
        
        // 浏览器能力检测完整
        if (this.deviceInfo.capabilities) {
            confidence += 0.1;
        }
        
        return Math.min(confidence, 1.0);
    }

    /**
     * 获取回退配置（检测失败时使用）
     */
    getFallbackConfiguration() {
        console.log('使用回退配置');
        
        this.detectionResults.fallbackUsed = true;
        this.performanceLevel = 'medium';
        
        // 基于用户代理的简单判断
        const userAgent = navigator.userAgent.toLowerCase();
        if (/android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
            this.performanceLevel = 'low';
        }
        
        const config = { ...this.performanceConfigs[this.performanceLevel] };
        
        return {
            performanceLevel: this.performanceLevel,
            deviceInfo: {
                isMobile: /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent),
                isTablet: false,
                isDesktop: true,
                hasTouch: 'ontouchstart' in window,
                screenSize: window.innerWidth <= 768 ? 'small' : 'medium',
                memoryLevel: 'medium',
                cpuLevel: 'medium',
                gpuLevel: 'medium'
            },
            config: config,
            results: {
                completed: false,
                detectionTime: 0,
                confidence: 0.3,
                fallbackUsed: true
            }
        };
    }

    /**
     * 获取设备信息摘要
     */
    getDeviceSummary() {
        return {
            type: this.deviceInfo.isMobile ? 'Mobile' : 
                  this.deviceInfo.isTablet ? 'Tablet' : 'Desktop',
            performance: this.performanceLevel,
            screen: this.deviceInfo.screenSize,
            memory: this.deviceInfo.memoryLevel,
            touch: this.deviceInfo.hasTouch,
            confidence: Math.round(this.detectionResults.confidence * 100) + '%'
        };
    }

    /**
     * 应用配置到游戏
     */
    applyConfigurationToGame(config) {
        try {
            // 更新全局游戏配置
            if (window.GAME_CONFIG) {
                window.GAME_CONFIG.ENABLE_ANIMATIONS = config.enableAnimations;
                window.GAME_CONFIG.MAX_ANIMATIONS = config.maxAnimations;
                window.GAME_CONFIG.TARGET_FPS = config.targetFPS;
                window.GAME_CONFIG.RENDER_QUALITY = config.renderQuality;
            }
            
            // 更新颜色主题配置
            if (window.COLOR_THEMES && !config.enableGradients) {
                Object.values(window.COLOR_THEMES).forEach(theme => {
                    theme.useSimpleColors = true;
                });
            }
            
            // 应用移动设备优化
            if (config.touchOptimized) {
                document.body.classList.add('touch-optimized');
            }
            
            console.log('配置已应用到游戏');
            return true;
            
        } catch (error) {
            console.error('应用配置失败:', error);
            return false;
        }
    }
}

// 导出类
window.DeviceDetector = DeviceDetector;

console.log('设备性能检测器加载完成');