/**
 * TetrominoManager - 管理俄罗斯方块的形状、旋转和碰撞检测
 */
class TetrominoManager {
    constructor() {
        // 定义7种标准俄罗斯方块形状
        this.shapes = {
            I: [
                [[1, 1, 1, 1]],
                [[1], [1], [1], [1]]
            ],
            O: [
                [[1, 1], [1, 1]]
            ],
            T: [
                [[0, 1, 0], [1, 1, 1]],
                [[1, 0], [1, 1], [1, 0]],
                [[1, 1, 1], [0, 1, 0]],
                [[0, 1], [1, 1], [0, 1]]
            ],
            S: [
                [[0, 1, 1], [1, 1, 0]],
                [[1, 0], [1, 1], [0, 1]]
            ],
            Z: [
                [[1, 1, 0], [0, 1, 1]],
                [[0, 1], [1, 1], [1, 0]]
            ],
            J: [
                [[1, 0, 0], [1, 1, 1]],
                [[1, 1], [1, 0], [1, 0]],
                [[1, 1, 1], [0, 0, 1]],
                [[0, 1], [0, 1], [1, 1]]
            ],
            L: [
                [[0, 0, 1], [1, 1, 1]],
                [[1, 0], [1, 0], [1, 1]],
                [[1, 1, 1], [1, 0, 0]],
                [[1, 1], [0, 1], [0, 1]]
            ]
        };

        // 方块类型数组，用于随机生成
        this.tetrominoTypes = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
        
        // 方块颜色映射
        this.colors = {
            I: '#00FFFF', // 青色
            O: '#FFFF00', // 黄色
            T: '#800080', // 紫色
            S: '#00FF00', // 绿色
            Z: '#FF0000', // 红色
            J: '#0000FF', // 蓝色
            L: '#FFA500'  // 橙色
        };
    }

    /**
     * 生成随机方块
     * @returns {Object} 包含类型、形状、位置和旋转状态的方块对象
     */
    generateRandomTetromino() {
        const type = this.tetrominoTypes[Math.floor(Math.random() * this.tetrominoTypes.length)];
        return this.createTetromino(type);
    }

    /**
     * 创建指定类型的方块
     * @param {string} type - 方块类型 (I, O, T, S, Z, J, L)
     * @returns {Object} 方块对象
     */
    createTetromino(type) {
        return {
            type: type,
            shape: this.shapes[type][0], // 初始旋转状态
            x: Math.floor(10 / 2) - Math.floor(this.shapes[type][0][0].length / 2), // 居中位置
            y: 0,
            rotation: 0,
            color: this.colors[type]
        };
    }

    /**
     * 旋转方块
     * @param {Object} tetromino - 要旋转的方块
     * @param {string} direction - 旋转方向 ('clockwise' 或 'counterclockwise')
     * @returns {Object} 旋转后的方块副本
     */
    rotateTetromino(tetromino, direction = 'clockwise') {
        const rotatedTetromino = { ...tetromino };
        const shapes = this.shapes[tetromino.type];
        
        if (direction === 'clockwise') {
            rotatedTetromino.rotation = (tetromino.rotation + 1) % shapes.length;
        } else {
            rotatedTetromino.rotation = (tetromino.rotation - 1 + shapes.length) % shapes.length;
        }
        
        rotatedTetromino.shape = shapes[rotatedTetromino.rotation];
        return rotatedTetromino;
    }

    /**
     * 检查方块是否与游戏板发生碰撞
     * @param {Object} tetromino - 要检查的方块
     * @param {Array} board - 游戏板二维数组
     * @param {number} offsetX - X轴偏移量（可选）
     * @param {number} offsetY - Y轴偏移量（可选）
     * @returns {boolean} 如果发生碰撞返回true，否则返回false
     */
    checkCollision(tetromino, board, offsetX = 0, offsetY = 0) {
        const shape = tetromino.shape;
        const newX = tetromino.x + offsetX;
        const newY = tetromino.y + offsetY;

        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardX = newX + col;
                    const boardY = newY + row;

                    // 检查边界碰撞
                    if (boardX < 0 || boardX >= board[0].length || 
                        boardY >= board.length) {
                        return true;
                    }

                    // 检查与已放置方块的碰撞
                    if (boardY >= 0 && board[boardY][boardX]) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * 移动方块
     * @param {Object} tetromino - 要移动的方块
     * @param {number} deltaX - X轴移动量
     * @param {number} deltaY - Y轴移动量
     * @param {Array} board - 游戏板
     * @returns {Object|null} 移动后的方块，如果无法移动则返回null
     */
    moveTetromino(tetromino, deltaX, deltaY, board) {
        if (!this.checkCollision(tetromino, board, deltaX, deltaY)) {
            return {
                ...tetromino,
                x: tetromino.x + deltaX,
                y: tetromino.y + deltaY
            };
        }
        return null;
    }

    /**
     * 尝试旋转方块，如果发生碰撞则尝试踢墙算法
     * @param {Object} tetromino - 要旋转的方块
     * @param {Array} board - 游戏板
     * @param {string} direction - 旋转方向
     * @returns {Object|null} 旋转后的方块，如果无法旋转则返回null
     */
    tryRotate(tetromino, board, direction = 'clockwise') {
        const rotated = this.rotateTetromino(tetromino, direction);
        
        // 直接旋转不碰撞
        if (!this.checkCollision(rotated, board)) {
            return rotated;
        }

        // 踢墙算法：尝试左右移动后旋转
        const kickOffsets = [-1, 1, -2, 2];
        for (const offset of kickOffsets) {
            if (!this.checkCollision(rotated, board, offset, 0)) {
                return {
                    ...rotated,
                    x: rotated.x + offset
                };
            }
        }

        // 无法旋转
        return null;
    }

    /**
     * 获取方块的边界框
     * @param {Object} tetromino - 方块对象
     * @returns {Object} 包含宽度和高度的边界框
     */
    getBoundingBox(tetromino) {
        return {
            width: tetromino.shape[0].length,
            height: tetromino.shape.length
        };
    }

    /**
     * 获取方块在游戏板上的投影位置（硬降落位置）
     * @param {Object} tetromino - 方块对象
     * @param {Array} board - 游戏板
     * @returns {Object} 投影位置的方块对象
     */
    getGhostTetromino(tetromino, board) {
        let ghostTetromino = { ...tetromino };
        
        // 持续下移直到碰撞
        while (!this.checkCollision(ghostTetromino, board, 0, 1)) {
            ghostTetromino.y++;
        }
        
        return ghostTetromino;
    }
}

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TetrominoManager;
}