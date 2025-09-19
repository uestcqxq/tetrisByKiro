/**
 * TetrominoManager 单元测试
 * 测试方块管理器的所有功能
 */

// 加载被测试的类
const fs = require('fs');
const path = require('path');

// 读取源文件并在全局作用域中执行
const tetrominoManagerSource = fs.readFileSync(
  path.join(__dirname, '../../static/js/tetromino-manager.js'),
  'utf8'
);
eval(tetrominoManagerSource);

describe('TetrominoManager', () => {
  let tetrominoManager;

  beforeEach(() => {
    tetrominoManager = new TetrominoManager();
  });

  describe('构造函数', () => {
    test('应该正确初始化所有方块形状', () => {
      expect(tetrominoManager.shapes).toBeDefined();
      expect(Object.keys(tetrominoManager.shapes)).toEqual(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
    });

    test('应该正确初始化方块类型数组', () => {
      expect(tetrominoManager.tetrominoTypes).toEqual(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
    });

    test('应该正确初始化颜色映射', () => {
      expect(tetrominoManager.colors).toBeDefined();
      expect(tetrominoManager.colors.I).toBe('#00FFFF');
      expect(tetrominoManager.colors.O).toBe('#FFFF00');
      expect(tetrominoManager.colors.T).toBe('#800080');
    });
  });

  describe('generateRandomTetromino', () => {
    test('应该生成有效的随机方块', () => {
      const tetromino = tetrominoManager.generateRandomTetromino();
      
      expect(tetromino).toBeValidTetromino();
      expect(tetrominoManager.tetrominoTypes).toContain(tetromino.type);
    });

    test('应该生成不同类型的方块', () => {
      const generatedTypes = new Set();
      
      // 生成100个方块，应该包含多种类型
      for (let i = 0; i < 100; i++) {
        const tetromino = tetrominoManager.generateRandomTetromino();
        generatedTypes.add(tetromino.type);
      }
      
      expect(generatedTypes.size).toBeGreaterThan(1);
    });

    test('生成的方块应该在正确的初始位置', () => {
      const tetromino = tetrominoManager.generateRandomTetromino();
      
      expect(tetromino.y).toBe(0);
      expect(tetromino.x).toBeWithinRange(0, 9); // 应该在游戏板宽度内
      expect(tetromino.rotation).toBe(0);
    });
  });

  describe('createTetromino', () => {
    test('应该创建指定类型的方块', () => {
      const iTetromino = tetrominoManager.createTetromino('I');
      
      expect(iTetromino.type).toBe('I');
      expect(iTetromino.color).toBe('#00FFFF');
      expect(iTetromino.shape).toEqual([[1, 1, 1, 1]]);
    });

    test('应该为所有方块类型创建正确的形状', () => {
      const types = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
      
      types.forEach(type => {
        const tetromino = tetrominoManager.createTetromino(type);
        
        expect(tetromino.type).toBe(type);
        expect(tetromino.color).toBe(tetrominoManager.colors[type]);
        expect(tetromino.shape).toEqual(tetrominoManager.shapes[type][0]);
      });
    });
  });

  describe('rotateTetromino', () => {
    test('应该顺时针旋转方块', () => {
      const tTetromino = tetrominoManager.createTetromino('T');
      const rotated = tetrominoManager.rotateTetromino(tTetromino, 'clockwise');
      
      expect(rotated.rotation).toBe(1);
      expect(rotated.shape).toEqual(tetrominoManager.shapes.T[1]);
    });

    test('应该逆时针旋转方块', () => {
      const tTetromino = tetrominoManager.createTetromino('T');
      const rotated = tetrominoManager.rotateTetromino(tTetromino, 'counterclockwise');
      
      expect(rotated.rotation).toBe(3);
      expect(rotated.shape).toEqual(tetrominoManager.shapes.T[3]);
    });

    test('应该正确处理旋转循环', () => {
      const tTetromino = tetrominoManager.createTetromino('T');
      
      // 连续旋转4次应该回到原始状态
      let rotated = tTetromino;
      for (let i = 0; i < 4; i++) {
        rotated = tetrominoManager.rotateTetromino(rotated, 'clockwise');
      }
      
      expect(rotated.rotation).toBe(0);
      expect(rotated.shape).toEqual(tetrominoManager.shapes.T[0]);
    });

    test('O方块旋转后应该保持不变', () => {
      const oTetromino = tetrominoManager.createTetromino('O');
      const rotated = tetrominoManager.rotateTetromino(oTetromino, 'clockwise');
      
      expect(rotated.shape).toEqual(oTetromino.shape);
    });
  });

  describe('checkCollision', () => {
    let board;

    beforeEach(() => {
      // 创建空的10x20游戏板
      board = Array(20).fill().map(() => Array(10).fill(0));
    });

    test('应该检测边界碰撞', () => {
      const tetromino = tetrominoManager.createTetromino('I');
      
      // 左边界碰撞
      tetromino.x = -1;
      expect(tetrominoManager.checkCollision(tetromino, board)).toBe(true);
      
      // 右边界碰撞
      tetromino.x = 7; // I方块宽度为4，所以7+4=11 > 10
      expect(tetrominoManager.checkCollision(tetromino, board)).toBe(true);
      
      // 底部边界碰撞
      tetromino.x = 3;
      tetromino.y = 20;
      expect(tetrominoManager.checkCollision(tetromino, board)).toBe(true);
    });

    test('应该检测与已放置方块的碰撞', () => {
      const tetromino = tetrominoManager.createTetromino('O');
      tetromino.x = 4;
      tetromino.y = 18;
      
      // 在方块位置放置障碍物
      board[19][4] = 1;
      
      expect(tetrominoManager.checkCollision(tetromino, board)).toBe(true);
    });

    test('应该允许有效位置', () => {
      const tetromino = tetrominoManager.createTetromino('T');
      tetromino.x = 3;
      tetromino.y = 10;
      
      expect(tetrominoManager.checkCollision(tetromino, board)).toBe(false);
    });

    test('应该正确处理偏移量', () => {
      const tetromino = tetrominoManager.createTetromino('I');
      tetromino.x = 0;
      tetromino.y = 0;
      
      // 使用偏移量检测碰撞
      expect(tetrominoManager.checkCollision(tetromino, board, -1, 0)).toBe(true); // 左边界
      expect(tetrominoManager.checkCollision(tetromino, board, 0, -1)).toBe(false); // 顶部允许
      expect(tetrominoManager.checkCollision(tetromino, board, 1, 0)).toBe(false); // 向右移动
    });
  });

  describe('moveTetromino', () => {
    let board;

    beforeEach(() => {
      board = Array(20).fill().map(() => Array(10).fill(0));
    });

    test('应该成功移动方块到有效位置', () => {
      const tetromino = tetrominoManager.createTetromino('T');
      tetromino.x = 4;
      tetromino.y = 10;
      
      const moved = tetrominoManager.moveTetromino(tetromino, 1, 0, board);
      
      expect(moved).not.toBeNull();
      expect(moved.x).toBe(5);
      expect(moved.y).toBe(10);
    });

    test('应该拒绝移动到无效位置', () => {
      const tetromino = tetrominoManager.createTetromino('I');
      tetromino.x = 0;
      tetromino.y = 0;
      
      const moved = tetrominoManager.moveTetromino(tetromino, -1, 0, board);
      
      expect(moved).toBeNull();
    });

    test('应该保持原方块不变', () => {
      const tetromino = tetrominoManager.createTetromino('T');
      const originalX = tetromino.x;
      const originalY = tetromino.y;
      
      tetrominoManager.moveTetromino(tetromino, 1, 1, board);
      
      expect(tetromino.x).toBe(originalX);
      expect(tetromino.y).toBe(originalY);
    });
  });

  describe('tryRotate', () => {
    let board;

    beforeEach(() => {
      board = Array(20).fill().map(() => Array(10).fill(0));
    });

    test('应该成功旋转方块', () => {
      const tetromino = tetrominoManager.createTetromino('T');
      tetromino.x = 4;
      tetromino.y = 10;
      
      const rotated = tetrominoManager.tryRotate(tetromino, board);
      
      expect(rotated).not.toBeNull();
      expect(rotated.rotation).toBe(1);
    });

    test('应该使用踢墙算法', () => {
      const tetromino = tetrominoManager.createTetromino('I');
      tetromino.x = 0; // 靠近左边界
      tetromino.y = 10;
      
      const rotated = tetrominoManager.tryRotate(tetromino, board);
      
      // 应该通过踢墙成功旋转
      expect(rotated).not.toBeNull();
      expect(rotated.rotation).toBe(1);
      expect(rotated.x).toBeGreaterThan(tetromino.x); // 应该被推向右边
    });

    test('应该在无法旋转时返回null', () => {
      const tetromino = tetrominoManager.createTetromino('I');
      tetromino.x = 0;
      tetromino.y = 19; // 接近底部
      
      // 在周围放置障碍物
      for (let i = 0; i < 10; i++) {
        board[19][i] = 1;
      }
      
      const rotated = tetrominoManager.tryRotate(tetromino, board);
      
      expect(rotated).toBeNull();
    });
  });

  describe('getBoundingBox', () => {
    test('应该返回正确的边界框', () => {
      const iTetromino = tetrominoManager.createTetromino('I');
      const boundingBox = tetrominoManager.getBoundingBox(iTetromino);
      
      expect(boundingBox.width).toBe(4);
      expect(boundingBox.height).toBe(1);
    });

    test('应该为不同方块返回正确的边界框', () => {
      const oTetromino = tetrominoManager.createTetromino('O');
      const oBoundingBox = tetrominoManager.getBoundingBox(oTetromino);
      
      expect(oBoundingBox.width).toBe(2);
      expect(oBoundingBox.height).toBe(2);
      
      const tTetromino = tetrominoManager.createTetromino('T');
      const tBoundingBox = tetrominoManager.getBoundingBox(tTetromino);
      
      expect(tBoundingBox.width).toBe(3);
      expect(tBoundingBox.height).toBe(2);
    });
  });

  describe('getGhostTetromino', () => {
    let board;

    beforeEach(() => {
      board = Array(20).fill().map(() => Array(10).fill(0));
    });

    test('应该返回硬降落位置', () => {
      const tetromino = tetrominoManager.createTetromino('O');
      tetromino.x = 4;
      tetromino.y = 0;
      
      const ghost = tetrominoManager.getGhostTetromino(tetromino, board);
      
      expect(ghost.x).toBe(tetromino.x);
      expect(ghost.y).toBe(18); // 应该降落到底部
    });

    test('应该考虑已放置的方块', () => {
      const tetromino = tetrominoManager.createTetromino('I');
      tetromino.x = 3;
      tetromino.y = 0;
      
      // 在底部放置障碍物
      board[18][3] = 1;
      board[18][4] = 1;
      board[18][5] = 1;
      board[18][6] = 1;
      
      const ghost = tetrominoManager.getGhostTetromino(tetromino, board);
      
      expect(ghost.y).toBe(17); // 应该停在障碍物上方
    });

    test('应该保持原方块类型和旋转状态', () => {
      const tetromino = tetrominoManager.createTetromino('T');
      const rotated = tetrominoManager.rotateTetromino(tetromino);
      
      const ghost = tetrominoManager.getGhostTetromino(rotated, board);
      
      expect(ghost.type).toBe(rotated.type);
      expect(ghost.rotation).toBe(rotated.rotation);
      expect(ghost.shape).toEqual(rotated.shape);
    });
  });

  describe('方块形状验证', () => {
    test('所有方块形状应该是有效的二维数组', () => {
      Object.keys(tetrominoManager.shapes).forEach(type => {
        const rotations = tetrominoManager.shapes[type];
        
        expect(Array.isArray(rotations)).toBe(true);
        expect(rotations.length).toBeGreaterThan(0);
        
        rotations.forEach(shape => {
          expect(Array.isArray(shape)).toBe(true);
          expect(shape.length).toBeGreaterThan(0);
          
          shape.forEach(row => {
            expect(Array.isArray(row)).toBe(true);
            expect(row.length).toBeGreaterThan(0);
            
            row.forEach(cell => {
              expect(typeof cell).toBe('number');
              expect([0, 1]).toContain(cell);
            });
          });
        });
      });
    });

    test('每种方块应该有正确数量的旋转状态', () => {
      expect(tetrominoManager.shapes.I.length).toBe(2); // I方块有2个旋转状态
      expect(tetrominoManager.shapes.O.length).toBe(1); // O方块只有1个旋转状态
      expect(tetrominoManager.shapes.T.length).toBe(4); // T方块有4个旋转状态
      expect(tetrominoManager.shapes.S.length).toBe(2); // S方块有2个旋转状态
      expect(tetrominoManager.shapes.Z.length).toBe(2); // Z方块有2个旋转状态
      expect(tetrominoManager.shapes.J.length).toBe(4); // J方块有4个旋转状态
      expect(tetrominoManager.shapes.L.length).toBe(4); // L方块有4个旋转状态
    });
  });
});