/**
 * GameRenderer - 游戏渲染器
 * 负责管理游戏的视觉渲染，包括主游戏区域和预览区域
 */
class GameRenderer {
    constructor(gameCanvasId, nextCanvasId, config = {}) {
        // 获取Canvas元素
        this.gameCanvas = document.getElementById(gameCanvasId);
        this.nextCanvas = document.getElementById(nextCanvasId);
        
        if (!this.gameCanvas || !this.nextCanvas) {
            throw new Error('无法找到必要的Canvas元素');
        }
        
        // 获取渲染上下文
        this.gameCtx = this.gameCanvas.getContext('2d');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        // 渲染配置
        this.config = {
            cellSize: config.cellSize || 30,
            boardWidth: config.boardWidth || 10,
            boardHeight: config.boardHeight || 20,
            nextCanvasSize: config.nextCanvasSize || 120,
            colors: {
                background: '#000000',
                grid: '#222222',
                border: '#333333',
                ghost: 'rgba(255, 255, 255, 0.3)',
                ...config.colors
            },
            effects: {
                enableShadows: config.enableShadows !== false,
                enableGlow: config.enableGlow !== false,
                enableAnimations: config.enableAnimations !== false
            },
            ...config
        };
        
        // 方块颜色映射
        this.tetrominoColors = {
            'I': '#00FFFF', // 青色
            'O': '#FFFF00', // 黄色
            'T': '#800080', // 紫色
            'S': '#00FF00', // 绿色
            'Z': '#FF0000', // 红色
            'J': '#0000FF', // 蓝色
            'L': '#FFA500'  // 橙色
        };
        
        // 渲染状态
        this.renderState = {
            lastRenderTime: 0,
            animationFrame: null,
            needsRedraw: true,
            effects: new Map()
        };
        
        // 初始化Canvas
        this.initializeCanvases();
        
        console.log('GameRenderer 初始化完成');
    }
    
    /**
     * 初始化Canvas设置
     */
    initializeCanvases() {
        // 设置主游戏Canvas
        const gameWidth = this.config.boardWidth * this.config.cellSize;
        const gameHeight = this.config.boardHeight * this.config.cellSize;
        
        this.gameCanvas.width = gameWidth;
        this.gameCanvas.height = gameHeight;
        this.gameCanvas.style.border = `2px solid ${this.config.colors.border}`;
        this.gameCanvas.style.backgroundColor = this.config.colors.background;
        
        // 设置下一个方块预览Canvas
        this.nextCanvas.width = this.config.nextCanvasSize;
        this.nextCanvas.height = this.config.nextCanvasSize;
        this.nextCanvas.style.border = `2px solid ${this.config.colors.border}`;
        this.nextCanvas.style.backgroundColor = this.config.colors.background;
        
        // 设置渲染质量
        this.gameCtx.imageSmoothingEnabled = false;
        this.nextCtx.imageSmoothingEnabled = false;
    }
    
    /**
     * 渲染完整的游戏画面
     */
    render(gameState) {
        if (!gameState) return;
        
        this.renderState.needsRedraw = true;
        
        // 清除主游戏区域
        this.clearCanvas(this.gameCtx, this.gameCanvas.width, this.gameCanvas.height);
        
        // 渲染游戏板
        if (gameState.board) {
            this.renderBoard(gameState.board);
        }
        
        // 渲染幽灵方块（预览位置）
        if (gameState.currentTetromino && gameState.ghostTetromino) {
            this.renderGhostTetromino(gameState.ghostTetromino);
        }
        
        // 渲染当前方块
        if (gameState.currentTetromino) {
            this.renderTetromino(gameState.currentTetromino);
        }
        
        // 渲染网格
        this.renderGrid();
        
        // 渲染下一个方块
        if (gameState.nextTetromino) {
            this.renderNextTetromino(gameState.nextTetromino);
        }
        
        // 渲染特效
        this.renderEffects();
        
        this.renderState.lastRenderTime = performance.now();
    }
    
    /**
     * 清除Canvas
     */
    clearCanvas(ctx, width, height) {
        ctx.fillStyle = this.config.colors.background;
        ctx.fillRect(0, 0, width, height);
    }
    
    /**
     * 渲染游戏板
     */
    renderBoard(board) {
        for (let row = 0; row < board.length; row++) {
            for (let col = 0; col < board[row].length; col++) {
                if (board[row][col]) {
                    const color = this.getCellColor(board[row][col]);
                    this.renderCell(this.gameCtx, col, row, color);
                }
            }
        }
    }
    
    /**
     * 渲染方块
     */
    renderTetromino(tetromino) {
        if (!tetromino || !tetromino.shape) return;
        
        const shape = tetromino.shape;
        const color = tetromino.color || this.tetrominoColors[tetromino.type] || '#888888';
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const x = tetromino.x + col;
                    const y = tetromino.y + row;
                    
                    // 只渲染在游戏区域内的部分
                    if (x >= 0 && x < this.config.boardWidth && y >= 0) {
                        this.renderCell(this.gameCtx, x, y, color, {
                            shadow: this.config.effects.enableShadows,
                            glow: this.config.effects.enableGlow
                        });
                    }
                }
            }
        }
    }
    
    /**
     * 渲染幽灵方块（预览位置）
     */
    renderGhostTetromino(ghostTetromino) {
        if (!ghostTetromino || !ghostTetromino.shape) return;
        
        const shape = ghostTetromino.shape;
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const x = ghostTetromino.x + col;
                    const y = ghostTetromino.y + row;
                    
                    if (x >= 0 && x < this.config.boardWidth && y >= 0 && y < this.config.boardHeight) {
                        this.renderCell(this.gameCtx, x, y, this.config.colors.ghost, {
                            isGhost: true
                        });
                    }
                }
            }
        }
    }
    
    /**
     * 渲染下一个方块
     */
    renderNextTetromino(nextTetromino) {
        if (!nextTetromino || !nextTetromino.shape) return;
        
        // 清除下一个方块Canvas
        this.clearCanvas(this.nextCtx, this.nextCanvas.width, this.nextCanvas.height);
        
        const shape = nextTetromino.shape;
        const color = nextTetromino.color || this.tetrominoColors[nextTetromino.type] || '#888888';
        
        // 计算居中位置
        const shapeWidth = shape[0].length;
        const shapeHeight = shape.length;
        const cellSize = Math.min(
            (this.config.nextCanvasSize - 20) / Math.max(shapeWidth, shapeHeight),
            this.config.cellSize
        );
        
        const offsetX = (this.config.nextCanvasSize - shapeWidth * cellSize) / 2;
        const offsetY = (this.config.nextCanvasSize - shapeHeight * cellSize) / 2;
        
        // 渲染方块
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const x = offsetX + col * cellSize;
                    const y = offsetY + row * cellSize;
                    
                    this.nextCtx.fillStyle = color;
                    this.nextCtx.fillRect(x, y, cellSize, cellSize);
                    
                    // 添加边框
                    this.nextCtx.strokeStyle = this.config.colors.border;
                    this.nextCtx.lineWidth = 1;
                    this.nextCtx.strokeRect(x, y, cellSize, cellSize);
                }
            }
        }
    }
    
    /**
     * 渲染单个单元格
     */
    renderCell(ctx, x, y, color, options = {}) {
        const pixelX = x * this.config.cellSize;
        const pixelY = y * this.config.cellSize;
        const size = this.config.cellSize;
        
        // 设置阴影效果
        if (options.shadow && !options.isGhost) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
        }
        
        // 填充颜色
        ctx.fillStyle = color;
        ctx.fillRect(pixelX, pixelY, size, size);
        
        // 清除阴影
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // 添加边框（除非是幽灵方块）
        if (!options.isGhost) {
            ctx.strokeStyle = this.config.colors.border;
            ctx.lineWidth = 1;
            ctx.strokeRect(pixelX, pixelY, size, size);
            
            // 添加高光效果
            if (options.glow) {
                ctx.strokeStyle = this.lightenColor(color, 0.3);
                ctx.lineWidth = 1;
                ctx.strokeRect(pixelX + 1, pixelY + 1, size - 2, size - 2);
            }
        }
    }
    
    /**
     * 渲染网格线
     */
    renderGrid() {
        const ctx = this.gameCtx;
        ctx.strokeStyle = this.config.colors.grid;
        ctx.lineWidth = 1;
        
        // 垂直线
        for (let x = 0; x <= this.config.boardWidth; x++) {
            const pixelX = x * this.config.cellSize;
            ctx.beginPath();
            ctx.moveTo(pixelX, 0);
            ctx.lineTo(pixelX, this.gameCanvas.height);
            ctx.stroke();
        }
        
        // 水平线
        for (let y = 0; y <= this.config.boardHeight; y++) {
            const pixelY = y * this.config.cellSize;
            ctx.beginPath();
            ctx.moveTo(0, pixelY);
            ctx.lineTo(this.gameCanvas.width, pixelY);
            ctx.stroke();
        }
    }
    
    /**
     * 渲染特效
     */
    renderEffects() {
        const currentTime = performance.now();
        
        // 遍历所有活跃的特效
        for (const [effectId, effect] of this.renderState.effects) {
            if (currentTime - effect.startTime > effect.duration) {
                // 特效已过期，移除
                this.renderState.effects.delete(effectId);
                continue;
            }
            
            // 渲染特效
            this.renderEffect(effect, currentTime);
        }
    }
    
    /**
     * 渲染单个特效
     */
    renderEffect(effect, currentTime) {
        const progress = (currentTime - effect.startTime) / effect.duration;
        const ctx = this.gameCtx;
        
        switch (effect.type) {
            case 'lineClear':
                this.renderLineClearEffect(effect, progress, ctx);
                break;
            case 'levelUp':
                this.renderLevelUpEffect(effect, progress, ctx);
                break;
            case 'combo':
                this.renderComboEffect(effect, progress, ctx);
                break;
        }
    }
    
    /**
     * 渲染行消除特效
     */
    renderLineClearEffect(effect, progress, ctx) {
        const alpha = 1 - progress;
        const rows = effect.rows || [];
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        for (const row of rows) {
            const y = row * this.config.cellSize;
            
            // 闪烁效果
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
            ctx.fillRect(0, y, this.gameCanvas.width, this.config.cellSize);
        }
        
        ctx.restore();
    }
    
    /**
     * 渲染升级特效
     */
    renderLevelUpEffect(effect, progress, ctx) {
        const alpha = 1 - progress;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
        
        // 从中心向外扩散的圆形效果
        const centerX = this.gameCanvas.width / 2;
        const centerY = this.gameCanvas.height / 2;
        const radius = progress * Math.max(this.gameCanvas.width, this.gameCanvas.height);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }
    
    /**
     * 渲染连击特效
     */
    renderComboEffect(effect, progress, ctx) {
        const alpha = 1 - progress;
        const scale = 1 + progress * 0.5;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(this.gameCanvas.width / 2, this.gameCanvas.height / 2);
        ctx.scale(scale, scale);
        
        ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`COMBO x${effect.combo}`, 0, 0);
        
        ctx.restore();
    }
    
    /**
     * 添加特效
     */
    addEffect(type, options = {}) {
        const effectId = Date.now() + Math.random();
        const effect = {
            type,
            startTime: performance.now(),
            duration: options.duration || 1000,
            ...options
        };
        
        this.renderState.effects.set(effectId, effect);
        return effectId;
    }
    
    /**
     * 移除特效
     */
    removeEffect(effectId) {
        this.renderState.effects.delete(effectId);
    }
    
    /**
     * 获取单元格颜色
     */
    getCellColor(cellValue) {
        return this.tetrominoColors[cellValue] || '#888888';
    }
    
    /**
     * 颜色变亮
     */
    lightenColor(color, amount) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * amount * 100);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
    
    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.initializeCanvases();
    }
    
    /**
     * 获取渲染统计信息
     */
    getRenderStats() {
        return {
            lastRenderTime: this.renderState.lastRenderTime,
            activeEffects: this.renderState.effects.size,
            needsRedraw: this.renderState.needsRedraw
        };
    }
    
    /**
     * 销毁渲染器
     */
    destroy() {
        // 清除所有特效
        this.renderState.effects.clear();
        
        // 取消动画帧
        if (this.renderState.animationFrame) {
            cancelAnimationFrame(this.renderState.animationFrame);
        }
        
        console.log('GameRenderer 已销毁');
    }
}

// 导出类
window.GameRenderer = GameRenderer;
console.log('GameRenderer 模块加载完成');