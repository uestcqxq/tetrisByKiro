/**
 * 设备性能检测器 - 检测设备性能并自动调整游戏设置
 * 根据设备能力优化游戏性能和用户体验
 */
class DeviceDetector {
    constructor() {
        this.deviceInfo = {
            // 基本信息
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            
            // 屏幕信息
            screenWidth: screen.width,
            screenHeight: screen.height,
            pixelRatio: window.devicePixelRatio || 1,
            
            // 性能相关
            hardwareConcurrency: navigator.hardwareConcurrency || 4,
            memory: navigator.deviceMemory || 4,
            connection: null,
            
            // 功能支持
            webGL: false,
            webGL2: false,
            offscreenCanvas: false,
            webWorkers: false,
            touchSupport: false,
            
            // 设备类型
            isMobile: false,
            isTablet: false,
            isDesktop: false,
            
            // 性能等级
            performanceLevel: 'medium'
        };

        this.performanceTests = {
            canvasRenderTest: null,
            memoryTest: null,
            computeTest: null,
            networkTest: null
        };

        this.optimizedSettings = {
            graphics: {},
            audio: {},
            network: {},
            ui: {}
        };

        this.initialize();
    }

    /**
     * 初始化设备检测
     */
    async initialize() {
        console.log('开始设备性能检测...');
        
        await this.detectBasicInfo();
        await this.detectCapabilities();
        await this.runPerformanceTests();
        await this.determinePerformanceLevel();
        await this.generateOptimizedSettings();
        
        console.log('设备检测完成:', this.deviceInfo);
        console.log('优化设置:', this.optimizedSettings);
    }

    /**
     * 检测基本设备信息
     */
    async detectBasicInfo() {
        // 检测设备类型
        this.detectDeviceType();
        
        // 检测网络连接
        this.detectNetworkInfo();
        
        // 检测触摸支持
        this.deviceInfo.touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // 检测方向支持
        this.deviceInfo.orientationSupport = 'orientation' in window;
        
        // 检测电池信息（如果可用）
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                this.deviceInfo.battery = {
                    charging: battery.charging,
                    level: battery.level
                };
            } catch (error) {
                console.warn('无法获取电池信息:', error);
            }
        }
    }

    /**
     * 检测设备类型
     */
    detectDeviceType() {
        const ua = navigator.userAgent.toLowerCase();
        const screenWidth = Math.min(screen.width, screen.height);
        
        // 移动设备检测
        if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
            if (/ipad|android(?!.*mobile)/i.test(ua) || screenWidth >= 768) {
                this.deviceInfo.isTablet = true;
            } else {
                this.deviceInfo.isMobile = true;
            }
        } else {
            this.deviceInfo.isDesktop = true;
        }

        // 具体设备识别
        if (/iphone/i.test(ua)) {
            this.deviceInfo.device = 'iPhone';
        } else if (/ipad/i.test(ua)) {
            this.deviceInfo.device = 'iPad';
        } else if (/android/i.test(ua)) {
            this.deviceInfo.device = 'Android';
        } else if (/windows/i.test(ua)) {
            this.deviceInfo.device = 'Windows';
        } else if (/mac/i.test(ua)) {
            this.deviceInfo.device = 'Mac';
        } else if (/linux/i.test(ua)) {
            this.deviceInfo.device = 'Linux';
        }
    }

    /**
     * 检测网络信息
     */
    detectNetworkInfo() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            this.deviceInfo.connection = {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };
        }
    }

    /**
     * 检测设备能力
     */
    async detectCapabilities() {
        // WebGL支持检测
        this.detectWebGLSupport();
        
        // OffscreenCanvas支持
        this.deviceInfo.offscreenCanvas = 'OffscreenCanvas' in window;
        
        // Web Workers支持
        this.deviceInfo.webWorkers = 'Worker' in window;
        
        // WebAssembly支持
        this.deviceInfo.webAssembly = 'WebAssembly' in window;
        
        // 音频支持
        this.detectAudioSupport();
        
        // 存储支持
        this.detectStorageSupport();
        
        // 其他API支持
        this.detectOtherAPIs();
    }

    /**
     * 检测WebGL支持
     */
    detectWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            this.deviceInfo.webGL = !!gl;
            
            if (gl) {
                const gl2 = canvas.getContext('webgl2');
                this.deviceInfo.webGL2 = !!gl2;
                
                // 获取WebGL信息
                this.deviceInfo.webGLInfo = {
                    vendor: gl.getParameter(gl.VENDOR),
                    renderer: gl.getParameter(gl.RENDERER),
                    version: gl.getParameter(gl.VERSION),
                    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                    maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)
                };
            }
        } catch (error) {
            console.warn('WebGL检测失败:', error);
            this.deviceInfo.webGL = false;
            this.deviceInfo.webGL2 = false;
        }
    }

    /**
     * 检测音频支持
     */
    detectAudioSupport() {
        const audio = document.createElement('audio');
        this.deviceInfo.audioSupport = {
            mp3: !!audio.canPlayType('audio/mpeg'),
            ogg: !!audio.canPlayType('audio/ogg'),
            wav: !!audio.canPlayType('audio/wav'),
            webAudio: 'AudioContext' in window || 'webkitAudioContext' in window
        };
    }

    /**
     * 检测存储支持
     */
    detectStorageSupport() {
        this.deviceInfo.storageSupport = {
            localStorage: 'localStorage' in window,
            sessionStorage: 'sessionStorage' in window,
            indexedDB: 'indexedDB' in window,
            webSQL: 'openDatabase' in window
        };
    }

    /**
     * 检测其他API支持
     */
    detectOtherAPIs() {
        this.deviceInfo.apiSupport = {
            requestAnimationFrame: 'requestAnimationFrame' in window,
            fullscreen: 'requestFullscreen' in document.documentElement,
            vibration: 'vibrate' in navigator,
            geolocation: 'geolocation' in navigator,
            deviceOrientation: 'DeviceOrientationEvent' in window,
            deviceMotion: 'DeviceMotionEvent' in window
        };
    }

    /**
     * 运行性能测试
     */
    async runPerformanceTests() {
        console.log('开始性能测试...');
        
        // Canvas渲染性能测试
        this.performanceTests.canvasRenderTest = await this.testCanvasPerformance();
        
        // 内存性能测试
        this.performanceTests.memoryTest = await this.testMemoryPerformance();
        
        // 计算性能测试
        this.performanceTests.computeTest = await this.testComputePerformance();
        
        // 网络性能测试
        this.performanceTests.networkTest = await this.testNetworkPerformance();
        
        console.log('性能测试完成:', this.performanceTests);
    }

    /**
     * Canvas渲染性能测试
     */
    async testCanvasPerformance() {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 600;
            const ctx = canvas.getContext('2d');
            
            const startTime = performance.now();
            let frameCount = 0;
            const testDuration = 1000; // 1秒测试
            
            const renderTest = () => {
                // 模拟游戏渲染
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // 绘制网格
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                for (let x = 0; x < canvas.width; x += 30) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, canvas.height);
                    ctx.stroke();
                }
                for (let y = 0; y < canvas.height; y += 30) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(canvas.width, y);
                    ctx.stroke();
                }
                
                // 绘制一些方块
                for (let i = 0; i < 50; i++) {
                    ctx.fillStyle = `hsl(${i * 7}, 70%, 50%)`;
                    ctx.fillRect(
                        Math.random() * canvas.width,
                        Math.random() * canvas.height,
                        30, 30
                    );
                }
                
                frameCount++;
                
                if (performance.now() - startTime < testDuration) {
                    requestAnimationFrame(renderTest);
                } else {
                    const fps = frameCount / (testDuration / 1000);
                    resolve({
                        fps,
                        frameCount,
                        duration: testDuration,
                        score: Math.min(fps / 60, 1) // 标准化到0-1
                    });
                }
            };
            
            requestAnimationFrame(renderTest);
        });
    }

    /**
     * 内存性能测试
     */
    async testMemoryPerformance() {
        const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        
        // 创建大量对象测试内存分配
        const objects = [];
        const startTime = performance.now();
        
        try {
            for (let i = 0; i < 10000; i++) {
                objects.push({
                    id: i,
                    data: new Array(100).fill(Math.random()),
                    timestamp: Date.now()
                });
            }
            
            const allocationTime = performance.now() - startTime;
            const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
            const memoryUsed = endMemory - startMemory;
            
            // 清理对象
            objects.length = 0;
            
            return {
                allocationTime,
                memoryUsed,
                objectCount: 10000,
                score: Math.max(0, 1 - (allocationTime / 1000)) // 越快越好
            };
        } catch (error) {
            return {
                error: error.message,
                score: 0.5
            };
        }
    }

    /**
     * 计算性能测试
     */
    async testComputePerformance() {
        const startTime = performance.now();
        
        // 执行一些计算密集型操作
        let result = 0;
        for (let i = 0; i < 1000000; i++) {
            result += Math.sin(i) * Math.cos(i) * Math.sqrt(i);
        }
        
        const computeTime = performance.now() - startTime;
        
        return {
            computeTime,
            operations: 1000000,
            result,
            score: Math.max(0, 1 - (computeTime / 1000))
        };
    }

    /**
     * 网络性能测试
     */
    async testNetworkPerformance() {
        if (!navigator.onLine) {
            return { offline: true, score: 0 };
        }
        
        try {
            const startTime = performance.now();
            
            // 测试小文件下载速度
            const response = await fetch('/static/images/favicon.ico?' + Date.now(), {
                cache: 'no-cache'
            });
            
            if (response.ok) {
                await response.blob();
                const loadTime = performance.now() - startTime;
                
                return {
                    loadTime,
                    score: Math.max(0, 1 - (loadTime / 1000))
                };
            } else {
                return { error: 'Network test failed', score: 0.5 };
            }
        } catch (error) {
            return { error: error.message, score: 0.3 };
        }
    }

    /**
     * 确定性能等级
     */
    async determinePerformanceLevel() {
        const scores = {
            canvas: this.performanceTests.canvasRenderTest?.score || 0.5,
            memory: this.performanceTests.memoryTest?.score || 0.5,
            compute: this.performanceTests.computeTest?.score || 0.5,
            network: this.performanceTests.networkTest?.score || 0.5
        };
        
        // 设备特征权重
        let deviceScore = 0.5;
        
        if (this.deviceInfo.isDesktop) {
            deviceScore += 0.2;
        } else if (this.deviceInfo.isTablet) {
            deviceScore += 0.1;
        }
        
        if (this.deviceInfo.hardwareConcurrency >= 8) {
            deviceScore += 0.1;
        } else if (this.deviceInfo.hardwareConcurrency >= 4) {
            deviceScore += 0.05;
        }
        
        if (this.deviceInfo.memory >= 8) {
            deviceScore += 0.1;
        } else if (this.deviceInfo.memory >= 4) {
            deviceScore += 0.05;
        }
        
        if (this.deviceInfo.webGL2) {
            deviceScore += 0.1;
        } else if (this.deviceInfo.webGL) {
            deviceScore += 0.05;
        }
        
        // 计算综合得分
        const totalScore = (
            scores.canvas * 0.4 +
            scores.memory * 0.2 +
            scores.compute * 0.2 +
            scores.network * 0.1 +
            deviceScore * 0.1
        );
        
        // 确定性能等级
        if (totalScore >= 0.8) {
            this.deviceInfo.performanceLevel = 'high';
        } else if (totalScore >= 0.6) {
            this.deviceInfo.performanceLevel = 'medium';
        } else if (totalScore >= 0.4) {
            this.deviceInfo.performanceLevel = 'low';
        } else {
            this.deviceInfo.performanceLevel = 'very_low';
        }
        
        this.deviceInfo.performanceScore = totalScore;
    }

    /**
     * 生成优化设置
     */
    async generateOptimizedSettings() {
        const level = this.deviceInfo.performanceLevel;
        
        // 图形设置
        this.optimizedSettings.graphics = this.getGraphicsSettings(level);
        
        // 音频设置
        this.optimizedSettings.audio = this.getAudioSettings(level);
        
        // 网络设置
        this.optimizedSettings.network = this.getNetworkSettings(level);
        
        // UI设置
        this.optimizedSettings.ui = this.getUISettings(level);
        
        // 游戏设置
        this.optimizedSettings.game = this.getGameSettings(level);
    }

    /**
     * 获取图形设置
     */
    getGraphicsSettings(level) {
        const settings = {
            enableAnimations: true,
            maxAnimations: 10,
            enableParticles: true,
            enableShadows: true,
            enableGradients: true,
            targetFPS: 60,
            enableVSync: true,
            canvasOptimization: true
        };

        switch (level) {
            case 'very_low':
                settings.enableAnimations = false;
                settings.maxAnimations = 2;
                settings.enableParticles = false;
                settings.enableShadows = false;
                settings.enableGradients = false;
                settings.targetFPS = 30;
                settings.enableVSync = false;
                break;
                
            case 'low':
                settings.maxAnimations = 5;
                settings.enableParticles = false;
                settings.enableShadows = false;
                settings.targetFPS = 45;
                break;
                
            case 'medium':
                settings.maxAnimations = 8;
                settings.enableParticles = true;
                settings.enableShadows = true;
                break;
                
            case 'high':
                settings.maxAnimations = 15;
                settings.enableParticles = true;
                settings.enableShadows = true;
                settings.enableGradients = true;
                break;
        }

        return settings;
    }

    /**
     * 获取音频设置
     */
    getAudioSettings(level) {
        const settings = {
            enableAudio: true,
            enableMusic: true,
            enableSoundEffects: true,
            audioQuality: 'medium',
            maxAudioChannels: 8
        };

        if (!this.deviceInfo.audioSupport.webAudio) {
            settings.enableMusic = false;
            settings.maxAudioChannels = 2;
        }

        switch (level) {
            case 'very_low':
                settings.enableMusic = false;
                settings.audioQuality = 'low';
                settings.maxAudioChannels = 2;
                break;
                
            case 'low':
                settings.audioQuality = 'low';
                settings.maxAudioChannels = 4;
                break;
                
            case 'medium':
                settings.audioQuality = 'medium';
                settings.maxAudioChannels = 6;
                break;
                
            case 'high':
                settings.audioQuality = 'high';
                settings.maxAudioChannels = 12;
                break;
        }

        return settings;
    }

    /**
     * 获取网络设置
     */
    getNetworkSettings(level) {
        const settings = {
            enableRealtime: true,
            updateFrequency: 1000,
            enableCompression: true,
            maxRetries: 3,
            timeout: 5000
        };

        const connection = this.deviceInfo.connection;
        if (connection) {
            if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                settings.enableRealtime = false;
                settings.updateFrequency = 5000;
                settings.enableCompression = true;
                settings.maxRetries = 1;
            } else if (connection.effectiveType === '3g') {
                settings.updateFrequency = 2000;
                settings.maxRetries = 2;
            }
        }

        return settings;
    }

    /**
     * 获取UI设置
     */
    getUISettings(level) {
        const settings = {
            enableTransitions: true,
            animationDuration: 300,
            enableBlur: true,
            enableShadows: true,
            responsiveUI: true
        };

        if (this.deviceInfo.isMobile) {
            settings.enableBlur = false;
            settings.animationDuration = 200;
        }

        switch (level) {
            case 'very_low':
                settings.enableTransitions = false;
                settings.enableBlur = false;
                settings.enableShadows = false;
                break;
                
            case 'low':
                settings.animationDuration = 150;
                settings.enableBlur = false;
                break;
                
            case 'medium':
                settings.animationDuration = 250;
                break;
                
            case 'high':
                settings.animationDuration = 350;
                settings.enableBlur = true;
                break;
        }

        return settings;
    }

    /**
     * 获取游戏设置
     */
    getGameSettings(level) {
        const settings = {
            enablePreview: true,
            enableGhost: true,
            enableHold: true,
            enableStats: true,
            updateRate: 60,
            inputDelay: 0
        };

        switch (level) {
            case 'very_low':
                settings.enableStats = false;
                settings.updateRate = 30;
                settings.inputDelay = 50;
                break;
                
            case 'low':
                settings.updateRate = 45;
                settings.inputDelay = 30;
                break;
                
            case 'medium':
                settings.updateRate = 60;
                settings.inputDelay = 10;
                break;
                
            case 'high':
                settings.updateRate = 120;
                settings.inputDelay = 0;
                break;
        }

        return settings;
    }

    /**
     * 获取设备信息
     */
    getDeviceInfo() {
        return { ...this.deviceInfo };
    }

    /**
     * 获取优化设置
     */
    getOptimizedSettings() {
        return { ...this.optimizedSettings };
    }

    /**
     * 获取性能报告
     */
    getPerformanceReport() {
        return {
            deviceInfo: this.getDeviceInfo(),
            performanceTests: { ...this.performanceTests },
            optimizedSettings: this.getOptimizedSettings(),
            recommendations: this.getRecommendations()
        };
    }

    /**
     * 获取优化建议
     */
    getRecommendations() {
        const recommendations = [];
        
        if (this.deviceInfo.performanceLevel === 'very_low') {
            recommendations.push('建议关闭动画效果以提高性能');
            recommendations.push('建议降低游戏更新频率');
        }
        
        if (this.deviceInfo.isMobile) {
            recommendations.push('建议使用触摸控制');
            recommendations.push('建议启用省电模式');
        }
        
        if (this.deviceInfo.connection?.saveData) {
            recommendations.push('检测到数据节省模式，已优化网络使用');
        }
        
        if (!this.deviceInfo.webGL) {
            recommendations.push('设备不支持WebGL，使用Canvas 2D渲染');
        }
        
        return recommendations;
    }

    /**
     * 应用优化设置到游戏
     */
    applyOptimizations(gameInstance) {
        if (!gameInstance) return;
        
        const settings = this.optimizedSettings;
        
        // 应用图形设置
        if (gameInstance.renderer) {
            gameInstance.renderer.setMaxAnimations(settings.graphics.maxAnimations);
            gameInstance.renderer.setTargetFPS(settings.graphics.targetFPS);
            gameInstance.renderer.enableAnimations(settings.graphics.enableAnimations);
        }
        
        // 应用游戏设置
        if (gameInstance.config) {
            gameInstance.config.updateRate = settings.game.updateRate;
            gameInstance.config.inputDelay = settings.game.inputDelay;
        }
        
        console.log('优化设置已应用到游戏实例');
    }
}

// 导出设备检测器
window.DeviceDetector = DeviceDetector;