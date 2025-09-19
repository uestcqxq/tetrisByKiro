/**
 * BoardManager 单元测试
 * 测试游戏板管理器的所有功能
 */

const fs = require('fs');
const path = require('path');

// 读取源文件并在全局作用域中执行
const boardManagerSource = fs.readFileSync(
  path.join(__dirname, '../../static/js/board-manager.js'),
  'utf8'
);
eval(boardManagerSource);

describe('BoardManager', () => {
  let boardManager;

  beforeEach(() => {
    boardManager = new BoardManager(10, 20);
  });

  describe('构造函数', () => {
    test('应该使用默认尺寸创建游戏板', () => {
      const defaultBoard = new BoardManager();
      
      expect(defaultBoard.width).toBe(10);
      expect(defaultBoard.height).toBe(20);
      expect(defaultBoard.board.length).toBe(20);
      expect(defaultBoard.board[0].length).toBe(10);
    });

    test('应该使用自定义尺寸创建游戏板', () => {
      const customBoard = new BoardManager(8, 16);
      
      expect(customBoard.width).toBe(8);
      expect(customBoard.height).toBe(16);
      expect(customBoard.board.length).toBe(16);
      expect(customBoard.board[0].length).toBe(8);
    });

    test('应该初始化为空游戏板', () => {
      expect(boardManager.linesCleared).toBe(0);
      
      for (let row = 0; row < boardManager.height; row++) {
        for (let col = 0; col < boardManager.width; col++) {
          expect(boardManager.board[row][col]).toBe(0);
        }
      }
    });
  });

  describe('createEmptyBoard', () => {
    test('应该创建正确尺寸的空游戏板', () => {
      const emptyBoard = boardManager.createEmptyBoard();
      
      expect(emptyBoard.length).toBe(20);
      expect(emptyBoard[0].length).toBe(10);
      
      emptyBoard.forEach(row => {
        row.forEach(cell => {
          expect(cell).toBe(0);
        });
      });
    });
  });

  describe('reset', () => {
    test('应该重置游戏板到初始状态', () => {
      // 修改游戏板状态
      boardManager.board[19][0] = 1;
      boardManager.linesCleared = 5;
      
      boardManager.reset();
      
      expect(boardManager.linesCleared).toBe(0);
      expect(boardManager.board[19][0]).toBe(0);
    });
  });

  describe('getBoardCopy', () => {
    test('应该返回游戏板的深拷贝', () => {
      boardManager.board[10][5] = 1;
      
      const copy = boardManager.getBoardCopy();
      
      expect(copy[10][5]).toBe(1);
      
      // 修改拷贝不应该影响原游戏板
      copy[10][5] = 2;
      expect(boardManager.board[10][5]).toBe(1);
    });
  });

  describe('placeTetromino', () => {
    test('应该成功放置方块', () => {
      const tetromino = {
        type: 'O',
        shape: [[1, 1], [1, 1]],
        x: 4,
        y: 18
      };
      
      const result = boardManager.placeTetromino(tetromino);
      
      expect(result).toBe(true);
      expect(boardManager.board[18][4]).toBe('O');
      expect(boardManager.board[18][5]).toBe('O');
      expect(boardManager.board[19][4]).toBe('O');
      expect(boardManager.board[19][5]).toBe('O');
    });

    test('应该拒绝放置到边界外', () => {
      const tetromino = {
        type: 'I',
        shape: [[1, 1, 1, 1]],
        x: 8, // 会超出右边界
        y: 19
      };
      
      const result = boardManager.placeTetromino(tetromino);
      
      expect(result).toBe(false);
    });

    test('应该拒绝放置到已占用位置', () => {
      // 先放置一个方块
      boardManager.board[19][4] = 1;
      
      const tetromino = {
        type: 'O',
        shape: [[1, 1], [1, 1]],
        x: 4,
        y: 18
      };
      
      const result = boardManager.placeTetromino(tetromino);
      
      expect(result).toBe(false);
    });

    test('应该正确处理复杂形状', () => {
      const tetromino = {
        type: 'T',
        shape: [[0, 1, 0], [1, 1, 1]],
        x: 3,
        y: 17
      };
      
      const result = boardManager.placeTetromino(tetromino);
      
      expect(result).toBe(true);
      expect(boardManager.board[17][4]).toBe('T'); // 中间顶部
      expect(boardManager.board[18][3]).toBe('T'); // 左下
      expect(boardManager.board[18][4]).toBe('T'); // 中下
      expect(boardManager.board[18][5]).toBe('T'); // 右下
      expect(boardManager.board[17][3]).toBe(0);   // 左上应该为空
      expect(boardManager.board[17][5]).toBe(0);   // 右上应该为空
    });
  });

  describe('clearLines', () => {
    test('应该清除完整的行', () => {
      // 填满最后一行
      for (let col = 0; col < boardManager.width; col++) {
        boardManager.board[19][col] = 1;
      }
      
      const linesCleared = boardManager.clearLines();
      
      expect(linesCleared).toBe(1);
      expect(boardManager.linesCleared).toBe(1);
      
      // 最后一行应该变为空
      for (let col = 0; col < boardManager.width; col++) {
        expect(boardManager.board[19][col]).toBe(0);
      }
    });

    test('应该清除多行', () => {
      // 填满最后两行
      for (let row = 18; row < 20; row++) {
        for (let col = 0; col < boardManager.width; col++) {
          boardManager.board[row][col] = 1;
        }
      }
      
      const linesCleared = boardManager.clearLines();
      
      expect(linesCleared).toBe(2);
      expect(boardManager.linesCleared).toBe(2);
    });

    test('应该正确下移剩余方块', () => {
      // 在倒数第三行放置一些方块
      boardManager.board[17][0] = 1;
      boardManager.board[17][1] = 1;
      
      // 填满最后一行
      for (let col = 0; col < boardManager.width; col++) {
        boardManager.board[19][col] = 1;
      }
      
      boardManager.clearLines();
      
      // 原来在第17行的方块应该下移到第18行
      expect(boardManager.board[18][0]).toBe(1);
      expect(boardManager.board[18][1]).toBe(1);
      expect(boardManager.board[17][0]).toBe(0);
      expect(boardManager.board[17][1]).toBe(0);
    });

    test('不应该清除不完整的行', () => {
      // 填满最后一行，但留一个空格
      for (let col = 0; col < boardManager.width - 1; col++) {
        boardManager.board[19][col] = 1;
      }
      
      const linesCleared = boardManager.clearLines();
      
      expect(linesCleared).toBe(0);
      expect(boardManager.board[19][0]).toBe(1); // 方块应该还在
    });
  });

  describe('isLineFull', () => {
    test('应该正确识别完整的行', () => {
      // 填满一行
      for (let col = 0; col < boardManager.width; col++) {
        boardManager.board[19][col] = 1;
      }
      
      expect(boardManager.isLineFull(19)).toBe(true);
      expect(boardManager.isLineFull(18)).toBe(false);
    });

    test('应该正确识别不完整的行', () => {
      // 填满一行，但留一个空格
      for (let col = 0; col < boardManager.width - 1; col++) {
        boardManager.board[19][col] = 1;
      }
      
      expect(boardManager.isLineFull(19)).toBe(false);
    });
  });

  describe('isLineEmpty', () => {
    test('应该正确识别空行', () => {
      expect(boardManager.isLineEmpty(19)).toBe(true);
      
      boardManager.board[19][0] = 1;
      expect(boardManager.isLineEmpty(19)).toBe(false);
    });
  });

  describe('checkGameOver', () => {
    test('应该检测游戏结束', () => {
      // 在顶部放置方块
      boardManager.board[1][5] = 1;
      
      expect(boardManager.checkGameOver()).toBe(true);
    });

    test('应该允许正常游戏继续', () => {
      // 只在底部放置方块
      boardManager.board[19][5] = 1;
      
      expect(boardManager.checkGameOver()).toBe(false);
    });
  });

  describe('getCell 和 setCell', () => {
    test('应该正确获取和设置单元格值', () => {
      expect(boardManager.getCell(5, 10)).toBe(0);
      
      boardManager.setCell(5, 10, 1);
      expect(boardManager.getCell(5, 10)).toBe(1);
    });

    test('应该处理边界外的坐标', () => {
      expect(boardManager.getCell(-1, 0)).toBe(-1);
      expect(boardManager.getCell(10, 0)).toBe(-1);
      expect(boardManager.getCell(0, -1)).toBe(-1);
      expect(boardManager.getCell(0, 20)).toBe(-1);
      
      // 设置边界外的值不应该产生错误
      boardManager.setCell(-1, 0, 1);
      boardManager.setCell(10, 0, 1);
    });
  });

  describe('getBoardHeight', () => {
    test('应该返回空游戏板的高度为0', () => {
      expect(boardManager.getBoardHeight()).toBe(0);
    });

    test('应该返回正确的游戏板高度', () => {
      boardManager.board[15][5] = 1;
      
      expect(boardManager.getBoardHeight()).toBe(5); // 20 - 15 = 5
    });

    test('应该返回最高方块的高度', () => {
      boardManager.board[19][0] = 1;
      boardManager.board[10][5] = 1;
      
      expect(boardManager.getBoardHeight()).toBe(10); // 20 - 10 = 10
    });
  });

  describe('countHoles', () => {
    test('应该正确计算洞的数量', () => {
      // 创建一个洞：上面有方块，下面是空的
      boardManager.board[18][5] = 1;
      // boardManager.board[19][5] = 0; // 这是洞
      
      expect(boardManager.countHoles()).toBe(1);
    });

    test('应该计算多个洞', () => {
      // 创建多个洞
      boardManager.board[17][3] = 1;
      boardManager.board[19][3] = 0; // 洞1
      
      boardManager.board[16][7] = 1;
      boardManager.board[17][7] = 0; // 洞2
      boardManager.board[18][7] = 0; // 洞3
      
      expect(boardManager.countHoles()).toBe(3);
    });

    test('空游戏板应该没有洞', () => {
      expect(boardManager.countHoles()).toBe(0);
    });
  });

  describe('getColumnHeights', () => {
    test('应该返回每列的正确高度', () => {
      boardManager.board[19][0] = 1; // 第0列高度为1
      boardManager.board[15][5] = 1; // 第5列高度为5
      
      const heights = boardManager.getColumnHeights();
      
      expect(heights.length).toBe(10);
      expect(heights[0]).toBe(1);
      expect(heights[5]).toBe(5);
      expect(heights[1]).toBe(0); // 空列
    });
  });

  describe('calculateRoughness', () => {
    test('应该计算游戏板的粗糙度', () => {
      // 创建不平整的表面
      boardManager.board[19][0] = 1; // 高度1
      boardManager.board[17][1] = 1; // 高度3
      boardManager.board[19][2] = 1; // 高度1
      
      const roughness = boardManager.calculateRoughness();
      
      // |1-3| + |3-1| + |1-0| + ... = 2 + 2 + 1 + 0 + 0 + 0 + 0 + 0 + 0 = 5
      expect(roughness).toBeGreaterThan(0);
    });

    test('平整表面的粗糙度应该为0', () => {
      // 所有列都是相同高度
      for (let col = 0; col < boardManager.width; col++) {
        boardManager.board[19][col] = 1;
      }
      
      const roughness = boardManager.calculateRoughness();
      
      expect(roughness).toBe(0);
    });
  });

  describe('getFullLines', () => {
    test('应该返回完整行的索引', () => {
      // 填满第18和19行
      for (let col = 0; col < boardManager.width; col++) {
        boardManager.board[18][col] = 1;
        boardManager.board[19][col] = 1;
      }
      
      const fullLines = boardManager.getFullLines();
      
      expect(fullLines).toEqual([18, 19]);
    });

    test('应该返回空数组如果没有完整行', () => {
      const fullLines = boardManager.getFullLines();
      
      expect(fullLines).toEqual([]);
    });
  });

  describe('previewPlacement', () => {
    test('应该预览方块放置而不修改原游戏板', () => {
      const tetromino = {
        type: 'O',
        shape: [[1, 1], [1, 1]],
        x: 4,
        y: 18
      };
      
      const preview = boardManager.previewPlacement(tetromino);
      
      // 预览板应该包含方块
      expect(preview[18][4]).toBe('O');
      expect(preview[18][5]).toBe('O');
      
      // 原游戏板应该保持不变
      expect(boardManager.board[18][4]).toBe(0);
      expect(boardManager.board[18][5]).toBe(0);
    });

    test('应该处理边界外的方块', () => {
      const tetromino = {
        type: 'I',
        shape: [[1, 1, 1, 1]],
        x: -1, // 部分超出边界
        y: 19
      };
      
      const preview = boardManager.previewPlacement(tetromino);
      
      // 应该只放置在边界内的部分
      expect(preview[19][0]).toBe('I');
      expect(preview[19][1]).toBe('I');
      expect(preview[19][2]).toBe('I');
    });
  });

  describe('getStats', () => {
    test('应该返回正确的统计信息', () => {
      boardManager.linesCleared = 5;
      boardManager.board[19][0] = 1;
      
      const stats = boardManager.getStats();
      
      expect(stats.linesCleared).toBe(5);
      expect(stats.boardHeight).toBe(1);
      expect(stats.holes).toBe(0);
      expect(stats.roughness).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.columnHeights)).toBe(true);
    });
  });

  describe('isEmpty', () => {
    test('应该正确检测空游戏板', () => {
      expect(boardManager.isEmpty()).toBe(true);
      
      boardManager.board[19][0] = 1;
      expect(boardManager.isEmpty()).toBe(false);
    });
  });

  describe('loadFromData 和 exportData', () => {
    test('应该正确导出和加载游戏板数据', () => {
      // 修改游戏板状态
      boardManager.board[19][0] = 1;
      boardManager.linesCleared = 3;
      
      const exportedData = boardManager.exportData();
      
      // 创建新的游戏板并加载数据
      const newBoard = new BoardManager();
      newBoard.loadFromData(exportedData);
      
      expect(newBoard.board[19][0]).toBe(1);
      expect(newBoard.linesCleared).toBe(3);
      expect(newBoard.width).toBe(10);
      expect(newBoard.height).toBe(20);
    });

    test('应该处理无效的加载数据', () => {
      const originalState = boardManager.exportData();
      
      // 尝试加载无效数据
      boardManager.loadFromData({});
      boardManager.loadFromData({ board: 'invalid' });
      boardManager.loadFromData({ linesCleared: 'invalid' });
      
      // 游戏板应该保持原状态
      expect(boardManager.board).toBeDefined();
      expect(typeof boardManager.linesCleared).toBe('number');
    });
  });
});