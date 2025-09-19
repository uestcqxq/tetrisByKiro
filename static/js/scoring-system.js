/**
 * ScoringSystem - 俄罗斯方块积分计算系统
 * 实现基于行数和级别的积分计算，包含多行消除奖励逻辑
 */
class ScoringSystem {
    constructor(config = {}) {
        // 积分配置
        this.config = {
            // 基础行消除积分
            lineScores: {
                1: 100,    // 单行消除
                2: 300,    // 双行消除
                3: 500,    // 三行消除
                4: 800     // 四行消除 (Tetris)
            },
            // 软降落积分 (每格1分)
            softDropScore: 1,
            // 硬降落积分 (每格2分)
            hardDropScore: 2,
            // T-Spin奖励积分
            tSpinScores: {
                mini: 100,
                single: 800,
                double: 1200,
                triple: 1600
            },
            // 连击奖励倍数
            comboMultiplier: 50,
            // 完美清除奖励
            perfectClearBonus: 2000,
            ...config
        };

        // 初始化难度管理器
        this.difficultyManager = new DifficultyManager(config.difficulty);

        // 游戏状态
        this.gameStats = {
            score: 0,
            combo: 0,
            lastAction: null,
            totalPieces: 0,
            startTime: null,
            gameTime: 0
        };

        // 积分动画队列
        this.scoreAnimations = [];
        
        // 事件回调
        this.callbacks = {
            onScoreUpdate: null,
            onLevelUpdate: null,
            onComboUpdate: null,
            onScoreAnimation: null
        };
    }

    /**
     * 重置积分系统
     */
    reset() {
        this.gameStats = {
            score: 0,
            combo: 0,
            lastAction: null,
            totalPieces: 0,
            startTime: Date.now(),
            gameTime: 0
        };
        this.difficultyManager.reset();
        this.scoreAnimations = [];
    }

    /**
     * 开始游戏计时
     */
    startGame() {
        this.gameStats.startTime = Date.now();
    }

    /**
     * 更新游戏时间
     */
    updateGameTime() {
        if (this.gameStats.startTime) {
            this.gameStats.gameTime = Date.now() - this.gameStats.startTime;
        }
    }

    /**
     * 计算行消除积分
     * @param {number} linesCleared - 消除的行数
     * @param {number} level - 当前级别
     * @param {boolean} isTSpin - 是否为T-Spin
     * @param {string} tSpinType - T-Spin类型 ('mini', 'single', 'double', 'triple')
     * @param {boolean} isPerfectClear - 是否为完美清除
     * @returns {object} 积分计算结果
     */
    calculateLineScore(linesCleared, level = null, isTSpin = false, tSpinType = null, isPerfectClear = false) {
        if (level === null) {
            level = this.difficultyManager.getDifficultyInfo().level;
        }

        let baseScore = 0;
        let scoreBreakdown = {
            baseScore: 0,
            levelMultiplier: level,
            comboBonus: 0,
            tSpinBonus: 0,
            perfectClearBonus: 0,
            totalScore: 0
        };

        // 基础积分计算
        if (linesCleared > 0) {
            baseScore = this.config.lineScores[linesCleared] || this.config.lineScores[4];
            scoreBreakdown.baseScore = baseScore;

            // T-Spin奖励
            if (isTSpin && tSpinType) {
                const tSpinBonus = this.config.tSpinScores[tSpinType] || 0;
                scoreBreakdown.tSpinBonus = tSpinBonus;
                baseScore += tSpinBonus;
            }

            // 连击奖励
            if (this.gameStats.combo > 0) {
                const comboBonus = this.config.comboMultiplier * this.gameStats.combo * level;
                scoreBreakdown.comboBonus = comboBonus;
                baseScore += comboBonus;
            }

            // 完美清除奖励
            if (isPerfectClear) {
                scoreBreakdown.perfectClearBonus = this.config.perfectClearBonus;
                baseScore += this.config.perfectClearBonus;
            }

            // 级别倍数
            const finalScore = baseScore * level;
            scoreBreakdown.totalScore = finalScore;

            return scoreBreakdown;
        }

        return scoreBreakdown;
    }

    /**
     * 处理行消除并更新积分
     * @param {number} linesCleared - 消除的行数
     * @param {object} options - 额外选项
     */
    processLineClears(linesCleared, options = {}) {
        const {
            isTSpin = false,
            tSpinType = null,
            isPerfectClear = false,
            boardState = null
        } = options;

        // 更新连击
        if (linesCleared > 0) {
            this.gameStats.combo++;
        } else {
            this.gameStats.combo = 0;
        }

        // 计算积分
        const currentLevel = this.difficultyManager.getDifficultyInfo().level;
        const scoreResult = this.calculateLineScore(
            linesCleared, 
            currentLevel, 
            isTSpin, 
            tSpinType, 
            isPerfectClear
        );

        // 更新游戏统计
        this.gameStats.score += scoreResult.totalScore;

        // 处理难度调整
        const difficultyResult = this.difficultyManager.processLinesCleared(linesCleared);
        const oldLevel = difficultyResult.oldLevel;

        // 创建积分动画
        if (scoreResult.totalScore > 0) {
            this.addScoreAnimation(scoreResult);
        }

        // 触发回调
        this.triggerCallbacks(scoreResult, difficultyResult);

        return {
            ...scoreResult,
            difficultyResult
        };
    }

    /**
     * 处理软降落积分
     * @param {number} distance - 降落距离
     */
    processSoftDrop(distance) {
        const score = distance * this.config.softDropScore;
        this.gameStats.score += score;
        
        if (this.callbacks.onScoreUpdate) {
            this.callbacks.onScoreUpdate(this.gameStats.score, score);
        }

        return score;
    }

    /**
     * 处理硬降落积分
     * @param {number} distance - 降落距离
     */
    processHardDrop(distance) {
        const score = distance * this.config.hardDropScore;
        this.gameStats.score += score;
        
        if (this.callbacks.onScoreUpdate) {
            this.callbacks.onScoreUpdate(this.gameStats.score, score);
        }

        return score;
    }

    /**
     * 获取当前级别对应的下落速度
     * @returns {number} 下落间隔时间（毫秒）
     */
    getDropSpeed() {
        return this.difficultyManager.getDifficultyInfo().dropSpeed;
    }

    /**
     * 添加积分动画
     * @param {object} scoreResult - 积分计算结果
     */
    addScoreAnimation(scoreResult) {
        const animation = {
            id: Date.now() + Math.random(),
            score: scoreResult.totalScore,
            breakdown: scoreResult,
            timestamp: Date.now(),
            duration: 2000, // 2秒动画
            type: this.getAnimationType(scoreResult)
        };

        this.scoreAnimations.push(animation);

        // 触发动画回调
        if (this.callbacks.onScoreAnimation) {
            this.callbacks.onScoreAnimation(animation);
        }

        // 自动清理过期动画
        setTimeout(() => {
            this.removeScoreAnimation(animation.id);
        }, animation.duration);
    }

    /**
     * 获取动画类型
     * @param {object} scoreResult - 积分结果
     * @returns {string} 动画类型
     */
    getAnimationType(scoreResult) {
        if (scoreResult.perfectClearBonus > 0) return 'perfect-clear';
        if (scoreResult.tSpinBonus > 0) return 't-spin';
        if (scoreResult.comboBonus > 0) return 'combo';
        if (scoreResult.baseScore >= 800) return 'tetris';
        return 'normal';
    }

    /**
     * 移除积分动画
     * @param {string} animationId - 动画ID
     */
    removeScoreAnimation(animationId) {
        this.scoreAnimations = this.scoreAnimations.filter(
            animation => animation.id !== animationId
        );
    }

    /**
     * 触发回调函数
     * @param {object} scoreResult - 积分结果
     * @param {object} difficultyResult - 难度调整结果
     */
    triggerCallbacks(scoreResult, difficultyResult) {
        if (this.callbacks.onScoreUpdate) {
            this.callbacks.onScoreUpdate(this.gameStats.score, scoreResult.totalScore);
        }

        if (difficultyResult.levelUp && this.callbacks.onLevelUpdate) {
            this.callbacks.onLevelUpdate(difficultyResult.newLevel, difficultyResult.oldLevel);
        }

        if (this.callbacks.onComboUpdate) {
            this.callbacks.onComboUpdate(this.gameStats.combo);
        }
    }

    /**
     * 增加放置方块计数
     */
    incrementPieceCount() {
        this.gameStats.totalPieces++;
    }

    /**
     * 获取游戏统计信息
     * @returns {object} 游戏统计
     */
    getGameStats() {
        this.updateGameTime();
        const difficultyInfo = this.difficultyManager.getDifficultyInfo();
        
        return {
            ...this.gameStats,
            ...difficultyInfo,
            pps: this.calculatePPS(), // Pieces Per Second
            lpm: this.calculateLPM(), // Lines Per Minute
            efficiency: this.calculateEfficiency()
        };
    }

    /**
     * 计算每秒方块数 (PPS)
     * @returns {number} PPS值
     */
    calculatePPS() {
        if (this.gameStats.gameTime === 0) return 0;
        return (this.gameStats.totalPieces / (this.gameStats.gameTime / 1000)).toFixed(2);
    }

    /**
     * 计算每分钟行数 (LPM)
     * @returns {number} LPM值
     */
    calculateLPM() {
        if (this.gameStats.gameTime === 0) return 0;
        const totalLines = this.difficultyManager.getDifficultyInfo().totalLines;
        return (totalLines / (this.gameStats.gameTime / 60000)).toFixed(2);
    }

    /**
     * 计算游戏效率
     * @returns {number} 效率百分比
     */
    calculateEfficiency() {
        if (this.gameStats.totalPieces === 0) return 0;
        // 理论最大效率：每4个方块消除4行
        const maxPossibleLines = this.gameStats.totalPieces;
        const totalLines = this.difficultyManager.getDifficultyInfo().totalLines;
        return ((totalLines / maxPossibleLines) * 100).toFixed(1);
    }

    /**
     * 设置回调函数
     * @param {string} event - 事件名称
     * @param {function} callback - 回调函数
     */
    setCallback(event, callback) {
        const callbackName = 'on' + event.charAt(0).toUpperCase() + event.slice(1);
        if (this.callbacks.hasOwnProperty(callbackName)) {
            this.callbacks[callbackName] = callback;
        }
    }

    /**
     * 获取当前积分动画
     * @returns {array} 活跃的积分动画列表
     */
    getActiveAnimations() {
        return [...this.scoreAnimations];
    }

    /**
     * 获取级别进度
     * @returns {object} 级别进度信息
     */
    getLevelProgress() {
        return this.difficultyManager.getLevelProgress();
    }

    /**
     * 获取难度管理器
     * @returns {DifficultyManager} 难度管理器实例
     */
    getDifficultyManager() {
        return this.difficultyManager;
    }

    /**
     * 导出游戏数据用于保存
     * @returns {object} 可序列化的游戏数据
     */
    exportGameData() {
        const difficultyInfo = this.difficultyManager.getDifficultyInfo();
        
        return {
            score: this.gameStats.score,
            level: difficultyInfo.level,
            lines: difficultyInfo.totalLines,
            totalPieces: this.gameStats.totalPieces,
            gameTime: this.gameStats.gameTime,
            pps: this.calculatePPS(),
            lpm: this.calculateLPM(),
            efficiency: this.calculateEfficiency(),
            difficultyData: this.difficultyManager.exportData()
        };
    }
}

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScoringSystem;
}