/**
 * 性能监控面板 - 实时显示游戏性能指标
 * 用于开发和调试时监控游戏性能
 */
class PerformanceDashboard {
    constructor(config = {}) {
        this.config = {
            updateInterval: 1000,
            maxHistoryLength: 60,
            showInProduction: false,
            position: 'top-left',
            ...config
        };

        this.isVisible = false;
        this.dashboard = null;
        this.updateTimer = null;
        
        // 性能历史数据
        this.history = {
            fps: [],
            memory: [],
            renderTime: [],
            networkLatency: []
        };

        // 只在开发环境或明确启用时显示
        if (this.config.showInProduction || this.isDevelopment()) {
            this.initialize();
        }
    }

    /**
     * 检查是否为开发环境
     */
    isDevelopment() {
        return location.hostname === 'localhost' || 
               location.hostname === '127.0.0.1' ||
               location.search.includes('debug=true');
    }

    /**
     * 初始化性能面板
     */
    initialize() {
        this.createDashboard();
        this.setupEventListeners();
        this.startMonitoring();
        
        console.log('性能监控面板已初始化');
    }

    /**
     * 创建面板DOM
     */
    createDashboard() {
        this.dashboard = document.createElement('div');
        this.dashboard.id = 'performance-dashboard';
        this.dashboard.className = `performance-dashboard ${this.config.position}`;
        
        this.dashboard.innerHTML = `
            <div class="dashboard-header">
                <span class="dashboard-title">性能监控</span>
                <button class="dashboard-toggle" title="切换显示">📊</button>
                <button class="dashboard-close" title="关闭">×</button>
            </div>
            <div class="dashboard-content">
                <div class="metric-group">
                    <h4>渲染性能</h4>
                    <div class="metric-item">
                        <span class="metric-label">FPS:</span>
                        <span id="fps-value" class="metric-value">--</span>
                        <div class="metric-chart" id="fps-chart"></div>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">渲染时间:</span>
                        <span id="render-time-value" class="metric-value">--</span>
                        <div class="metric-chart" id="render-chart"></div>
                    </div>
                </div>
                
                <div class="metric-group">
                    <h4>内存使用</h4>
                    <div class="metric-item">
                        <span class="metric-label">JS堆:</span>
                        <span id="memory-value" class="metric-value">--</span>
                        <div class="metric-chart" id="memory-chart"></div>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">缓存:</span>
                        <span id="cache-value" class="metric-value">--</span>
                    </div>
                </div>
                
                <div class="metric-group">
                    <h4>网络状态</h4>
                    <div class="metric-item">
                        <span class="metric-label">延迟:</span>
                        <span id="latency-value" class="metric-value">--</span>
                        <div class="metric-chart" id="latency-chart"></div>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">连接:</span>
                        <span id="connection-value" class="metric-value">--</span>
                    </div>
                </div>
                
                <div class="metric-group">
                    <h4>设备信息</h4>
                    <div class="metric-item">
                        <span class="metric-label">性能等级:</span>
                        <span id="performance-level" class="metric-value">--</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">优化状态:</span>
                        <span id="optimization-status" class="metric-value">--</span>
                    </div>
                </div>
                
                <div class="dashboard-actions">
                    <button id="clear-cache-btn" class="action-btn">清理缓存</button>
                    <button id="force-gc-btn" class="action-btn">强制GC</button>
                    <button id="export-data-btn" class="action-btn">导出数据</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.dashboard);
        this.addDashboardStyles();
    }

    /**
     * 添加面板样式
     */
    addDashboardStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .performance-dashboard {
                position: fixed;
                width: 300px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                border: 1px solid #333;
                border-radius: 8px;
                font-family: monospace;
                font-size: 12px;
                z-index: 15000;
                backdrop-filter: blur(5px);
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            }
            
            .performance-dashboard.top-left {
                top: 10px;
                left: 10px;
            }
            
            .performance-dashboard.top-right {
                top: 10px;
                right: 10px;
            }
            
            .performance-dashboard.bottom-left {
                bottom: 10px;
                left: 10px;
            }
            
            .performance-dashboard.bottom-right {
                bottom: 10px;
                right: 10px;
            }
            
            .dashboard-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: rgba(76, 175, 80, 0.2);
                border-bottom: 1px solid #333;
                border-radius: 8px 8px 0 0;
            }
            
            .dashboard-title {
                font-weight: bold;
                color: #4CAF50;
            }
            
            .dashboard-toggle,
            .dashboard-close {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 14px;
            }
            
            .dashboard-toggle:hover,
            .dashboard-close:hover {
                background: rgba(255, 255, 255, 0.1);
            }
            
            .dashboard-content {
                padding: 12px;
                max-height: 400px;
                overflow-y: auto;
            }
            
            .dashboard-content.collapsed {
                display: none;
            }
            
            .metric-group {
                margin-bottom: 15px;
                border-bottom: 1px solid #333;
                padding-bottom: 10px;
            }
            
            .metric-group:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }
            
            .metric-group h4 {
                margin: 0 0 8px 0;
                color: #4CAF50;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .metric-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
                position: relative;
            }
            
            .metric-label {
                color: #ccc;
                min-width: 80px;
            }
            
            .metric-value {
                color: white;
                font-weight: bold;
                min-width: 60px;
                text-align: right;
            }
            
            .metric-value.good {
                color: #4CAF50;
            }
            
            .metric-value.warning {
                color: #FF9800;
            }
            
            .metric-value.error {
                color: #F44336;
            }
            
            .metric-chart {
                position: absolute;
                bottom: -2px;
                left: 0;
                right: 0;
                height: 2px;
                background: #333;
                border-radius: 1px;
                overflow: hidden;
            }
            
            .chart-bar {
                height: 100%;
                background: linear-gradient(90deg, #4CAF50, #2196F3);
                transition: width 0.3s ease;
            }
            
            .dashboard-actions {
                display: flex;
                gap: 5px;
                flex-wrap: wrap;
                margin-top: 10px;
            }
            
            .action-btn {
                background: #333;
                border: 1px solid #555;
                color: white;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
                flex: 1;
                min-width: 60px;
            }
            
            .action-btn:hover {
                background: #555;
            }
            
            .action-btn:active {
                background: #222;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 切换显示/隐藏
        const toggleBtn = this.dashboard.querySelector('.dashboard-toggle');
        toggleBtn.addEventListener('click', () => {
            this.toggleContent();
        });

        // 关闭面板
        const closeBtn = this.dashboard.querySelector('.dashboard-close');
        closeBtn.addEventListener('click', () => {
            this.hide();
        });

        // 清理缓存
        const clearCacheBtn = this.dashboard.querySelector('#clear-cache-btn');
        clearCacheBtn.addEventListener('click', () => {
            this.clearCache();
        });

        // 强制垃圾回收
        const forceGCBtn = this.dashboard.querySelector('#force-gc-btn');
        forceGCBtn.addEventListener('click', () => {
            this.forceGarbageCollection();
        });

        // 导出数据
        const exportBtn = this.dashboard.querySelector('#export-data-btn');
        exportBtn.addEventListener('click', () => {
            this.exportPerformanceData();
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    /**
     * 开始监控
     */
    startMonitoring() {
        this.updateTimer = setInterval(() => {
            this.updateMetrics();
        }, this.config.updateInterval);
        
        this.isVisible = true;
    }

    /**
     * 停止监控
     */
    stopMonitoring() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    /**
     * 更新性能指标
     */
    updateMetrics() {
        // 获取FPS数据
        if (window.performanceOptimizer) {
            const report = performanceOptimizer.getPerformanceReport();
            this.updateFPS(report.fps);
            this.updateRenderTime(report.renderTime);
            this.updateMemory(report.memoryUsage);
            this.updateOptimizationStatus(report.optimizations);
        }

        // 获取网络数据
        if (window.networkManager) {
            const networkStats = networkManager.getNetworkStats();
            this.updateNetworkMetrics(networkStats);
        }

        // 获取设备信息
        if (window.deviceDetector) {
            const deviceInfo = deviceDetector.getDeviceInfo();
            this.updateDeviceInfo(deviceInfo);
        }

        // 获取缓存信息
        if (window.resourceManager) {
            const cacheStats = resourceManager.getCacheStats();
            this.updateCacheInfo(cacheStats);
        }
    }

    /**
     * 更新FPS显示
     */
    updateFPS(fps) {
        const fpsElement = this.dashboard.querySelector('#fps-value');
        const fpsChart = this.dashboard.querySelector('#fps-chart');
        
        if (fpsElement) {
            fpsElement.textContent = fps ? `${fps}` : '--';
            
            // 设置颜色
            fpsElement.className = 'metric-value';
            if (fps >= 55) {
                fpsElement.classList.add('good');
            } else if (fps >= 30) {
                fpsElement.classList.add('warning');
            } else if (fps > 0) {
                fpsElement.classList.add('error');
            }
        }

        // 更新图表
        if (fps !== undefined) {
            this.history.fps.push(fps);
            if (this.history.fps.length > this.config.maxHistoryLength) {
                this.history.fps.shift();
            }
            this.updateChart(fpsChart, this.history.fps, 60);
        }
    }

    /**
     * 更新渲染时间
     */
    updateRenderTime(renderTime) {
        const element = this.dashboard.querySelector('#render-time-value');
        const chart = this.dashboard.querySelector('#render-chart');
        
        if (element && renderTime !== undefined) {
            element.textContent = `${renderTime.toFixed(2)}ms`;
            
            element.className = 'metric-value';
            if (renderTime <= 5) {
                element.classList.add('good');
            } else if (renderTime <= 16) {
                element.classList.add('warning');
            } else {
                element.classList.add('error');
            }
        }

        if (renderTime !== undefined) {
            this.history.renderTime.push(renderTime);
            if (this.history.renderTime.length > this.config.maxHistoryLength) {
                this.history.renderTime.shift();
            }
            this.updateChart(chart, this.history.renderTime, 20);
        }
    }

    /**
     * 更新内存使用
     */
    updateMemory(memoryUsage) {
        const element = this.dashboard.querySelector('#memory-value');
        const chart = this.dashboard.querySelector('#memory-chart');
        
        if (element && memoryUsage !== undefined) {
            element.textContent = `${memoryUsage}MB`;
            
            element.className = 'metric-value';
            if (memoryUsage <= 50) {
                element.classList.add('good');
            } else if (memoryUsage <= 100) {
                element.classList.add('warning');
            } else {
                element.classList.add('error');
            }
        }

        if (memoryUsage !== undefined) {
            this.history.memory.push(memoryUsage);
            if (this.history.memory.length > this.config.maxHistoryLength) {
                this.history.memory.shift();
            }
            this.updateChart(chart, this.history.memory, 200);
        }
    }

    /**
     * 更新网络指标
     */
    updateNetworkMetrics(networkStats) {
        if (!networkStats) return;

        const latencyElement = this.dashboard.querySelector('#latency-value');
        const connectionElement = this.dashboard.querySelector('#connection-value');
        const latencyChart = this.dashboard.querySelector('#latency-chart');

        if (latencyElement && networkStats.latency !== undefined) {
            latencyElement.textContent = `${networkStats.latency}ms`;
            
            latencyElement.className = 'metric-value';
            if (networkStats.latency <= 100) {
                latencyElement.classList.add('good');
            } else if (networkStats.latency <= 300) {
                latencyElement.classList.add('warning');
            } else {
                latencyElement.classList.add('error');
            }

            this.history.networkLatency.push(networkStats.latency);
            if (this.history.networkLatency.length > this.config.maxHistoryLength) {
                this.history.networkLatency.shift();
            }
            this.updateChart(latencyChart, this.history.networkLatency, 500);
        }

        if (connectionElement) {
            connectionElement.textContent = networkStats.quality || 'Unknown';
            connectionElement.className = 'metric-value';
            
            switch (networkStats.quality) {
                case 'excellent':
                    connectionElement.classList.add('good');
                    break;
                case 'good':
                    connectionElement.classList.add('good');
                    break;
                case 'fair':
                    connectionElement.classList.add('warning');
                    break;
                case 'poor':
                    connectionElement.classList.add('error');
                    break;
            }
        }
    }

    /**
     * 更新设备信息
     */
    updateDeviceInfo(deviceInfo) {
        const levelElement = this.dashboard.querySelector('#performance-level');
        
        if (levelElement && deviceInfo.performanceLevel) {
            levelElement.textContent = deviceInfo.performanceLevel;
            levelElement.className = 'metric-value';
            
            switch (deviceInfo.performanceLevel) {
                case 'high':
                    levelElement.classList.add('good');
                    break;
                case 'medium':
                    levelElement.classList.add('warning');
                    break;
                case 'low':
                case 'very_low':
                    levelElement.classList.add('error');
                    break;
            }
        }
    }

    /**
     * 更新优化状态
     */
    updateOptimizationStatus(optimizations) {
        const statusElement = this.dashboard.querySelector('#optimization-status');
        
        if (statusElement && optimizations) {
            const activeOptimizations = Object.values(optimizations).filter(Boolean).length;
            const totalOptimizations = Object.keys(optimizations).length;
            
            statusElement.textContent = `${activeOptimizations}/${totalOptimizations}`;
            statusElement.className = 'metric-value';
            
            if (activeOptimizations >= totalOptimizations * 0.8) {
                statusElement.classList.add('good');
            } else if (activeOptimizations >= totalOptimizations * 0.5) {
                statusElement.classList.add('warning');
            } else {
                statusElement.classList.add('error');
            }
        }
    }

    /**
     * 更新缓存信息
     */
    updateCacheInfo(cacheStats) {
        const cacheElement = this.dashboard.querySelector('#cache-value');
        
        if (cacheElement && cacheStats) {
            const sizeMB = (cacheStats.totalSize / 1024 / 1024).toFixed(1);
            cacheElement.textContent = `${sizeMB}MB (${cacheStats.itemCount})`;
            
            cacheElement.className = 'metric-value';
            if (cacheStats.totalSize <= 10 * 1024 * 1024) { // 10MB
                cacheElement.classList.add('good');
            } else if (cacheStats.totalSize <= 50 * 1024 * 1024) { // 50MB
                cacheElement.classList.add('warning');
            } else {
                cacheElement.classList.add('error');
            }
        }
    }

    /**
     * 更新图表
     */
    updateChart(chartElement, data, maxValue) {
        if (!chartElement || !data.length) return;

        let existingBar = chartElement.querySelector('.chart-bar');
        if (!existingBar) {
            existingBar = document.createElement('div');
            existingBar.className = 'chart-bar';
            chartElement.appendChild(existingBar);
        }

        const latestValue = data[data.length - 1];
        const percentage = Math.min((latestValue / maxValue) * 100, 100);
        existingBar.style.width = `${percentage}%`;
    }

    /**
     * 切换面板显示
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * 显示面板
     */
    show() {
        if (this.dashboard) {
            this.dashboard.style.display = 'block';
            this.startMonitoring();
            this.isVisible = true;
        }
    }

    /**
     * 隐藏面板
     */
    hide() {
        if (this.dashboard) {
            this.dashboard.style.display = 'none';
            this.stopMonitoring();
            this.isVisible = false;
        }
    }

    /**
     * 切换内容显示
     */
    toggleContent() {
        const content = this.dashboard.querySelector('.dashboard-content');
        content.classList.toggle('collapsed');
    }

    /**
     * 清理缓存
     */
    clearCache() {
        if (window.resourceManager) {
            resourceManager.clearAllCache();
            console.log('缓存已清理');
        }
        
        if (window.performanceOptimizer) {
            performanceOptimizer.cleanup();
            console.log('性能优化器缓存已清理');
        }
    }

    /**
     * 强制垃圾回收
     */
    forceGarbageCollection() {
        if (window.performanceOptimizer) {
            performanceOptimizer.suggestGarbageCollection();
            console.log('已建议垃圾回收');
        }
    }

    /**
     * 导出性能数据
     */
    exportPerformanceData() {
        const data = {
            timestamp: new Date().toISOString(),
            history: this.history,
            deviceInfo: window.deviceDetector ? deviceDetector.getDeviceInfo() : null,
            performanceReport: window.performanceOptimizer ? performanceOptimizer.getPerformanceReport() : null
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `tetris-performance-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('性能数据已导出');
    }

    /**
     * 销毁面板
     */
    destroy() {
        this.stopMonitoring();
        
        if (this.dashboard && this.dashboard.parentNode) {
            this.dashboard.parentNode.removeChild(this.dashboard);
        }
        
        this.dashboard = null;
        this.isVisible = false;
    }
}

// 导出性能面板
window.PerformanceDashboard = PerformanceDashboard;