/**
 * DifficultyManager - 俄罗斯方块动态难度管理系统
 * 负责根据消除行数调整级别和方块下落速度
 */
class DifficultyManager {
    constructor(config = {}) {
        // 难度配置
        this.config = {
            // 基础下落速度（毫秒）
            baseDropSpeed: 1000,
            // 最快下落速度（毫秒）
            minDropSpeed: 50,
            // 速度递减因子
            speedDecayFactor: 0.8,
            // 每级所需行数
            linesPerLevel: 10,
            // 最大级别
            maxLevel: 30,
            // 级别提升时的速度调整方式
            speedCalculationMode: 'exponential', // 'exponential', 'linear', 'custom'
            // 自定义速度表（如果使用custom模式）
            customSpeedTable: null,
            // 级别提升奖励
            levelUpBonus: 1000,
            ...config
        };

        // 当前难度状态
        this.difficultyState = {
            currentLevel: 1,
            totalLines: 0,
            currentLevelLines: 0,
            dropSpeed: this.config.baseDropSpeed,
            speedMultiplier: 1.0,
            difficultyRating: 'Beginner'
        };

        // 预定义的难度等级
        this.difficultyRatings = [
            { level: 1, name: 'Beginner', color: '#4CAF50' },
            { level: 5, name: 'Easy', color: '#8BC34A' },
            { level: 10, name: 'Normal', color: '#FFC107' },
            { level: 15, name: 'Hard', color: '#FF9800' },
            { level: 20, name: 'Expert', color: '#FF5722' },
            { level: 25, name: 'Master', color: '#9C27B0' },
            { level: 30, name: 'Grandmaster', color: '#E91E63' }
        ];

        // 事件回调
        this.callbacks = {
            onLevelUp: null,
            onSpeedChange: null,
            onDifficultyChange: null
        };
    }

    /**
     * 重置难度管理器
     */
    reset() {
        this.difficultyState = {
            currentLevel: 1,
            totalLines: 0,
            currentLevelLines: 0,
            dropSpeed: this.config.baseDropSpeed,
            speedMultiplier: 1.0,
            difficultyRating: 'Beginner'
        };
    }

    /**
     * 处理行消除并更新难度
     * @param {number} linesCleared - 消除的行数
     * @returns {object} 难度更新结果
     */
    processLinesCleared(linesCleared) {
        const oldLevel = this.difficultyState.currentLevel;
        const oldSpeed = this.difficultyState.dropSpeed;
        
        // 更新行数统计
        this.difficultyState.totalLines += linesCleared;
        this.difficultyState.currentLevelLines += linesCleared;

        // 检查是否需要升级
        const levelUpResult = this.checkLevelUp();
        
        // 更新下落速度
        this.updateDropSpeed();
        
        // 更新难度评级
        this.updateDifficultyRating();

        const result = {
            oldLevel,
            newLevel: this.difficultyState.currentLevel,
            levelUp: levelUpResult.levelUp,
            levelsGained: levelUpResult.levelsGained,
            oldSpeed,
            newSpeed: this.difficultyState.dropSpeed,
            speedChange: this.difficultyState.dropSpeed !== oldSpeed,
            difficultyRating: this.difficultyState.difficultyRating,
            progress: this.getLevelProgress()
        };

        // 触发回调
        this.triggerCallbacks(result);

        return result;
    }

    /**
     * 检查级别提升
     * @returns {object} 级别提升结果
     */
    checkLevelUp() {
        const requiredLines = this.config.linesPerLevel;
        let levelUp = false;
        let levelsGained = 0;

        while (this.difficultyState.currentLevelLines >= requiredLines && 
               this.difficultyState.currentLevel < this.config.maxLevel) {
            
            this.difficultyState.currentLevel++;
            this.difficultyState.currentLevelLines -= requiredLines;
            levelsGained++;
            levelUp = true;
        }

        return { levelUp, levelsGained };
    }

    /**
     * 更新下落速度
     */
    updateDropSpeed() {
        const level = this.difficultyState.currentLevel;
        let newSpeed;

        switch (this.config.speedCalculationMode) {
            case 'exponential':
                newSpeed = this.calculateExponentialSpeed(level);
                break;
            case 'linear':
                newSpeed = this.calculateLinearSpeed(level);
                break;
            case 'custom':
                newSpeed = this.calculateCustomSpeed(level);
                break;
            default:
                newSpeed = this.calculateExponentialSpeed(level);
        }

        this.difficultyState.dropSpeed = Math.max(newSpeed, this.config.minDropSpeed);
        this.difficultyState.speedMultiplier = this.config.baseDropSpeed / this.difficultyState.dropSpeed;
    }

    /**
     * 计算指数递减速度
     * @param {number} level - 当前级别
     * @returns {number} 下落速度（毫秒）
     */
    calculateExponentialSpeed(level) {
        return this.config.baseDropSpeed * Math.pow(this.config.speedDecayFactor, level - 1);
    }

    /**
     * 计算线性递减速度
     * @param {number} level - 当前级别
     * @returns {number} 下落速度（毫秒）
     */
    calculateLinearSpeed(level) {
        const speedReduction = (this.config.baseDropSpeed - this.config.minDropSpeed) / this.config.maxLevel;
        return this.config.baseDropSpeed - (speedReduction * (level - 1));
    }

    /**
     * 使用自定义速度表计算速度
     * @param {number} level - 当前级别
     * @returns {number} 下落速度（毫秒）
     */
    calculateCustomSpeed(level) {
        if (this.config.customSpeedTable && this.config.customSpeedTable[level]) {
            return this.config.customSpeedTable[level];
        }
        // 回退到指数计算
        return this.calculateExponentialSpeed(level);
    }

    /**
     * 更新难度评级
     */
    updateDifficultyRating() {
        const level = this.difficultyState.currentLevel;
        
        // 找到对应的难度评级
        for (let i = this.difficultyRatings.length - 1; i >= 0; i--) {
            if (level >= this.difficultyRatings[i].level) {
                this.difficultyState.difficultyRating = this.difficultyRatings[i].name;
                break;
            }
        }
    }

    /**
     * 获取级别进度信息
     * @returns {object} 级别进度
     */
    getLevelProgress() {
        const requiredLines = this.config.linesPerLevel;
        const progress = (this.difficultyState.currentLevelLines / requiredLines) * 100;
        const linesToNext = requiredLines - this.difficultyState.currentLevelLines;

        return {
            currentLevel: this.difficultyState.currentLevel,
            currentLevelLines: this.difficultyState.currentLevelLines,
            requiredLines,
            progress: Math.min(progress, 100),
            linesToNext: Math.max(linesToNext, 0),
            isMaxLevel: this.difficultyState.currentLevel >= this.config.maxLevel
        };
    }

    /**
     * 获取当前难度信息
     * @returns {object} 难度信息
     */
    getDifficultyInfo() {
        const rating = this.difficultyRatings.find(r => r.name === this.difficultyState.difficultyRating);
        
        return {
            level: this.difficultyState.currentLevel,
            totalLines: this.difficultyState.totalLines,
            dropSpeed: this.difficultyState.dropSpeed,
            speedMultiplier: this.difficultyState.speedMultiplier,
            rating: this.difficultyState.difficultyRating,
            ratingColor: rating ? rating.color : '#4CAF50',
            progress: this.getLevelProgress(),
            speedPercentage: this.getSpeedPercentage()
        };
    }

    /**
     * 获取速度百分比（相对于最大速度）
     * @returns {number} 速度百分比
     */
    getSpeedPercentage() {
        const speedRange = this.config.baseDropSpeed - this.config.minDropSpeed;
        const currentSpeedFromMin = this.difficultyState.dropSpeed - this.config.minDropSpeed;
        return Math.max(0, Math.min(100, (1 - currentSpeedFromMin / speedRange) * 100));
    }

    /**
     * 预测下一级别的信息
     * @returns {object} 下一级别信息
     */
    getNextLevelPreview() {
        if (this.difficultyState.currentLevel >= this.config.maxLevel) {
            return null;
        }

        const nextLevel = this.difficultyState.currentLevel + 1;
        const nextSpeed = this.calculateSpeedForLevel(nextLevel);
        const nextRating = this.getRatingForLevel(nextLevel);

        return {
            level: nextLevel,
            dropSpeed: nextSpeed,
            speedMultiplier: this.config.baseDropSpeed / nextSpeed,
            rating: nextRating.name,
            ratingColor: nextRating.color,
            speedIncrease: ((this.difficultyState.dropSpeed - nextSpeed) / this.difficultyState.dropSpeed) * 100
        };
    }

    /**
     * 计算指定级别的速度
     * @param {number} level - 级别
     * @returns {number} 下落速度
     */
    calculateSpeedForLevel(level) {
        switch (this.config.speedCalculationMode) {
            case 'exponential':
                return Math.max(this.calculateExponentialSpeed(level), this.config.minDropSpeed);
            case 'linear':
                return Math.max(this.calculateLinearSpeed(level), this.config.minDropSpeed);
            case 'custom':
                return Math.max(this.calculateCustomSpeed(level), this.config.minDropSpeed);
            default:
                return Math.max(this.calculateExponentialSpeed(level), this.config.minDropSpeed);
        }
    }

    /**
     * 获取指定级别的难度评级
     * @param {number} level - 级别
     * @returns {object} 难度评级
     */
    getRatingForLevel(level) {
        for (let i = this.difficultyRatings.length - 1; i >= 0; i--) {
            if (level >= this.difficultyRatings[i].level) {
                return this.difficultyRatings[i];
            }
        }
        return this.difficultyRatings[0];
    }

    /**
     * 设置自定义速度表
     * @param {object} speedTable - 级别到速度的映射
     */
    setCustomSpeedTable(speedTable) {
        this.config.customSpeedTable = speedTable;
        this.config.speedCalculationMode = 'custom';
        this.updateDropSpeed();
    }

    /**
     * 手动设置级别（用于测试或特殊模式）
     * @param {number} level - 目标级别
     */
    setLevel(level) {
        if (level >= 1 && level <= this.config.maxLevel) {
            const oldLevel = this.difficultyState.currentLevel;
            this.difficultyState.currentLevel = level;
            this.difficultyState.totalLines = (level - 1) * this.config.linesPerLevel;
            this.difficultyState.currentLevelLines = 0;
            
            this.updateDropSpeed();
            this.updateDifficultyRating();

            // 触发回调
            if (this.callbacks.onLevelUp && level !== oldLevel) {
                this.callbacks.onLevelUp(level, oldLevel);
            }
        }
    }

    /**
     * 获取级别统计信息
     * @returns {object} 统计信息
     */
    getStatistics() {
        return {
            currentLevel: this.difficultyState.currentLevel,
            totalLines: this.difficultyState.totalLines,
            averageLinesPerLevel: this.difficultyState.totalLines / this.difficultyState.currentLevel,
            speedImprovement: ((this.config.baseDropSpeed - this.difficultyState.dropSpeed) / this.config.baseDropSpeed) * 100,
            difficultyRating: this.difficultyState.difficultyRating,
            progressToMax: (this.difficultyState.currentLevel / this.config.maxLevel) * 100
        };
    }

    /**
     * 触发回调函数
     * @param {object} result - 难度更新结果
     */
    triggerCallbacks(result) {
        if (result.levelUp && this.callbacks.onLevelUp) {
            this.callbacks.onLevelUp(result.newLevel, result.oldLevel, result.levelsGained);
        }

        if (result.speedChange && this.callbacks.onSpeedChange) {
            this.callbacks.onSpeedChange(result.newSpeed, result.oldSpeed);
        }

        if (this.callbacks.onDifficultyChange) {
            this.callbacks.onDifficultyChange(this.getDifficultyInfo());
        }
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
     * 导出难度数据
     * @returns {object} 可序列化的难度数据
     */
    exportData() {
        return {
            difficultyState: { ...this.difficultyState },
            config: { ...this.config }
        };
    }

    /**
     * 从数据恢复难度状态
     * @param {object} data - 难度数据
     */
    loadData(data) {
        if (data.difficultyState) {
            this.difficultyState = { ...this.difficultyState, ...data.difficultyState };
        }
        if (data.config) {
            this.config = { ...this.config, ...data.config };
        }
        this.updateDifficultyRating();
    }
}

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DifficultyManager;
}