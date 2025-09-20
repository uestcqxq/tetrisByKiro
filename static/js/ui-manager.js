/**
 * UIManager - 游戏界面管理器
 * 负责更新得分、级别显示和积分动画效果
 */
class UIManager {
    constructor(config = {}) {
        this.config = {
            animationDuration: 2000,
            scoreAnimationClass: 'score-animation',
            levelUpAnimationClass: 'level-up-animation',
            comboAnimationClass: 'combo-animation',
            ...config
        };

        // DOM元素引用
        this.elements = {
            score: null,
            level: null,
            lines: null,
            nextPiece: null,
            gameInfo: null,
            animationContainer: null
        };

        // 动画队列
        this.activeAnimations = new Map();
        
        // 初始化DOM元素
        this.initializeElements();
    }

    /**
     * 初始化DOM元素
     */
    initializeElements() {
        // 查找或创建必要的DOM元素
        this.elements.score = document.getElementById('score') || this.createElement('score');
        this.elements.level = document.getElementById('level') || this.createElement('level');
        this.elements.lines = document.getElementById('lines') || this.createElement('lines');
        this.elements.time = document.getElementById('time') || this.createElement('time');
        this.elements.nextPiece = document.getElementById('next-canvas') || this.createElement('next-canvas');
        this.elements.gameInfo = document.querySelector('.info-panel') || this.createElement('game-info');
        
        // 创建动画容器
        this.elements.animationContainer = document.getElementById('score-animations') || 
                                         this.createAnimationContainer();
        
        // 初始化下一个方块预览
        this.initializeNextPiecePreview();
    }

    /**
     * 创建DOM元素
     * @param {string} id - 元素ID
     * @returns {HTMLElement} 创建的元素
     */
    createElement(id) {
        const element = document.createElement('div');
        element.id = id;
        element.className = `game-${id}`;
        
        // 添加到游戏信息容器
        if (this.elements.gameInfo) {
            this.elements.gameInfo.appendChild(element);
        } else {
            document.body.appendChild(element);
        }
        
        return element;
    }

    /**
     * 创建动画容器
     * @returns {HTMLElement} 动画容器元素
     */
    createAnimationContainer() {
        const container = document.createElement('div');
        container.id = 'score-animations';
        container.className = 'score-animations-container';
        container.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
        `;
        
        document.body.appendChild(container);
        return container;
    }

    /**
     * 更新得分显示
     * @param {number} score - 当前得分
     * @param {number} scoreIncrease - 本次增加的分数
     */
    updateScore(score, scoreIncrease = 0) {
        if (this.elements.score) {
            this.elements.score.textContent = this.formatNumber(score);
            
            // 如果有分数增加，添加动画效果
            if (scoreIncrease > 0) {
                this.animateScoreIncrease(scoreIncrease);
            }
        }
    }

    /**
     * 更新级别显示
     * @param {number} level - 当前级别
     * @param {number} oldLevel - 之前的级别
     */
    updateLevel(level, oldLevel = null) {
        if (this.elements.level) {
            this.elements.level.textContent = level;
            
            // 如果级别提升，显示升级动画
            if (oldLevel !== null && level > oldLevel) {
                this.animateLevelUp(level);
            }
        }
    }

    /**
     * 更新行数显示
     * @param {number} lines - 消除的总行数
     */
    updateLines(lines) {
        if (this.elements.lines) {
            this.elements.lines.textContent = lines;
        }
    }

    /**
     * 更新游戏时间显示
     * @param {number} gameTime - 游戏时间（毫秒）
     */
    updateTime(gameTime) {
        if (this.elements.time) {
            this.elements.time.textContent = this.formatTime(gameTime);
        }
    }

    /**
     * 更新连击显示
     * @param {number} combo - 连击数
     */
    updateCombo(combo) {
        // 如果连击数大于1，显示连击效果
        if (combo > 1) {
            this.showComboAnimation(combo);
        }
    }

    /**
     * 显示连击动画
     * @param {number} combo - 连击数
     */
    showComboAnimation(combo) {
        const comboElement = document.createElement('div');
        comboElement.className = 'combo-animation';
        comboElement.textContent = `COMBO x${combo}!`;
        comboElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 24px;
            font-weight: bold;
            color: #ff6b35;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            z-index: 1000;
            animation: comboFade 2s ease-out forwards;
            pointer-events: none;
        `;

        // 添加CSS动画
        if (!document.getElementById('combo-animation-style')) {
            const style = document.createElement('style');
            style.id = 'combo-animation-style';
            style.textContent = `
                @keyframes comboFade {
                    0% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1.2);
                    }
                    50% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.8);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(comboElement);

        // 自动清理
        setTimeout(() => {
            if (comboElement.parentNode) {
                comboElement.parentNode.removeChild(comboElement);
            }
        }, 2000);
    }

    /**
     * 显示升级详情
     * @param {object} details - 升级详情对象
     */
    showLevelUpDetails(details) {
        console.log('Level up details:', details);
        // 可以在这里添加更详细的升级显示逻辑
        this.animateLevelUp(details.newLevel);
    }

    /**
     * 更新难度指示器
     * @param {object} difficultyInfo - 难度信息
     */
    updateDifficultyIndicator(difficultyInfo) {
        console.log('Difficulty info:', difficultyInfo);
        // 可以在这里添加难度指示器的更新逻辑
    }

    /**
     * 更新级别进度
     * @param {object} progress - 进度信息
     */
    updateLevelProgress(progress) {
        const progressElement = document.getElementById('level-progress');
        if (progressElement && progress) {
            const percentage = (progress.current / progress.target) * 100;
            progressElement.style.width = `${Math.min(percentage, 100)}%`;
        }
    }

    /**
     * 显示游戏统计
     * @param {object} stats - 游戏统计信息
     */
    showGameStats(stats) {
        console.log('Game stats:', stats);
        this.showGameOver(stats, false);
    }

    /**
     * 清理UI元素
     */
    cleanup() {
        // 清除所有动画
        this.activeAnimations.clear();
        
        // 清除动画容器中的元素
        if (this.elements.animationContainer) {
            this.elements.animationContainer.innerHTML = '';
        }
        
        // 隐藏游戏结束相关元素
        this.hideGameOverElements();
        this.hideGamePaused();
    }

    /**
     * 格式化数字显示
     * @param {number} number - 要格式化的数字
     * @returns {string} 格式化后的字符串
     */
    formatNumber(number) {
        return number.toLocaleString();
    }

    /**
     * 格式化时间显示
     * @param {number} milliseconds - 毫秒数
     * @returns {string} 格式化的时间字符串
     */
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * 显示分数增加动画
     * @param {number} scoreIncrease - 增加的分数
     */
    animateScoreIncrease(scoreIncrease) {
        if (this.elements.score) {
            this.elements.score.classList.add('score-increase');
            setTimeout(() => {
                this.elements.score.classList.remove('score-increase');
            }, 500);
        }
    }

    /**
     * 显示得分动画
     * @param {object} animation - 动画配置对象
     */
    showScoreAnimation(animation) {
        if (!animation) return;
        
        const { type, value, position, duration = 1000 } = animation;
        
        // 创建动画元素
        const animationElement = document.createElement('div');
        animationElement.className = `score-animation ${type}`;
        animationElement.textContent = `+${value}`;
        
        // 设置样式
        animationElement.style.cssText = `
            position: absolute;
            color: #FFD700;
            font-weight: bold;
            font-size: 18px;
            pointer-events: none;
            z-index: 1000;
            animation: scoreFloat ${duration}ms ease-out forwards;
        `;
        
        // 设置位置
        if (position) {
            animationElement.style.left = `${position.x}px`;
            animationElement.style.top = `${position.y}px`;
        } else {
            // 默认位置在得分显示附近
            const scoreElement = this.elements.score;
            if (scoreElement) {
                const rect = scoreElement.getBoundingClientRect();
                animationElement.style.left = `${rect.right + 10}px`;
                animationElement.style.top = `${rect.top}px`;
            }
        }
        
        // 添加到页面
        document.body.appendChild(animationElement);
        
        // 自动清理
        setTimeout(() => {
            if (animationElement.parentNode) {
                animationElement.parentNode.removeChild(animationElement);
            }
        }, duration);
    }

    /**
     * 显示级别提升动画
     * @param {number} newLevel - 新级别
     */
    animateLevelUp(newLevel) {
        // 创建级别提升通知
        const notification = document.createElement('div');
        notification.className = 'level-up-notification';
        notification.innerHTML = `
            <div class="level-up-text">LEVEL UP!</div>
            <div class="level-up-number">${newLevel}</div>
        `;
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(45deg, #FFD700, #FFA500);
            color: #000;
            padding: 20px;
            border-radius: 10px;
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            z-index: 2000;
            box-shadow: 0 4px 20px rgba(255, 215, 0, 0.5);
            animation: levelUpPulse 2s ease-out forwards;
        `;
        
        document.body.appendChild(notification);
        
        // 自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
    }

    /**
     * 初始化下一个方块预览
     */
    initializeNextPiecePreview() {
        this.nextCanvas = document.getElementById('next-canvas');
        if (this.nextCanvas) {
            this.nextCtx = this.nextCanvas.getContext('2d');
            this.nextCellSize = 20; // 预览方块的单元格大小
        }
    }

    /**
     * 更新下一个方块预览
     * @param {object} nextTetromino - 下一个方块对象
     */
    updateNextPiece(nextTetromino) {
        if (!this.nextCanvas || !this.nextCtx || !nextTetromino) {
            return;
        }

        // 清除画布
        this.nextCtx.fillStyle = '#000';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);

        // 获取方块形状和颜色
        const shape = nextTetromino.shape;
        const color = nextTetromino.color;

        // 计算居中位置
        const shapeWidth = shape[0].length * this.nextCellSize;
        const shapeHeight = shape.length * this.nextCellSize;
        const offsetX = (this.nextCanvas.width - shapeWidth) / 2;
        const offsetY = (this.nextCanvas.height - shapeHeight) / 2;

        // 渲染方块
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const x = offsetX + col * this.nextCellSize;
                    const y = offsetY + row * this.nextCellSize;
                    
                    // 填充方块
                    this.nextCtx.fillStyle = color;
                    this.nextCtx.fillRect(x, y, this.nextCellSize, this.nextCellSize);
                    
                    // 添加边框
                    this.nextCtx.strokeStyle = '#333';
                    this.nextCtx.lineWidth = 1;
                    this.nextCtx.strokeRect(x, y, this.nextCellSize, this.nextCellSize);
                }
            }
        }
    }

    /**
     * 显示游戏开始界面
     */
    showGameStart() {
        // 重置所有显示
        this.updateScore(0);
        this.updateLevel(1);
        this.updateLines(0);
        this.updateTime(0);
        
        // 清除下一个方块预览
        if (this.nextCanvas && this.nextCtx) {
            this.nextCtx.fillStyle = '#000';
            this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        }
        
        // 隐藏游戏结束相关元素
        this.hideGameOverElements();
    }

    /**
     * 显示游戏暂停界面
     */
    showGamePaused() {
        const overlay = document.getElementById('game-overlay');
        const title = document.getElementById('overlay-title');
        const message = document.getElementById('overlay-message');
        
        if (overlay && title && message) {
            title.textContent = '游戏暂停';
            message.textContent = '按空格键继续游戏';
            overlay.classList.remove('hidden');
        }
    }

    /**
     * 隐藏游戏暂停界面
     */
    hideGamePaused() {
        const overlay = document.getElementById('game-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    /**
     * 隐藏游戏结束相关元素
     */
    hideGameOverElements() {
        const elementsToHide = [
            'game-over-modal',
            'final-score-display',
            'leaderboard-modal'
        ];
        
        elementsToHide.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
            }
        });
    }

    /**
     * 显示游戏结束界面
     * @param {object} gameStats - 游戏统计数据
     * @param {boolean} scoreSubmitted - 得分是否已提交
     */
    showGameOver(gameStats, scoreSubmitted = false) {
        // 创建游戏结束模态框
        const modal = this.createGameOverModal(gameStats, scoreSubmitted);
        document.body.appendChild(modal);
        
        // 显示模态框
        setTimeout(() => {
            modal.classList.add('show');
        }, 100);
        
        // 更新排行榜
        this.updateLeaderboard();
        
        // 更新用户排名
        this.updateUserRank();
    }

    /**
     * 创建游戏结束模态框
     * @param {object} gameStats - 游戏统计数据
     * @param {boolean} scoreSubmitted - 得分是否已提交
     * @returns {HTMLElement} 模态框元素
     */
    createGameOverModal(gameStats, scoreSubmitted = false) {
        const modal = document.createElement('div');
        modal.id = 'game-over-modal';
        modal.className = 'game-over-modal';
        
        const submissionStatus = scoreSubmitted ? 
            '<div class="submission-success">✓ 得分已保存</div>' : 
            '<div class="submission-failed">⚠ 得分保存失败</div>';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>游戏结束</h2>
                    ${submissionStatus}
                </div>
                <div class="final-stats">
                    <div class="stat-row">
                        <span class="stat-label">最终得分:</span>
                        <span class="stat-value">${this.formatNumber(gameStats.score || 0)}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">达到级别:</span>
                        <span class="stat-value">${gameStats.level || 1}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">消除行数:</span>
                        <span class="stat-value">${gameStats.lines || 0}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">游戏时长:</span>
                        <span class="stat-value">${this.formatTime(gameStats.gameTime || 0)}</span>
                    </div>
                </div>
                <div class="modal-actions">
                    <button id="restart-game-btn" class="btn btn-primary">重新开始</button>
                    <button id="close-modal-btn" class="btn btn-secondary">关闭</button>
                </div>
            </div>
            <div class="modal-backdrop"></div>
        `;
        
        // 添加样式
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 3000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        // 设置事件监听器
        this.setupGameOverModalEvents(modal);
        
        return modal;
    }
    
    /**
     * 设置游戏结束模态框事件
     * @param {HTMLElement} modal - 模态框元素
     */
    setupGameOverModalEvents(modal) {
        const restartBtn = modal.querySelector('#restart-game-btn');
        const closeBtn = modal.querySelector('#close-modal-btn');
        const backdrop = modal.querySelector('.modal-backdrop');
        
        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        };
        
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                closeModal();
                // 触发重新开始游戏事件
                const event = new CustomEvent('restartGame');
                document.dispatchEvent(event);
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        
        if (backdrop) {
            backdrop.addEventListener('click', closeModal);
        }
    }
    
    /**
     * 更新排行榜显示
     */
    async updateLeaderboard() {
        if (window.wsClient && window.wsClient.isConnected) {
            // 通过WebSocket请求排行榜
            window.wsClient.requestLeaderboard(10);
        } else {
            // 回退到API客户端
            const leaderboardElement = document.getElementById('leaderboard');
            if (!leaderboardElement) return;
            
            try {
                leaderboardElement.innerHTML = '<div class="loading">加载排行榜...</div>';
                const leaderboard = await window.apiClient.getLeaderboard(10);
                
                if (leaderboard && leaderboard.length > 0) {
                    leaderboardElement.innerHTML = this.renderLeaderboard(leaderboard);
                } else {
                    leaderboardElement.innerHTML = '<div class="no-data">暂无排行榜数据</div>';
                }
            } catch (error) {
                console.error('更新排行榜失败:', error);
                leaderboardElement.innerHTML = '<div class="error">加载排行榜失败</div>';
            }
        }
    }
    
    /**
     * 渲染排行榜HTML
     * @param {Array} leaderboard - 排行榜数据
     * @returns {string} HTML字符串
     */
    renderLeaderboard(leaderboard) {
        return leaderboard.map((entry, index) => {
            const rankClass = index < 3 ? `rank-${index + 1}` : '';
            return `
                <div class="leaderboard-entry ${rankClass}">
                    <span class="rank">#${entry.rank || index + 1}</span>
                    <span class="username">${entry.username || '匿名用户'}</span>
                    <span class="score">${this.formatNumber(entry.score || 0)}</span>
                </div>
            `;
        }).join('');
    }
    
    /**
     * 更新用户排名显示
     */
    async updateUserRank() {
        if (!window.currentUser || !window.currentUser.data) return;
        
        if (window.wsClient && window.wsClient.isConnected) {
            // 通过WebSocket请求用户排名
            window.wsClient.requestUserRank(window.currentUser.data.id);
        } else {
            // 回退到API客户端
            const userRankElement = document.getElementById('user-rank');
            if (!userRankElement) return;
            
            try {
                const rankInfo = await window.apiClient.getUserRank(window.currentUser.data.id);
                this.updateUserRankDisplay(rankInfo);
            } catch (error) {
                console.error('更新用户排名失败:', error);
                const rankText = userRankElement.querySelector('.rank-text');
                if (rankText) {
                    rankText.textContent = '获取排名失败';
                }
            }
        }
    }

    /**
     * 更新用户排名显示
     * @param {Object} rankInfo - 排名信息
     */
    updateUserRankDisplay(rankInfo) {
        const userRankElement = document.getElementById('user-rank');
        if (!userRankElement) return;
        
        if (rankInfo && rankInfo.rank) {
            const rankNumber = userRankElement.querySelector('.rank-number');
            const rankText = userRankElement.querySelector('.rank-text');
            
            if (rankNumber) {
                rankNumber.textContent = `#${rankInfo.rank}`;
            }
            
            if (rankText) {
                rankText.textContent = `${this.formatNumber(rankInfo.score)} 分`;
            }
        } else {
            const rankNumber = userRankElement.querySelector('.rank-number');
            const rankText = userRankElement.querySelector('.rank-text');
            
            if (rankNumber) rankNumber.textContent = '-';
            if (rankText) rankText.textContent = '暂无记录';
        }
    }
    
    /**
     * 初始化WebSocket连接
     */
    initializeWebSocket() {
        if (!window.wsClient) {
            console.error('WebSocket客户端未加载');
            return;
        }
        
        // 设置WebSocket事件监听器
        this.setupWebSocketEventListeners();
        
        // 连接WebSocket
        window.wsClient.connect();
        
        console.log('WebSocket初始化完成');
    }
    
    /**
     * 设置WebSocket事件监听器
     */
    setupWebSocketEventListeners() {
        const wsClient = window.wsClient;
        
        // 连接状态事件
        wsClient.on('connected', (data) => {
            console.log('WebSocket连接成功:', data);
            this.updateConnectionStatus(true);
            
            // 连接成功后设置用户信息
            if (window.currentUser && window.currentUser.data) {
                wsClient.setUser(window.currentUser.data);
            }
            
            // 订阅排行榜更新
            wsClient.subscribeToLeaderboard();
        });
        
        wsClient.on('disconnected', (data) => {
            console.log('WebSocket连接断开:', data);
            this.updateConnectionStatus(false);
        });
        
        // 排行榜相关事件
        wsClient.on('leaderboardUpdated', (data) => {
            console.log('排行榜实时更新:', data);
            this.handleLeaderboardUpdate(data);
        });
        
        wsClient.on('leaderboardData', (data) => {
            console.log('收到排行榜数据:', data);
            this.updateLeaderboardDisplay(data.leaderboard);
        });
        
        // 用户排名事件
        wsClient.on('rankChanged', (data) => {
            console.log('用户排名变化:', data);
            this.handleRankChange(data);
        });
        
        wsClient.on('userRankData', (data) => {
            console.log('收到用户排名数据:', data);
            this.updateUserRankDisplay(data.rank_info);
        });
        
        // 游戏相关事件
        wsClient.on('gameSaved', (data) => {
            console.log('游戏得分已保存:', data);
            
            // 更新用户排名显示
            if (data.rank_info) {
                this.updateUserRankDisplay(data.rank_info);
            }
        });
    }

    /**
     * 更新连接状态显示
     * @param {boolean} isConnected - 是否已连接
     */
    updateConnectionStatus(isConnected) {
        const indicator = document.getElementById('connection-indicator');
        const text = document.getElementById('connection-text');
        
        if (indicator) {
            indicator.className = `status-indicator ${isConnected ? 'online' : 'offline'}`;
        }
        
        if (text) {
            text.textContent = isConnected ? '实时连接' : '离线';
        }
    }

    /**
     * 处理排行榜更新
     * @param {Object} data - 排行榜更新数据
     */
    handleLeaderboardUpdate(data) {
        // 更新排行榜显示
        if (data.leaderboard) {
            this.updateLeaderboardDisplay(data.leaderboard);
        }
    }

    /**
     * 更新排行榜显示
     * @param {Array} leaderboard - 排行榜数据
     */
    updateLeaderboardDisplay(leaderboard) {
        const leaderboardElement = document.getElementById('leaderboard');
        if (!leaderboardElement) return;
        
        if (leaderboard && leaderboard.length > 0) {
            leaderboardElement.innerHTML = this.renderLeaderboard(leaderboard);
        } else {
            leaderboardElement.innerHTML = '<div class="no-data">暂无排行榜数据</div>';
        }
    }

    /**
     * 处理用户排名变化
     * @param {Object} data - 排名变化数据
     */
    handleRankChange(data) {
        const { old_rank, new_rank, score } = data;
        
        // 更新用户排名显示
        this.updateUserRankDisplay({
            rank: new_rank,
            score: score
        });
    }
    
    /**
     * 设置重新开始游戏功能
     */
    setupRestartGame() {
        document.addEventListener('restartGame', () => {
            // 触发重置按钮点击事件
            const resetBtn = document.getElementById('reset-btn');
            if (resetBtn) {
                resetBtn.click();
            }
        });
    }
    
    /**
     * 发送游戏开始事件到WebSocket
     * @param {string} userId - 用户ID
     */
    notifyGameStarted(userId) {
        if (window.wsClient && window.wsClient.isConnected) {
            window.wsClient.sendGameStarted(userId);
        }
    }
    
    /**
     * 发送游戏结束事件到WebSocket
     * @param {Object} gameData - 游戏数据
     */
    notifyGameFinished(gameData) {
        if (window.wsClient && window.wsClient.isConnected) {
            // 仅发送轻量级的游戏结束通知，不包含完整得分数据
            window.wsClient.sendGameFinished({ user_id: gameData.user_id, game_over: true });
        }
    }
    
    /**
     * 更新难度指示器
     * @param {object} difficultyInfo - 难度信息对象
     */
    updateDifficultyIndicator(difficultyInfo) {
        if (!difficultyInfo) return;
        
        const { level, rating, dropSpeed, description } = difficultyInfo;
        
        // 更新难度显示元素
        const difficultyElement = document.getElementById('difficulty-indicator');
        if (difficultyElement) {
            difficultyElement.textContent = `难度: ${rating} (${description})`;
            difficultyElement.className = `difficulty-indicator difficulty-${rating.toLowerCase()}`;
        }
        
        // 更新速度显示
        const speedElement = document.getElementById('drop-speed');
        if (speedElement) {
            speedElement.textContent = `速度: ${Math.round(1000 / dropSpeed * 100) / 100}`;
        }
        
        console.log(`难度更新: 级别 ${level}, 评级 ${rating}, 速度 ${dropSpeed}ms`);
    }

    /**
     * 清理UI状态
     */
    cleanup() {
        // 清除所有活动动画
        this.activeAnimations.forEach((animationData, id) => {
            if (animationData.element && animationData.element.parentNode) {
                animationData.element.parentNode.removeChild(animationData.element);
            }
        });
        this.activeAnimations.clear();
        
        // 清除游戏结束模态框
        const modal = document.getElementById('game-over-modal');
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }
}

// 导出UIManager类
window.UIManager = UIManager;

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
}

console.log('UI管理器模块加载完成');