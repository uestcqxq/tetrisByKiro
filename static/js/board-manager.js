/**
 * BoardManager - 管理俄罗斯方块游戏板的状态和操作
 */
class BoardManager {
    constructor(width = 10, height = 20) {
        this.width = width;
        this.height = height;
        this.board = this.createEmptyBoard();
        this.linesCleared = 0;
    }

    /**
     * 创建空的游戏板
     * @returns {Array} 二维数组表示的空游戏板
     */
    createEmptyBoard() {
        return Array(this.height).fill().map(() => Array(this.width).fill(0));
    }

    /**
     * 重置游戏板
     */
    reset() {
        this.board = this.createEmptyBoard();
        this.linesCleared = 0;
    }

    /**
     * 获取游戏板的副本
     * @returns {Array} 游戏板的深拷贝
     */
    getBoardCopy() {
        return this.board.map(row => [...row]);
    }

    /**
     * 将方块放置到游戏板上
     * @param {Object} tetromino - 要放置的方块
     * @returns {boolean} 放置成功返回true，失败返回false
     */
    placeTetromino(tetromino) {
        const shape = tetromino.shape;
        
        // 检查是否可以放置
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardX = tetromino.x + col;
                    const boardY = tetromino.y + row;
                    
                    // 检查边界
                    if (boardX < 0 || boardX >= this.width || 
                        boardY < 0 || boardY >= this.height) {
                        return false;
                    }
                    
                    // 检查位置是否已被占用
                    if (this.board[boardY][boardX]) {
                        return false;
                    }
                }
            }
        }

        // 放置方块
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardX = tetromino.x + col;
                    const boardY = tetromino.y + row;
                    this.board[boardY][boardX] = tetromino.type || 1;
                }
            }
        }

        return true;
    }

    /**
     * 检查并清除完整的行
     * @returns {number} 清除的行数
     */
    clearLines() {
        let linesCleared = 0;
        const newBoard = [];

        // 从下往上检查每一行
        for (let row = this.height - 1; row >= 0; row--) {
            if (this.isLineFull(row)) {
                linesCleared++;
            } else {
                newBoard.unshift([...this.board[row]]);
            }
        }

        // 在顶部添加空行
        while (newBoard.length < this.height) {
            newBoard.unshift(Array(this.width).fill(0));
        }

        this.board = newBoard;
        this.linesCleared += linesCleared;

        return linesCleared;
    }

    /**
     * 检查指定行是否已满
     * @param {number} row - 行索引
     * @returns {boolean} 如果行已满返回true
     */
    isLineFull(row) {
        return this.board[row].every(cell => cell !== 0);
    }

    /**
     * 检查指定行是否为空
     * @param {number} row - 行索引
     * @returns {boolean} 如果行为空返回true
     */
    isLineEmpty(row) {
        return this.board[row].every(cell => cell === 0);
    }

    /**
     * 检查游戏是否结束
     * @returns {boolean} 如果游戏结束返回true
     */
    checkGameOver() {
        // 检查顶部几行是否有方块
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < this.width; col++) {
                if (this.board[row][col]) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 获取指定位置的单元格值
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {number} 单元格的值
     */
    getCell(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return -1; // 边界外
        }
        return this.board[y][x];
    }

    /**
     * 设置指定位置的单元格值
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} value - 要设置的值
     */
    setCell(x, y, value) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.board[y][x] = value;
        }
    }

    /**
     * 获取游戏板的高度（已占用的最高行）
     * @returns {number} 游戏板的高度
     */
    getBoardHeight() {
        for (let row = 0; row < this.height; row++) {
            if (!this.isLineEmpty(row)) {
                return this.height - row;
            }
        }
        return 0;
    }

    /**
     * 计算游戏板的"洞"数量（被方块覆盖的空格）
     * @returns {number} 洞的数量
     */
    countHoles() {
        let holes = 0;
        
        for (let col = 0; col < this.width; col++) {
            let blockFound = false;
            for (let row = 0; row < this.height; row++) {
                if (this.board[row][col]) {
                    blockFound = true;
                } else if (blockFound) {
                    holes++;
                }
            }
        }
        
        return holes;
    }

    /**
     * 计算每列的高度
     * @returns {Array} 每列的高度数组
     */
    getColumnHeights() {
        const heights = Array(this.width).fill(0);
        
        for (let col = 0; col < this.width; col++) {
            for (let row = 0; row < this.height; row++) {
                if (this.board[row][col]) {
                    heights[col] = this.height - row;
                    break;
                }
            }
        }
        
        return heights;
    }

    /**
     * 计算游戏板的粗糙度（相邻列高度差的总和）
     * @returns {number} 粗糙度值
     */
    calculateRoughness() {
        const heights = this.getColumnHeights();
        let roughness = 0;
        
        for (let i = 0; i < heights.length - 1; i++) {
            roughness += Math.abs(heights[i] - heights[i + 1]);
        }
        
        return roughness;
    }

    /**
     * 获取完整行的索引列表
     * @returns {Array} 完整行的索引数组
     */
    getFullLines() {
        const fullLines = [];
        
        for (let row = 0; row < this.height; row++) {
            if (this.isLineFull(row)) {
                fullLines.push(row);
            }
        }
        
        return fullLines;
    }

    /**
     * 预览方块放置后的游戏板状态（不实际修改游戏板）
     * @param {Object} tetromino - 要预览的方块
     * @returns {Array} 预览后的游戏板副本
     */
    previewPlacement(tetromino) {
        const previewBoard = this.getBoardCopy();
        const shape = tetromino.shape;
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardX = tetromino.x + col;
                    const boardY = tetromino.y + row;
                    
                    if (boardX >= 0 && boardX < this.width && 
                        boardY >= 0 && boardY < this.height) {
                        previewBoard[boardY][boardX] = tetromino.type || 1;
                    }
                }
            }
        }
        
        return previewBoard;
    }

    /**
     * 获取游戏统计信息
     * @returns {Object} 包含各种统计信息的对象
     */
    getStats() {
        return {
            linesCleared: this.linesCleared,
            boardHeight: this.getBoardHeight(),
            holes: this.countHoles(),
            roughness: this.calculateRoughness(),
            columnHeights: this.getColumnHeights()
        };
    }

    /**
     * 从JSON数据恢复游戏板状态
     * @param {Object} data - 包含游戏板数据的对象
     */
    loadFromData(data) {
        if (data.board && Array.isArray(data.board)) {
            this.board = data.board.map(row => [...row]);
        }
        if (typeof data.linesCleared === 'number') {
            this.linesCleared = data.linesCleared;
        }
    }

    /**
     * 检查游戏板是否完全为空
     * @returns {boolean} 如果游戏板为空返回true
     */
    isEmpty() {
        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                if (this.board[row][col] !== 0) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * 将游戏板状态导出为JSON数据
     * @returns {Object} 包含游戏板状态的对象
     */
    exportData() {
        return {
            board: this.getBoardCopy(),
            linesCleared: this.linesCleared,
            width: this.width,
            height: this.height
        };
    }
}

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BoardManager;
}