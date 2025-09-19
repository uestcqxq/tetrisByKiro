// 俄罗斯方块游戏 - Canvas渲染系统

// 游戏常量
const GAME_CONFIG = {
    BOARD_WIDTH: 10,
    BOARD_HEIGHT: 20,
    CELL_SIZE: 30,
    CANVAS_WIDTH: 300,  // 10 * 30
    CANVAS_HEIGHT: 600, // 20 * 30
    NEXT_CANVAS_SIZE: 120,
    GRID_LINE_WIDTH: 1,
    BLOCK_BORDER_WIDTH: 2
};

// 颜色主题系统
const COLOR_THEMES = {
    classic: {
        background: '#000000',
        grid: '#333333',
        gridHighlight: '#444444',
        blocks: {
            I: '#00FFFF', // 青色 - I型方块
            O: '#FFFF00', // 黄色 - O型方块
            T: '#800080', // 紫色 - T型方块
            S: '#00FF00', // 绿色 - S型方块
            Z: '#FF0000', // 红色 - Z型方块
            J: '#0000FF', // 蓝色 - J型方块
            L: '#FFA500'  // 橙色 - L型方块
        },
        shadow: '#666666',
        highlight: '#FFFFFF',
        border: '#222222'
    },
    neon: {
        background: '#0a0a0a',
        grid: '#1a1a2e',
        gridHighlight: '#16213e',
        blocks: {
            I: '#00f5ff',
            O: '#ffed4e',
            T: '#d946ef',
            S: '#22c55e',
            Z: '#ef4444',
            J: '#3b82f6',
            L: '#f97316'
        },
        shadow: '#4a5568',
        highlight: '#ffffff',
        border: '#2d3748'
    }
};

// 全局变量
let gameRenderer = null;
let currentUser = null;
let currentTheme = 'classic';

// Canvas渲染器类
class GameRenderer {
    constructor(canvasId, nextCanvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = document.getElementById(nextCanvasId);
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        this.theme = COLOR_THEMES[currentTheme];
        this.animationFrame = null;
        
        // 性能优化相关
        this.lastRenderTime = 0;
        this.frameCount = 0;
        this.dirtyRegions = new Set();
        this.enableOptimizations = true;
        
        // 缓存渲染对象
        this.renderCache = {
            gradients: new Map(),
            patterns: new Map(),
            paths: new Map()
        };
        
        this.initializeCanvas();
        this.setupEventListeners();
        this.setupPerformanceOptimizations();
    }
    
    // 设置性能优化
    setupPerformanceOptimizations() {
        if (window.performanceOptimizer) {
            // 优化Canvas设置
            const optimized = performanceOptimizer.optimizeCanvasRendering(this.canvas, this.ctx);
            this.ctx = optimized.ctx;
            
            // 优化下一个方块Canvas
            const nextOptimized = performanceOptimizer.optimizeCanvasRendering(this.nextCanvas, this.nextCtx);
            this.nextCtx = nextOptimized.ctx;
            
            console.log('Canvas渲染优化已启用');
        }
        
        // 预生成常用渲染对象
        this.preGenerateRenderObjects();
    }
    
    // 预生成渲染对象
    preGenerateRenderObjects() {
        // 预生成渐变
        this.renderCache.gradients.set('block-highlight', 
            this.ctx.createLinearGradient(0, 0, 30, 30));
        
        const blockHighlight = this.renderCache.gradients.get('block-highlight');
        blockHighlight.addColorStop(0, 'rgba(255,255,255,0.3)');
        blockHighlight.addColorStop(1, 'rgba(255,255,255,0.1)');
        
        // 预生成背景渐变
        this.renderCache.gradients.set('background',
            this.ctx.createLinearGradient(0, 0, 0, this.canvas.height));
        
        const bgGradient = this.renderCache.gradients.get('background');
        bgGradient.addColorStop(0, 'rgba(255,255,255,0.02)');
        bgGradient.addColorStop(1, 'rgba(255,255,255,0.01)');
    }
    
    // 初始化Canvas设置
    initializeCanvas() {
        // 主游戏Canvas
        this.canvas.width = GAME_CONFIG.CANVAS_WIDTH;
        this.canvas.height = GAME_CONFIG.CANVAS_HEIGHT;
        
        // 下一个方块预览Canvas
        this.nextCanvas.width = GAME_CONFIG.NEXT_CANVAS_SIZE;
        this.nextCanvas.height = GAME_CONFIG.NEXT_CANVAS_SIZE;
        
        // 设置渲染质量
        this.ctx.imageSmoothingEnabled = false;
        this.nextCtx.imageSmoothingEnabled = false;
        
        // 初始渲染
        this.render();
        this.renderNextPiece();
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // 监听主题切换
        document.addEventListener('themeChanged', (e) => {
            this.setTheme(e.detail.theme);
        });
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    // 设置颜色主题
    setTheme(themeName) {
        if (COLOR_THEMES[themeName]) {
            currentTheme = themeName;
            this.theme = COLOR_THEMES[themeName];
            this.render();
            this.renderNextPiece();
        }
    }
    
    // 处理窗口大小变化
    handleResize() {
        // 在移动设备上调整Canvas大小
        if (window.innerWidth <= 768) {
            const scale = Math.min(window.innerWidth / 320, 1);
            this.canvas.style.transform = `scale(${scale})`;
            this.canvas.style.transformOrigin = 'center top';
        } else {
            this.canvas.style.transform = 'none';
        }
    }
    
    // 主渲染函数
    render(gameBoard = null, currentPiece = null, shadowPiece = null, forceFullRender = false) {
        const startTime = performance.now();
        
        if (this.enableOptimizations && window.performanceOptimizer) {
            // 使用优化渲染
            performanceOptimizer.optimizedRender(this.ctx, (ctx, dirtyRegion) => {
                this.doRender(ctx, gameBoard, currentPiece, shadowPiece, dirtyRegion);
            }, forceFullRender);
        } else {
            // 标准渲染
            this.doRender(this.ctx, gameBoard, currentPiece, shadowPiece);
        }
        
        // 更新性能指标
        this.lastRenderTime = performance.now() - startTime;
        this.frameCount++;
    }
    
    // 实际渲染逻辑
    doRender(ctx, gameBoard, currentPiece, shadowPiece, dirtyRegion = null) {
        if (!dirtyRegion) {
            // 全屏渲染
            this.clearCanvas();
            this.drawBackground();
            this.drawGrid();
        } else {
            // 脏区域渲染
            ctx.clearRect(dirtyRegion.x, dirtyRegion.y, dirtyRegion.width, dirtyRegion.height);
            this.drawBackgroundRegion(dirtyRegion);
            this.drawGridRegion(dirtyRegion);
        }
        
        if (gameBoard) {
            this.drawBoard(gameBoard, dirtyRegion);
        }
        
        if (shadowPiece) {
            this.drawPiece(shadowPiece, true, dirtyRegion);
        }
        
        if (currentPiece) {
            this.drawPiece(currentPiece, false, dirtyRegion);
        }
        
        if (!dirtyRegion) {
            this.drawBorder();
        }
    }
    
    // 添加脏区域
    addDirtyRegion(x, y, width, height) {
        if (this.enableOptimizations && window.performanceOptimizer) {
            performanceOptimizer.addDirtyRegion(x, y, width, height);
        }
    }
    
    // 清空Canvas
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // 绘制背景
    drawBackground() {
        this.ctx.fillStyle = this.theme.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 使用缓存的渐变效果
        if (this.theme.useSimpleColors) {
            // 简化模式，跳过渐变
            return;
        }
        
        const gradient = this.renderCache.gradients.get('background');
        if (gradient) {
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    // 绘制背景区域（用于脏区域渲染）
    drawBackgroundRegion(region) {
        this.ctx.fillStyle = this.theme.background;
        this.ctx.fillRect(region.x, region.y, region.width, region.height);
        
        if (!this.theme.useSimpleColors) {
            const gradient = this.renderCache.gradients.get('background');
            if (gradient) {
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(region.x, region.y, region.width, region.height);
            }
        }
    }
    
    // 绘制游戏网格
    drawGrid() {
        const cellSize = GAME_CONFIG.CELL_SIZE;
        const width = GAME_CONFIG.BOARD_WIDTH;
        const height = GAME_CONFIG.BOARD_HEIGHT;
        
        this.ctx.strokeStyle = this.theme.grid;
        this.ctx.lineWidth = GAME_CONFIG.GRID_LINE_WIDTH;
        
        // 绘制垂直线
        for (let x = 0; x <= width; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * cellSize, 0);
            this.ctx.lineTo(x * cellSize, height * cellSize);
            this.ctx.stroke();
        }
        
        // 绘制水平线
        for (let y = 0; y <= height; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * cellSize);
            this.ctx.lineTo(width * cellSize, y * cellSize);
            this.ctx.stroke();
        }
        
        // 绘制中心线（可选的视觉辅助）
        this.ctx.strokeStyle = this.theme.gridHighlight;
        this.ctx.lineWidth = 1;
        const centerX = Math.floor(width / 2) * cellSize;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(centerX, height * cellSize);
        this.ctx.stroke();
    }
    
    // 绘制游戏板上的固定方块
    drawBoard(board) {
        for (let y = 0; y < board.length; y++) {
            for (let x = 0; x < board[y].length; x++) {
                if (board[y][x] !== 0) {
                    this.drawCell(x, y, board[y][x], false);
                }
            }
        }
    }
    
    // 绘制方块
    drawPiece(piece, isShadow = false) {
        if (!piece || !piece.shape) return;
        
        const { shape, x, y, type } = piece;
        
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px] !== 0) {
                    this.drawCell(x + px, y + py, type, isShadow);
                }
            }
        }
    }
    
    // 绘制单个格子
    drawCell(x, y, blockType, isShadow = false, region = null) {
        const cellSize = GAME_CONFIG.CELL_SIZE;
        const pixelX = x * cellSize;
        const pixelY = y * cellSize;
        
        // 跳过超出边界的格子
        if (x < 0 || x >= GAME_CONFIG.BOARD_WIDTH || 
            y < 0 || y >= GAME_CONFIG.BOARD_HEIGHT) {
            return;
        }
        
        // 脏区域检查
        if (region && !this.isInRegion(pixelX, pixelY, cellSize, cellSize, region)) {
            return;
        }
        
        if (isShadow) {
            // 绘制阴影方块（简化版本）
            this.ctx.fillStyle = this.theme.shadow;
            this.ctx.globalAlpha = 0.3;
            this.ctx.fillRect(pixelX + 1, pixelY + 1, cellSize - 2, cellSize - 2);
            this.ctx.globalAlpha = 1.0;
        } else {
            // 绘制实体方块
            const color = this.theme.blocks[blockType] || this.theme.blocks.I;
            
            // 主体颜色
            this.ctx.fillStyle = color;
            this.ctx.fillRect(pixelX, pixelY, cellSize, cellSize);
            
            // 根据性能设置决定是否绘制3D效果
            if (!this.theme.useSimpleColors && GAME_CONFIG.ENABLE_ANIMATIONS !== false) {
                // 使用缓存的高光渐变
                const highlight = this.renderCache.gradients.get('block-highlight');
                if (highlight) {
                    this.ctx.fillStyle = highlight;
                    this.ctx.fillRect(pixelX, pixelY, cellSize, 3); // 顶部高光
                    this.ctx.fillRect(pixelX, pixelY, 3, cellSize); // 左侧高光
                } else {
                    // 回退到计算颜色
                    this.ctx.fillStyle = this.lightenColor(color, 0.3);
                    this.ctx.fillRect(pixelX, pixelY, cellSize, 3);
                    this.ctx.fillRect(pixelX, pixelY, 3, cellSize);
                }
                
                // 3D效果 - 阴影
                this.ctx.fillStyle = this.darkenColor(color, 0.3);
                this.ctx.fillRect(pixelX, pixelY + cellSize - 3, cellSize, 3);
                this.ctx.fillRect(pixelX + cellSize - 3, pixelY, 3, cellSize);
            }
            
            // 边框（可选）
            if (GAME_CONFIG.BLOCK_BORDER_WIDTH > 0) {
                this.ctx.strokeStyle = this.theme.border;
                this.ctx.lineWidth = GAME_CONFIG.BLOCK_BORDER_WIDTH;
                this.ctx.strokeRect(pixelX, pixelY, cellSize, cellSize);
            }
        }
        
        // 标记为脏区域（用于下次优化）
        this.addDirtyRegion(pixelX, pixelY, cellSize, cellSize);
    }
    
    // 检查是否在指定区域内
    isInRegion(x, y, width, height, region) {
        return !(x + width < region.x || 
                x > region.x + region.width ||
                y + height < region.y || 
                y > region.y + region.height);
    }
    
    // 绘制边框
    drawBorder() {
        this.ctx.strokeStyle = this.theme.highlight;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // 渲染下一个方块预览
    renderNextPiece(nextPiece = null) {
        this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        // 背景
        this.nextCtx.fillStyle = this.theme.background;
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        if (nextPiece && nextPiece.shape) {
            const { shape, type } = nextPiece;
            const cellSize = 20; // 较小的格子用于预览
            
            // 计算居中位置
            const pieceWidth = shape[0].length * cellSize;
            const pieceHeight = shape.length * cellSize;
            const offsetX = (this.nextCanvas.width - pieceWidth) / 2;
            const offsetY = (this.nextCanvas.height - pieceHeight) / 2;
            
            // 绘制方块
            for (let y = 0; y < shape.length; y++) {
                for (let x = 0; x < shape[y].length; x++) {
                    if (shape[y][x] !== 0) {
                        const pixelX = offsetX + x * cellSize;
                        const pixelY = offsetY + y * cellSize;
                        
                        const color = this.theme.blocks[type] || this.theme.blocks.I;
                        
                        // 主体
                        this.nextCtx.fillStyle = color;
                        this.nextCtx.fillRect(pixelX, pixelY, cellSize, cellSize);
                        
                        // 简化的3D效果
                        this.nextCtx.fillStyle = this.lightenColor(color, 0.2);
                        this.nextCtx.fillRect(pixelX, pixelY, cellSize, 2);
                        this.nextCtx.fillRect(pixelX, pixelY, 2, cellSize);
                        
                        // 边框
                        this.nextCtx.strokeStyle = this.theme.border;
                        this.nextCtx.lineWidth = 1;
                        this.nextCtx.strokeRect(pixelX, pixelY, cellSize, cellSize);
                    }
                }
            }
        }
        
        // 预览框边框
        this.nextCtx.strokeStyle = this.theme.grid;
        this.nextCtx.lineWidth = 1;
        this.nextCtx.strokeRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    }
    
    // 颜色工具函数 - 变亮
    lightenColor(color, factor) {
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + Math.round(255 * factor));
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + Math.round(255 * factor));
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + Math.round(255 * factor));
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    // 颜色工具函数 - 变暗
    darkenColor(color, factor) {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - Math.round(255 * factor));
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - Math.round(255 * factor));
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - Math.round(255 * factor));
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    // 添加视觉效果
    addEffect(effectType, x, y, options = {}) {
        switch (effectType) {
            case 'lineClear':
                this.animateLineClear(y, options);
                break;
            case 'levelUp':
                this.animateLevelUp(options);
                break;
            case 'gameOver':
                this.animateGameOver(options);
                break;
        }
    }
    
    // 行消除动画
    animateLineClear(lines, options = {}) {
        const duration = options.duration || 300;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 闪烁效果
            const alpha = Math.sin(progress * Math.PI * 4) * 0.5 + 0.5;
            
            lines.forEach(lineY => {
                this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                this.ctx.fillRect(0, lineY * GAME_CONFIG.CELL_SIZE, 
                                this.canvas.width, GAME_CONFIG.CELL_SIZE);
            });
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    // 升级动画
    animateLevelUp(options = {}) {
        const duration = options.duration || 500;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 边框闪烁
            const intensity = Math.sin(progress * Math.PI * 6) * 0.5 + 0.5;
            this.ctx.strokeStyle = `rgba(76, 175, 80, ${intensity})`;
            this.ctx.lineWidth = 4;
            this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    // 游戏结束动画
    animateGameOver(options = {}) {
        const duration = options.duration || 1000;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 从上到下的覆盖效果
            const coverHeight = this.canvas.height * progress;
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, coverHeight);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
}

// 全局游戏实例和UI管理器
let gameInstance = null;
let uiManager = null;

// 全局性能优化实例
let performanceOptimizer = null;
let resourceManager = null;
let deviceDetector = null;
let performanceDashboard = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('俄罗斯方块游戏初始化...');
    
    // 初始化性能优化系统
    await initializePerformanceOptimization();
    
    // 初始化错误处理和离线支持
    initializeErrorHandlingAndOfflineSupport();
    
    // 初始化渲染器（使用优化设置）
    gameRenderer = new GameRenderer('game-canvas', 'next-canvas');
    
    // 初始化UI管理器
    uiManager = new UIManager();
    
    // 设置网络状态监控
    setupNetworkStatusMonitoring();
    
    // 初始化WebSocket连接
    uiManager.initializeWebSocket();
    
    // 设置重新开始游戏功能
    uiManager.setupRestartGame();
    
    // 初始化用户
    initializeUser();
    
    // 初始化游戏界面
    initializeGameInterface();
    
    // 初始化游戏实例
    initializeGameInstance();
    
    // 演示渲染效果
    demonstrateRendering();
});

// 初始化性能优化系统
async function initializePerformanceOptimization() {
    console.log('初始化性能优化系统...');
    
    try {
        // 初始化设备检测器
        deviceDetector = new DeviceDetector();
        await deviceDetector.initialize();
        
        // 获取优化设置
        const optimizedSettings = deviceDetector.getOptimizedSettings();
        
        // 初始化性能优化器
        performanceOptimizer = new PerformanceOptimizer({
            targetFPS: optimizedSettings.graphics.targetFPS,
            maxAnimations: optimizedSettings.graphics.maxAnimations,
            enableVSync: optimizedSettings.graphics.enableVSync
        });
        
        // 初始化资源管理器
        resourceManager = new ResourceManager({
            enableCompression: optimizedSettings.network.enableCompression
        });
        
        // 监听资源加载进度
        resourceManager.on('progressUpdate', (progress) => {
            updateLoadingProgress(progress);
        });
        
        resourceManager.on('preloadComplete', (state) => {
            console.log('资源预加载完成:', state);
            hideLoadingScreen();
        });
        
        // 显示性能报告
        const performanceReport = deviceDetector.getPerformanceReport();
        console.log('设备性能报告:', performanceReport);
        
        // 应用优化设置到全局配置
        applyOptimizationsToGlobalConfig(optimizedSettings);
        
        // 初始化性能监控面板（仅在开发环境）
        if (window.PerformanceDashboard) {
            performanceDashboard = new PerformanceDashboard({
                showInProduction: false,
                position: 'top-right'
            });
        }
        
    } catch (error) {
        console.error('性能优化系统初始化失败:', error);
        // 使用默认设置继续
        performanceOptimizer = new PerformanceOptimizer();
        resourceManager = new ResourceManager();
    }
}

// 应用优化设置到全局配置
function applyOptimizationsToGlobalConfig(settings) {
    // 更新游戏配置
    if (settings.graphics) {
        GAME_CONFIG.ENABLE_ANIMATIONS = settings.graphics.enableAnimations;
        GAME_CONFIG.MAX_ANIMATIONS = settings.graphics.maxAnimations;
        GAME_CONFIG.TARGET_FPS = settings.graphics.targetFPS;
    }
    
    // 更新颜色主题（根据性能调整）
    if (!settings.graphics.enableGradients) {
        // 简化颜色主题
        for (const theme of Object.values(COLOR_THEMES)) {
            theme.useSimpleColors = true;
        }
    }
    
    console.log('优化设置已应用到全局配置');
}

// 更新加载进度
function updateLoadingProgress(progress) {
    const loadingBar = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');
    
    if (loadingBar) {
        loadingBar.style.width = `${progress.progress * 100}%`;
    }
    
    if (loadingText) {
        loadingText.textContent = `加载中... ${Math.round(progress.progress * 100)}%`;
    }
}

// 隐藏加载屏幕
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

// 初始化错误处理和离线支持
function initializeErrorHandlingAndOfflineSupport() {
    console.log('初始化错误处理和离线支持...');
    
    // 设置错误处理器事件监听
    window.errorHandler.on('online', (data) => {
        console.log('网络已恢复:', data);
        // 尝试同步离线数据
        window.offlineStorage.syncOfflineData();
        // 重新连接WebSocket
        if (window.wsClient && !window.wsClient.isConnected) {
            window.wsClient.connect();
        }
    });
    
    window.errorHandler.on('offline', (data) => {
        console.log('网络已断开:', data);
        // 启用离线模式
        enableOfflineMode();
    });
    
    // 设置网络管理器事件监听
    window.networkManager.on('statusChanged', (data) => {
        console.log('网络状态变化:', data);
        updateNetworkStatusUI(data);
    });
    
    window.networkManager.on('qualityChanged', (data) => {
        console.log('连接质量变化:', data);
        updateConnectionQualityUI(data);
    });
    
    // 设置离线存储事件监听
    window.offlineStorage.on('syncCompleted', (data) => {
        console.log('离线数据同步完成:', data);
        if (data.syncedCount > 0) {
            window.errorHandler.showError({
                type: 'success',
                title: '数据同步完成',
                message: `成功同步 ${data.syncedCount} 条游戏记录`,
                duration: 3000
            });
        }
    });
    
    // 加载离线游戏设置
    loadOfflineGameSettings();
    
    // 检查是否有未完成的游戏进度
    checkForSavedGameProgress();
}

// 启用离线模式
function enableOfflineMode() {
    console.log('启用离线模式');
    
    // 显示离线模式提示
    window.errorHandler.showError({
        type: 'info',
        title: '离线模式',
        message: '游戏将在本地运行，得分将在重新连接后同步',
        duration: 0,
        actions: [{
            text: '了解',
            action: () => {}
        }]
    });
    
    // 更新UI状态
    updateOfflineModeUI(true);
}

// 更新网络状态UI
function updateNetworkStatusUI(statusData) {
    const connectionIndicator = document.getElementById('connection-indicator');
    const connectionText = document.getElementById('connection-text');
    
    if (connectionIndicator && connectionText) {
        if (statusData.isOnline) {
            connectionIndicator.className = 'status-indicator online';
            connectionText.textContent = '已连接';
        } else {
            connectionIndicator.className = 'status-indicator offline';
            connectionText.textContent = '离线';
        }
    }
}

// 更新连接质量UI
function updateConnectionQualityUI(qualityData) {
    const connectionText = document.getElementById('connection-text');
    
    if (connectionText && qualityData.isOnline) {
        const qualityDesc = window.networkManager.getQualityDescription(qualityData.newQuality);
        connectionText.textContent = `已连接 (${qualityDesc})`;
    }
}

// 更新离线模式UI
function updateOfflineModeUI(isOffline) {
    const gameContainer = document.getElementById('game-container');
    
    if (gameContainer) {
        if (isOffline) {
            gameContainer.classList.add('offline-mode');
        } else {
            gameContainer.classList.remove('offline-mode');
        }
    }
}

// 加载离线游戏设置
function loadOfflineGameSettings() {
    try {
        const settings = window.offlineStorage.loadGameSettings();
        if (settings) {
            console.log('加载离线游戏设置:', settings);
            // 应用设置到游戏
            applyGameSettings(settings);
        }
    } catch (error) {
        console.error('加载离线游戏设置失败:', error);
    }
}

// 检查保存的游戏进度
function checkForSavedGameProgress() {
    try {
        const gameProgress = window.offlineStorage.loadGameProgress();
        if (gameProgress) {
            console.log('发现保存的游戏进度:', gameProgress);
            
            // 询问用户是否要恢复游戏
            window.errorHandler.showError({
                type: 'info',
                title: '发现保存的游戏',
                message: '检测到未完成的游戏，是否要继续？',
                duration: 0,
                actions: [
                    {
                        text: '继续游戏',
                        action: () => restoreGameProgress(gameProgress)
                    },
                    {
                        text: '新游戏',
                        action: () => window.offlineStorage.clearGameProgress()
                    }
                ]
            });
        }
    } catch (error) {
        console.error('检查游戏进度失败:', error);
    }
}

// 恢复游戏进度
function restoreGameProgress(gameProgress) {
    try {
        console.log('恢复游戏进度:', gameProgress);
        
        // 这里需要根据实际的游戏实例来恢复状态
        if (gameInstance && gameInstance.restoreState) {
            gameInstance.restoreState(gameProgress);
        }
        
        window.errorHandler.showError({
            type: 'success',
            title: '游戏已恢复',
            message: '已恢复到之前的游戏状态',
            duration: 2000
        });
    } catch (error) {
        console.error('恢复游戏进度失败:', error);
        window.errorHandler.handleGameError(error, { action: 'restore_progress' });
    }
}

// 应用游戏设置
function applyGameSettings(settings) {
    try {
        // 根据设置更新游戏配置
        if (settings.theme && COLOR_THEMES[settings.theme]) {
            currentTheme = COLOR_THEMES[settings.theme];
        }
        
        if (settings.difficulty) {
            // 应用难度设置
        }
        
        console.log('游戏设置已应用');
    } catch (error) {
        console.error('应用游戏设置失败:', error);
    }
}

// 保存游戏进度（在游戏过程中调用）
function saveGameProgress(gameState) {
    try {
        if (window.offlineStorage) {
            window.offlineStorage.saveGameProgress(gameState);
        }
    } catch (error) {
        console.error('保存游戏进度失败:', error);
    }
}

// 保存游戏设置
function saveGameSettings(settings) {
    try {
        if (window.offlineStorage) {
            window.offlineStorage.saveGameSettings(settings);
        }
    } catch (error) {
        console.error('保存游戏设置失败:', error);
    }
}

// 初始化用户
async function initializeUser() {
    try {
        // 首先尝试从离线存储加载用户数据
        let userData = null;
        
        if (window.offlineStorage) {
            userData = window.offlineStorage.loadUserData();
        }
        
        // 如果没有离线数据，检查localStorage
        if (!userData) {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                try {
                    userData = JSON.parse(savedUser);
                } catch (error) {
                    console.error('解析保存的用户数据失败:', error);
                }
            }
        }
        
        // 如果有用户数据，尝试验证
        if (userData && userData.id) {
            try {
                if (navigator.onLine) {
                    const validUser = await apiClient.getUser(userData.id);
                    currentUser = { data: validUser };
                    console.log('使用已保存的用户:', currentUser);
                    updateUserInfo();
                    return;
                }
            } catch (error) {
                console.log('验证用户失败，可能是网络问题:', error);
                // 在离线模式下仍然使用本地用户数据
                if (!navigator.onLine) {
                    currentUser = { data: userData };
                    console.log('离线模式使用本地用户:', currentUser);
                    updateUserInfo();
                    return;
                }
            }
        }
        
        // 创建新用户（仅在在线时）
        if (navigator.onLine) {
            try {
                const newUserData = await apiClient.createUser();
                currentUser = { data: newUserData };
                console.log('用户创建成功:', currentUser);
                
                // 保存到离线存储
                if (window.offlineStorage) {
                    window.offlineStorage.saveUserData(newUserData);
                }
                
                updateUserInfo();
            } catch (error) {
                console.error('创建用户失败:', error);
                window.errorHandler.handleApiError(error, null, { endpoint: '/api/users' });
                
                // 创建临时离线用户
                createOfflineUser();
            }
        } else {
            // 离线模式创建临时用户
            createOfflineUser();
        }
        
    } catch (error) {
        console.error('初始化用户时出错:', error);
        window.errorHandler.handleGameError(error, { action: 'initialize_user' });
        
        // 创建临时离线用户作为后备
        createOfflineUser();
    }
}

// 创建离线用户
function createOfflineUser() {
    const offlineUser = {
        id: 'offline_' + Date.now(),
        username: 'OfflinePlayer_' + Math.random().toString(36).substr(2, 5),
        created_at: new Date().toISOString(),
        is_offline: true
    };
    
    currentUser = { data: offlineUser };
    console.log('创建离线用户:', currentUser);
    
    // 保存到离线存储
    if (window.offlineStorage) {
        window.offlineStorage.saveUserData(offlineUser);
    }
    
    updateUserInfo();
    
    window.errorHandler.showError({
        type: 'info',
        title: '离线模式',
        message: '已创建临时用户，游戏数据将在重新连接后同步',
        duration: 3000
    });
}

// 更新用户信息显示
function updateUserInfo() {
    const userInfoElement = document.getElementById('user-info');
    if (userInfoElement && currentUser && currentUser.data) {
        userInfoElement.textContent = `玩家: ${currentUser.data.username}`;
    }
    
    // 保存用户信息到localStorage
    if (currentUser && currentUser.data) {
        localStorage.setItem('currentUser', JSON.stringify(currentUser.data));
    }
    
    // 设置WebSocket用户信息
    if (window.wsClient && currentUser && currentUser.data) {
        window.wsClient.setUser(currentUser.data);
    }
    
    // 初始化排行榜
    if (uiManager) {
        uiManager.updateLeaderboard();
    }
}

// 初始化游戏界面
function initializeGameInterface() {
    // 设置主题切换（如果需要）
    setupThemeControls();
    
    // 设置基本的UI交互
    setupBasicControls();
}

// 设置主题控制
function setupThemeControls() {
    // 可以添加主题切换按钮的事件监听器
    // 这里暂时使用经典主题
    console.log('当前主题:', currentTheme);
}

// 设置基本控制
function setupBasicControls() {
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            console.log('开始游戏按钮被点击');
            if (gameInstance) {
                gameInstance.start();
                uiManager.showGameStart();
                
                // 通过WebSocket通知游戏开始
                if (currentUser?.data?.id) {
                    uiManager.notifyGameStarted(currentUser.data.id);
                }
                
                // 更新按钮状态
                startBtn.disabled = true;
                pauseBtn.disabled = false;
                
                // 开始更新游戏时间
                startGameTimer();
            }
        });
    }
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            console.log('暂停游戏按钮被点击');
            if (gameInstance) {
                gameInstance.togglePause();
                
                // 更新UI显示
                if (gameInstance.gameState.isPaused) {
                    uiManager.showGamePaused();
                    pauseBtn.textContent = '继续';
                } else {
                    uiManager.hideGamePaused();
                    pauseBtn.textContent = '暂停';
                }
            }
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            console.log('重置游戏按钮被点击');
            if (gameInstance) {
                gameInstance.reset();
                uiManager.cleanup();
                uiManager.showGameStart();
                
                // 重置按钮状态
                startBtn.disabled = false;
                pauseBtn.disabled = true;
                pauseBtn.textContent = '暂停';
                
                // 停止游戏时间更新
                stopGameTimer();
            }
            
            // 重新渲染空白游戏板
            if (gameRenderer) {
                gameRenderer.render();
                gameRenderer.renderNextPiece();
            }
        });
    }
}

// 游戏时间管理
let gameTimer = null;
let gameStartTime = null;

function startGameTimer() {
    gameStartTime = Date.now();
    gameTimer = setInterval(() => {
        if (gameInstance && !gameInstance.gameState.isPaused && !gameInstance.gameState.isGameOver) {
            const gameTime = Date.now() - gameStartTime;
            uiManager.updateTime(gameTime);
        }
    }, 1000);
}

function stopGameTimer() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
    gameStartTime = null;
}

// 初始化游戏实例
function initializeGameInstance() {
    const canvas = document.getElementById('game-canvas');
    if (canvas && typeof TetrisGame !== 'undefined') {
        // 创建游戏实例
        gameInstance = new TetrisGame(canvas);
        
        // 设置游戏回调
        setupGameCallbacks();
        
        // 初始化输入控制器
        gameInstance.initializeInputController();
        
        console.log('游戏实例已初始化');
    }
}

// 设置游戏回调
function setupGameCallbacks() {
    if (!gameInstance || !uiManager) return;
    
    // 设置得分更新回调
    gameInstance.setCallback('scoreUpdate', (score, increase) => {
        uiManager.updateScore(score, increase);
    });
    
    // 设置级别更新回调
    gameInstance.setCallback('levelUpdate', (level, oldLevel) => {
        uiManager.updateLevel(level, oldLevel);
    });
    
    // 设置行数更新回调
    gameInstance.setCallback('linesUpdate', (lines) => {
        uiManager.updateLines(lines);
    });
    
    // 设置游戏结束回调
    gameInstance.setCallback('gameOver', async (gameState) => {
        console.log('游戏结束:', gameState);
        
        // 停止游戏时间更新
        stopGameTimer();
        
        // 准备游戏数据
        const gameData = {
            user_id: currentUser?.data?.id,
            score: gameState.score,
            level: gameState.level,
            lines_cleared: gameState.lines,
            game_duration: Math.floor((Date.now() - gameStartTime) / 1000)
        };
        
        // 通过WebSocket发送游戏结束事件（如果连接可用）
        if (uiManager && gameData.user_id) {
            uiManager.notifyGameFinished(gameData);
        }
        
        // 提交游戏得分（作为备用）
        const scoreSubmitted = await submitGameScore(gameState);
        
        // 显示游戏结束界面
        uiManager.showGameOver(gameState, scoreSubmitted);
        
        // 重置按钮状态
        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        
        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) {
            pauseBtn.disabled = true;
            pauseBtn.textContent = '暂停';
        }
    });
    
    // 监听游戏状态变化以更新下一个方块预览
    const originalSpawnNewTetromino = gameInstance.spawnNewTetromino;
    gameInstance.spawnNewTetromino = function() {
        originalSpawnNewTetromino.call(this);
        const nextTetromino = this.getNextTetromino();
        if (nextTetromino && uiManager) {
            uiManager.updateNextPiece(nextTetromino);
        }
    };
}

// 提交游戏得分
async function submitGameScore(gameState) {
    if (!currentUser || !currentUser.data) {
        console.error('无法提交得分：用户未初始化');
        return false;
    }
    
    try {
        const gameData = {
            user_id: currentUser.data.id,
            score: gameState.score,
            level: gameState.level,
            lines_cleared: gameState.lines,
            game_duration: Math.floor((Date.now() - gameStartTime) / 1000)
        };
        
        console.log('提交游戏得分:', gameData);
        
        const result = await apiClient.submitGameScore(gameData);
        console.log('得分提交成功:', result);
        
        // 更新排行榜
        if (uiManager) {
            uiManager.updateLeaderboard();
            uiManager.updateUserRank();
        }
        
        return true;
        
    } catch (error) {
        console.error('提交游戏得分失败:', error);
        showErrorMessage('得分提交失败: ' + error.getUserFriendlyMessage());
        return false;
    }
}

// 显示错误消息
function showErrorMessage(message) {
    // 创建错误提示元素
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 1000;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(errorDiv);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 3000);
}

// 显示成功消息
function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 1000;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 2000);
}

// 监听网络状态变化
function setupNetworkStatusMonitoring() {
    document.addEventListener('networkStatusChanged', (event) => {
        const { isOnline } = event.detail;
        updateConnectionStatus(isOnline);
        
        if (isOnline) {
            showSuccessMessage('网络连接已恢复');
            // 重新获取排行榜数据
            if (uiManager) {
                uiManager.updateLeaderboard();
            }
        } else {
            showErrorMessage('网络连接已断开，数据将在连接恢复后同步');
        }
    });
}

// 更新连接状态显示
function updateConnectionStatus(isOnline) {
    const indicator = document.getElementById('connection-indicator');
    const text = document.getElementById('connection-text');
    
    if (indicator) {
        indicator.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
    }
    
    if (text) {
        text.textContent = isOnline ? '已连接' : '离线';
    }
}

// 演示渲染效果
function demonstrateRendering() {
    if (!gameRenderer) return;
    
    // 创建一个示例游戏板用于演示
    const demoBoard = Array(20).fill().map(() => Array(10).fill(0));
    
    // 添加一些示例方块
    demoBoard[18] = [0, 'I', 'I', 0, 0, 0, 'O', 'O', 0, 0];
    demoBoard[19] = ['T', 'I', 'I', 'S', 'S', 'Z', 'O', 'O', 'L', 'J'];
    
    // 创建示例当前方块
    const demoPiece = {
        shape: [
            [1, 1, 1],
            [0, 1, 0]
        ],
        x: 3,
        y: 2,
        type: 'T'
    };
    
    // 创建示例下一个方块
    const demoNextPiece = {
        shape: [
            [1, 1],
            [1, 1]
        ],
        type: 'O'
    };
    
    // 渲染演示
    setTimeout(() => {
        gameRenderer.render(demoBoard, demoPiece);
        gameRenderer.renderNextPiece(demoNextPiece);
    }, 1000);
}