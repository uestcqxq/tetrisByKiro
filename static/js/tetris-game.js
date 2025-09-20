/**
 * TetrisGame - 俄罗斯方块游戏主类，管理游戏状态和主循环
 */
class TetrisGame {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // 游戏配置
        this.config = {
            boardWidth: config.boardWidth || 10,
            boardHeight: config.boardHeight || 20,
            cellSize: config.cellSize || 30,
            initialSpeed: config.initialSpeed || 1000, // 毫秒
            speedIncrease: config.speedIncrease || 0.9, // 速度增加倍数
            ...config
        };

        // 初始化游戏组件
        this.tetrominoManager = new TetrominoManager();
        this.boardManager = new BoardManager(this.config.boardWidth, this.config.boardHeight);
        this.scoringSystem = new ScoringSystem();
        this.uiManager = new UIManager();
        
        // 游戏状态
        this.gameState = {
            isRunning: false,
            isPaused: false,
            isGameOver: false,
            currentTetromino: null,
            nextTetromino: null,
            dropTime: 0,
            lastTime: 0,
            dropInterval: this.config.initialSpeed
        };

        // 游戏循环相关
        this.animationId = null;
        this.lastFrameTime = 0;
        
        // 事件回调
        this.callbacks = {
            onScoreUpdate: null,
            onLevelUpdate: null,
            onLinesUpdate: null,
            onGameOver: null,
            onLineClear: null
        };

        // 设置积分系统回调
        this.setupScoringCallbacks();

        // 设置canvas尺寸
        this.setupCanvas();
        
        // 初始化输入控制器
        this.inputController = null;
    }

    /**
     * 设置canvas尺寸和样式
     */
    setupCanvas() {
        const canvasWidth = this.config.boardWidth * this.config.cellSize;
        const canvasHeight = this.config.boardHeight * this.config.cellSize;
        
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        this.canvas.style.border = '2px solid #333';
        this.canvas.style.backgroundColor = '#000';
    }

    /**
     * 初始化输入控制系统
     */
    initializeInputController() {
        // 延迟加载InputController以确保类已定义
        if (typeof InputController !== 'undefined') {
            this.inputController = new InputController(this);
            console.log('输入控制器已初始化');
        } else {
            console.warn('InputController类未找到，使用基础键盘控制');
            this.setupBasicControls();
        }
    }

    /**
     * 基础键盘控制（备用方案）
     */
    setupBasicControls() {
        this.keyState = {};
        
        document.addEventListener('keydown', (e) => {
            if (this.gameState.isGameOver) return;
            
            const key = e.code;
            if (this.keyState[key]) return;
            
            this.keyState[key] = true;
            this.processBasicKeyInput(key);
            e.preventDefault();
        });
        
        document.addEventListener('keyup', (e) => {
            this.keyState[e.code] = false;
        });
    }

    /**
     * 处理基础键盘输入
     */
    processBasicKeyInput(key) {
        if (!this.gameState.currentTetromino) return;

        switch (key) {
            case 'ArrowLeft':
                this.moveTetromino(-1, 0);
                break;
            case 'ArrowRight':
                this.moveTetromino(1, 0);
                break;
            case 'ArrowDown':
                this.moveTetromino(0, 1);
                break;
            case 'ArrowUp':
            case 'KeyX':
                this.rotateTetromino('clockwise');
                break;
            case 'KeyZ':
                this.rotateTetromino('counterclockwise');
                break;
            case 'Space':
                this.hardDrop();
                break;
            case 'KeyP':
                this.togglePause();
                break;
        }
    }

    /**
     * 设置积分系统回调
     */
    setupScoringCallbacks() {
        this.scoringSystem.setCallback('scoreUpdate', (score, increase) => {
            this.uiManager.updateScore(score, increase);
            if (this.callbacks.onScoreUpdate) {
                this.callbacks.onScoreUpdate(score, increase);
            }
        });

        this.scoringSystem.setCallback('levelUpdate', (level, oldLevel) => {
            this.gameState.dropInterval = this.scoringSystem.getDropSpeed();
            this.uiManager.updateLevel(level, oldLevel);
            if (this.callbacks.onLevelUpdate) {
                this.callbacks.onLevelUpdate(level, oldLevel);
            }
        });

        this.scoringSystem.setCallback('comboUpdate', (combo) => {
            this.uiManager.updateCombo(combo);
        });

        this.scoringSystem.setCallback('scoreAnimation', (animation) => {
            this.uiManager.showScoreAnimation(animation);
        });

        // 设置难度管理器回调
        const difficultyManager = this.scoringSystem.getDifficultyManager();
        difficultyManager.setCallback('levelUp', (newLevel, oldLevel, levelsGained) => {
            const difficultyInfo = difficultyManager.getDifficultyInfo();
            this.uiManager.showLevelUpDetails({
                newLevel,
                oldLevel,
                levelsGained,
                newSpeed: difficultyInfo.dropSpeed,
                oldSpeed: this.gameState.dropInterval,
                difficultyRating: difficultyInfo.rating
            });
        });

        difficultyManager.setCallback('difficultyChange', (difficultyInfo) => {
            this.uiManager.updateDifficultyIndicator(difficultyInfo);
        });
    }

    /**
     * 开始游戏
     */
    start() {
        this.reset();
        this.gameState.isRunning = true;
        this.gameState.isPaused = false;
        this.gameState.isGameOver = false;
        
        // 初始化积分系统
        this.scoringSystem.reset();
        this.scoringSystem.startGame();
        
        // 初始化输入控制器
        if (!this.inputController) {
            this.initializeInputController();
        }
        
        // 生成初始方块
        this.spawnNewTetromino();
        this.generateNextTetromino();
        
        // 开始游戏循环
        this.lastFrameTime = performance.now();
        this.gameLoop();
    }

    /**
     * 暂停/恢复游戏
     */
    togglePause() {
        if (!this.gameState.isRunning || this.gameState.isGameOver) {
            return;
        }
        
        this.gameState.isPaused = !this.gameState.isPaused;
        
        if (!this.gameState.isPaused) {
            this.lastFrameTime = performance.now();
            this.gameLoop();
        }
    }

    /**
     * 重置游戏
     */
    reset() {
        this.boardManager.reset();
        this.scoringSystem.reset();
        this.uiManager.cleanup();
        
        this.gameState = {
            isRunning: false,
            isPaused: false,
            isGameOver: false,
            currentTetromino: null,
            nextTetromino: null,
            dropTime: 0,
            lastTime: 0,
            dropInterval: this.config.initialSpeed
        };
        
        // 清除输入控制器
        if (this.inputController) {
            this.inputController.destroy();
        }
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * 游戏主循环
     */
    gameLoop(currentTime = performance.now()) {
        if (!this.gameState.isRunning || this.gameState.isPaused || this.gameState.isGameOver) {
            return;
        }

        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        // 更新游戏逻辑
        this.update(deltaTime);
        
        // 渲染游戏
        this.render();
        
        // 继续游戏循环
        this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
    }

    /**
     * 更新游戏逻辑
     */
    update(deltaTime) {
        if (!this.gameState.currentTetromino) {
            return;
        }

        // 更新下落时间
        this.gameState.dropTime += deltaTime;
        
        // 检查是否需要自动下落
        if (this.gameState.dropTime >= this.gameState.dropInterval) {
            this.dropTetromino();
            this.gameState.dropTime = 0;
        }
    }

    /**
     * 生成新方块
     */
    spawnNewTetromino() {
        this.gameState.currentTetromino = this.gameState.nextTetromino || 
                                         this.tetrominoManager.generateRandomTetromino();
        this.generateNextTetromino();
        
        // 检查游戏是否结束
        if (this.tetrominoManager.checkCollision(this.gameState.currentTetromino, this.boardManager.board)) {
            this.gameOver();
        }
    }

    /**
     * 生成下一个方块
     */
    generateNextTetromino() {
        this.gameState.nextTetromino = this.tetrominoManager.generateRandomTetromino();
    }

    /**
     * 移动方块
     */
    moveTetromino(deltaX, deltaY) {
        const moved = this.tetrominoManager.moveTetromino(
            this.gameState.currentTetromino,
            deltaX,
            deltaY,
            this.boardManager.board
        );
        
        if (moved) {
            this.gameState.currentTetromino = moved;
            return true;
        }
        return false;
    }

    /**
     * 旋转方块
     */
    rotateTetromino(direction = 'clockwise') {
        const rotated = this.tetrominoManager.tryRotate(
            this.gameState.currentTetromino,
            this.boardManager.board,
            direction
        );
        
        if (rotated) {
            this.gameState.currentTetromino = rotated;
            return true;
        }
        return false;
    }

    /**
     * 方块自动下落
     */
    dropTetromino() {
        if (!this.moveTetromino(0, 1)) {
            // 无法继续下落，放置方块
            this.placeTetromino();
        }
    }

    /**
     * 硬降落（瞬间降落到底部）
     */
    hardDrop() {
        const ghost = this.tetrominoManager.getGhostTetromino(
            this.gameState.currentTetromino,
            this.boardManager.board
        );
        
        // 计算下落距离并增加分数
        const dropDistance = ghost.y - this.gameState.currentTetromino.y;
        this.scoringSystem.processHardDrop(dropDistance);
        
        this.gameState.currentTetromino = ghost;
        this.placeTetromino();
    }

    /**
     * 放置方块到游戏板
     */
    placeTetromino() {
        this.boardManager.placeTetromino(this.gameState.currentTetromino);
        
        // 增加方块计数
        this.scoringSystem.incrementPieceCount();
        
        // 清除完整的行
        const linesCleared = this.boardManager.clearLines();
        if (linesCleared > 0) {
            this.handleLinesCleared(linesCleared);
        } else {
            // 没有消除行时，重置连击
            this.scoringSystem.processLineClears(0);
        }
        
        // 生成新方块
        this.spawnNewTetromino();
    }

    /**
     * 处理行消除
     */
    handleLinesCleared(linesCleared) {
        // 检查是否为完美清除（游戏板完全清空）
        const isPerfectClear = this.boardManager.isEmpty();
        
        // 使用积分系统处理行消除
        const scoreResult = this.scoringSystem.processLineClears(linesCleared, {
            isPerfectClear: isPerfectClear,
            boardState: this.boardManager.board
        });
        
        // 更新UI显示
        this.uiManager.updateLines(this.scoringSystem.getGameStats().lines);
        this.uiManager.updateLevelProgress(this.scoringSystem.getLevelProgress());
        
        // 触发回调
        if (this.callbacks.onLinesUpdate) {
            this.callbacks.onLinesUpdate(this.scoringSystem.getGameStats().lines);
        }
        if (this.callbacks.onLineClear) {
            this.callbacks.onLineClear(linesCleared, scoreResult);
        }
    }

    /**
     * 游戏结束
     */
    gameOver() {
        this.gameState.isGameOver = true;
        this.gameState.isRunning = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // 显示最终统计
        const finalStats = this.scoringSystem.getGameStats();
        this.uiManager.showGameStats(finalStats);
        
        if (this.callbacks.onGameOver) {
            this.callbacks.onGameOver({
                ...this.gameState,
                ...finalStats
            });
        }
    }

    /**
     * 渲染游戏
     */
    render() {
        // 清除画布
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 渲染游戏板
        this.renderBoard();
        
        // 渲染当前方块
        if (this.gameState.currentTetromino) {
            this.renderTetromino(this.gameState.currentTetromino);
        }
        
        // 渲染网格线
        this.renderGrid();
    }

    /**
     * 渲染游戏板
     */
    renderBoard() {
        const board = this.boardManager.board;
        
        for (let row = 0; row < board.length; row++) {
            for (let col = 0; col < board[row].length; col++) {
                if (board[row][col]) {
                    this.renderCell(col, row, this.getCellColor(board[row][col]));
                }
            }
        }
    }

    /**
     * 渲染方块
     */
    renderTetromino(tetromino) {
        const shape = tetromino.shape;
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const x = tetromino.x + col;
                    const y = tetromino.y + row;
                    this.renderCell(x, y, tetromino.color);
                }
            }
        }
    }

    /**
     * 渲染单个单元格
     */
    renderCell(x, y, color) {
        const pixelX = x * this.config.cellSize;
        const pixelY = y * this.config.cellSize;
        
        this.ctx.fillStyle = color;
        this.ctx.fillRect(pixelX, pixelY, this.config.cellSize, this.config.cellSize);
        
        // 添加边框
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(pixelX, pixelY, this.config.cellSize, this.config.cellSize);
    }

    /**
     * 渲染网格线
     */
    renderGrid() {
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 1;
        
        // 垂直线
        for (let x = 0; x <= this.config.boardWidth; x++) {
            const pixelX = x * this.config.cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(pixelX, 0);
            this.ctx.lineTo(pixelX, this.canvas.height);
            this.ctx.stroke();
        }
        
        // 水平线
        for (let y = 0; y <= this.config.boardHeight; y++) {
            const pixelY = y * this.config.cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(0, pixelY);
            this.ctx.lineTo(this.canvas.width, pixelY);
            this.ctx.stroke();
        }
    }

    /**
     * 获取单元格颜色
     */
    getCellColor(cellValue) {
        const colors = {
            'I': '#00FFFF',
            'O': '#FFFF00',
            'T': '#800080',
            'S': '#00FF00',
            'Z': '#FF0000',
            'J': '#0000FF',
            'L': '#FFA500'
        };
        return colors[cellValue] || '#888';
    }

    /**
     * 设置事件回调
     */
    setCallback(event, callback) {
        if (this.callbacks.hasOwnProperty('on' + event.charAt(0).toUpperCase() + event.slice(1))) {
            this.callbacks['on' + event.charAt(0).toUpperCase() + event.slice(1)] = callback;
        }
    }

    /**
     * 获取游戏状态
     */
    getGameState() {
        return { 
            ...this.gameState,
            ...this.scoringSystem.getGameStats()
        };
    }

    /**
     * 获取下一个方块
     */
    getNextTetromino() {
        return this.gameState.nextTetromino;
    }
}

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TetrisGame;
}

// 导出到全局作用域供浏览器使用
window.TetrisGame = TetrisGame;
console.log('TetrisGame 模块加载完成');