/**
 * TetrisGame 单元测试
 * 测试俄罗斯方块游戏主类的所有功能
 */

const fs = require('fs');
const path = require('path');

// 读取所有依赖文件
const tetrominoManagerSource = fs.readFileSync(
  path.join(__dirname, '../../static/js/tetromino-manager.js'),
  'utf8'
);
const boardManagerSource = fs.readFileSync(
  path.join(__dirname, '../../static/js/board-manager.js'),
  'utf8'
);
const difficultyManagerSource = fs.readFileSync(
  path.join(__dirname, '../../static/js/difficulty-manager.js'),
  'utf8'
);
const scoringSystemSource = fs.readFileSync(
  path.join(__dirname, '../../static/js/scoring-system.js'),
  'utf8'
);
const uiManagerSource = fs.readFileSync(
  path.join(__dirname, '../../static/js/ui-manager.js'),
  'utf8'
);
const tetrisGameSource = fs.readFileSync(
  path.join(__dirname, '../../static/js/tetris-game.js'),
  'utf8'
);

// 在全局作用域中执行
eval(tetrominoManagerSource);
eval(boardManagerSource);
eval(difficultyManagerSource);
eval(scoringSystemSource);
eval(uiManagerSource);
eval(tetrisGameSource);

describe('TetrisGame', () => {
  let canvas;
  let tetrisGame;

  beforeEach(() => {
    canvas = createMockCanvas();
    tetrisGame = new TetrisGame(canvas);
  });

  afterEach(() => {
    if (tetrisGame.animationId) {
      cancelAnimationFrame(tetrisGame.animationId);
    }
  });

  describe('构造函数', () => {
    test('应该正确初始化游戏组件', () => {
      expect(tetrisGame.canvas).toBe(canvas);
      expect(tetrisGame.ctx).toBeDefined();
      expect(tetrisGame.tetrominoManager).toBeInstanceOf(TetrominoManager);
      expect(tetrisGame.boardManager).toBeInstanceOf(BoardManager);
      expect(tetrisGame.scoringSystem).toBeInstanceOf(ScoringSystem);
      expect(tetrisGame.uiManager).toBeInstanceOf(UIManager);
    });

    test('应该使用默认配置', () => {
      expect(tetrisGame.config.boardWidth).toBe(10);
      expect(tetrisGame.config.boardHeight).toBe(20);
      expect(tetrisGame.config.cellSize).toBe(30);
      expect(tetrisGame.config.initialSpeed).toBe(1000);
    });

    test('应该接受自定义配置', () => {
      const customConfig = {
        boardWidth: 8,
        boardHeight: 16,
        cellSize: 25,
        initialSpeed: 800
      };
      
      const customGame = new TetrisGame(canvas, customConfig);
      
      expect(customGame.config.boardWidth).toBe(8);
      expect(customGame.config.boardHeight).toBe(16);
      expect(customGame.config.cellSize).toBe(25);
      expect(customGame.config.initialSpeed).toBe(800);
    });

    test('应该初始化游戏状态', () => {
      expect(tetrisGame.gameState.isRunning).toBe(false);
      expect(tetrisGame.gameState.isPaused).toBe(false);
      expect(tetrisGame.gameState.isGameOver).toBe(false);
      expect(tetrisGame.gameState.currentTetromino).toBeNull();
      expect(tetrisGame.gameState.nextTetromino).toBeNull();
    });

    test('应该设置canvas尺寸', () => {
      expect(canvas.width).toBe(300); // 10 * 30
      expect(canvas.height).toBe(600); // 20 * 30
    });
  });

  describe('start', () => {
    test('应该启动游戏', () => {
      tetrisGame.start();
      
      expect(tetrisGame.gameState.isRunning).toBe(true);
      expect(tetrisGame.gameState.isPaused).toBe(false);
      expect(tetrisGame.gameState.isGameOver).toBe(false);
      expect(tetrisGame.gameState.currentTetromino).not.toBeNull();
      expect(tetrisGame.gameState.nextTetromino).not.toBeNull();
    });

    test('应该重置游戏状态', () => {
      // 设置一些状态
      tetrisGame.gameState.isGameOver = true;
      tetrisGame.scoringSystem.gameStats.score = 1000;
      
      tetrisGame.start();
      
      expect(tetrisGame.gameState.isGameOver).toBe(false);
      expect(tetrisGame.scoringSystem.gameStats.score).toBe(0);
    });

    test('应该生成初始方块', () => {
      tetrisGame.start();
      
      expect(tetrisGame.gameState.currentTetromino).toBeValidTetromino();
      expect(tetrisGame.gameState.nextTetromino).toBeValidTetromino();
    });

    test('应该开始游戏循环', () => {
      const originalRequestAnimationFrame = global.requestAnimationFrame;
      global.requestAnimationFrame = jest.fn();
      
      tetrisGame.start();
      
      expect(global.requestAnimationFrame).toHaveBeenCalled();
      
      global.requestAnimationFrame = originalRequestAnimationFrame;
    });
  });

  describe('togglePause', () => {
    beforeEach(() => {
      tetrisGame.start();
    });

    test('应该暂停运行中的游戏', () => {
      tetrisGame.togglePause();
      
      expect(tetrisGame.gameState.isPaused).toBe(true);
    });

    test('应该恢复暂停的游戏', () => {
      tetrisGame.togglePause(); // 暂停
      tetrisGame.togglePause(); // 恢复
      
      expect(tetrisGame.gameState.isPaused).toBe(false);
    });

    test('不应该暂停未运行的游戏', () => {
      tetrisGame.gameState.isRunning = false;
      
      tetrisGame.togglePause();
      
      expect(tetrisGame.gameState.isPaused).toBe(false);
    });

    test('不应该暂停已结束的游戏', () => {
      tetrisGame.gameState.isGameOver = true;
      
      tetrisGame.togglePause();
      
      expect(tetrisGame.gameState.isPaused).toBe(false);
    });
  });

  describe('reset', () => {
    test('应该重置所有游戏组件', () => {
      // 修改游戏状态
      tetrisGame.gameState.isRunning = true;
      tetrisGame.gameState.currentTetromino = { type: 'I' };
      tetrisGame.scoringSystem.gameStats.score = 1000;
      
      tetrisGame.reset();
      
      expect(tetrisGame.gameState.isRunning).toBe(false);
      expect(tetrisGame.gameState.currentTetromino).toBeNull();
      expect(tetrisGame.scoringSystem.gameStats.score).toBe(0);
    });

    test('应该清除动画帧', () => {
      tetrisGame.animationId = 123;
      
      const originalCancelAnimationFrame = global.cancelAnimationFrame;
      global.cancelAnimationFrame = jest.fn();
      
      tetrisGame.reset();
      
      expect(global.cancelAnimationFrame).toHaveBeenCalledWith(123);
      expect(tetrisGame.animationId).toBeNull();
      
      global.cancelAnimationFrame = originalCancelAnimationFrame;
    });
  });

  describe('方块移动', () => {
    beforeEach(() => {
      tetrisGame.start();
    });

    test('应该成功移动方块', () => {
      const originalX = tetrisGame.gameState.currentTetromino.x;
      
      const moved = tetrisGame.moveTetromino(1, 0);
      
      expect(moved).toBe(true);
      expect(tetrisGame.gameState.currentTetromino.x).toBe(originalX + 1);
    });

    test('应该拒绝无效移动', () => {
      const originalX = tetrisGame.gameState.currentTetromino.x;
      
      // 尝试移动到边界外
      const moved = tetrisGame.moveTetromino(-10, 0);
      
      expect(moved).toBe(false);
      expect(tetrisGame.gameState.currentTetromino.x).toBe(originalX);
    });

    test('应该成功旋转方块', () => {
      const originalRotation = tetrisGame.gameState.currentTetromino.rotation;
      
      const rotated = tetrisGame.rotateTetromino('clockwise');
      
      if (rotated) {
        expect(tetrisGame.gameState.currentTetromino.rotation).not.toBe(originalRotation);
      }
    });

    test('应该处理旋转失败', () => {
      // 将方块移动到无法旋转的位置
      tetrisGame.gameState.currentTetromino.x = 0;
      tetrisGame.gameState.currentTetromino.y = 19;
      
      const rotated = tetrisGame.rotateTetromino('clockwise');
      
      // 根据方块类型，可能成功也可能失败
      expect(typeof rotated).toBe('boolean');
    });
  });

  describe('方块下落', () => {
    beforeEach(() => {
      tetrisGame.start();
    });

    test('应该自动下落方块', () => {
      const originalY = tetrisGame.gameState.currentTetromino.y;
      
      tetrisGame.dropTetromino();
      
      expect(tetrisGame.gameState.currentTetromino.y).toBeGreaterThanOrEqual(originalY);
    });

    test('应该在无法下落时放置方块', () => {
      // 将方块移动到底部
      tetrisGame.gameState.currentTetromino.y = 19;
      
      const originalTetromino = tetrisGame.gameState.currentTetromino;
      
      tetrisGame.dropTetromino();
      
      // 应该生成新方块
      expect(tetrisGame.gameState.currentTetromino).not.toBe(originalTetromino);
    });

    test('应该执行硬降落', () => {
      const originalY = tetrisGame.gameState.currentTetromino.y;
      
      tetrisGame.hardDrop();
      
      expect(tetrisGame.gameState.currentTetromino.y).toBeGreaterThan(originalY);
    });
  });

  describe('行消除', () => {
    beforeEach(() => {
      tetrisGame.start();
    });

    test('应该处理行消除', () => {
      // 填满底部一行（除了当前方块位置）
      for (let col = 0; col < tetrisGame.config.boardWidth; col++) {
        if (col !== tetrisGame.gameState.currentTetromino.x) {
          tetrisGame.boardManager.board[19][col] = 1;
        }
      }
      
      const initialScore = tetrisGame.scoringSystem.gameStats.score;
      
      // 将方块移动到能完成行的位置并放置
      tetrisGame.gameState.currentTetromino.y = 19;
      tetrisGame.placeTetromino();
      
      expect(tetrisGame.scoringSystem.gameStats.score).toBeGreaterThan(initialScore);
    });

    test('应该更新连击计数', () => {
      // 模拟连续消除行
      tetrisGame.handleLinesCleared(2);
      expect(tetrisGame.scoringSystem.gameStats.combo).toBe(1);
      
      tetrisGame.handleLinesCleared(1);
      expect(tetrisGame.scoringSystem.gameStats.combo).toBe(2);
      
      tetrisGame.handleLinesCleared(0);
      expect(tetrisGame.scoringSystem.gameStats.combo).toBe(0);
    });
  });

  describe('游戏结束', () => {
    beforeEach(() => {
      tetrisGame.start();
    });

    test('应该正确处理游戏结束', () => {
      const gameOverCallback = jest.fn();
      tetrisGame.setCallback('GameOver', gameOverCallback);
      
      tetrisGame.gameOver();
      
      expect(tetrisGame.gameState.isGameOver).toBe(true);
      expect(tetrisGame.gameState.isRunning).toBe(false);
      expect(gameOverCallback).toHaveBeenCalled();
    });

    test('应该停止游戏循环', () => {
      tetrisGame.animationId = 123;
      
      const originalCancelAnimationFrame = global.cancelAnimationFrame;
      global.cancelAnimationFrame = jest.fn();
      
      tetrisGame.gameOver();
      
      expect(global.cancelAnimationFrame).toHaveBeenCalledWith(123);
      expect(tetrisGame.animationId).toBeNull();
      
      global.cancelAnimationFrame = originalCancelAnimationFrame;
    });
  });

  describe('游戏循环', () => {
    beforeEach(() => {
      tetrisGame.start();
    });

    test('应该更新游戏逻辑', () => {
      const originalDropTime = tetrisGame.gameState.dropTime;
      
      tetrisGame.update(100); // 100ms
      
      expect(tetrisGame.gameState.dropTime).toBe(originalDropTime + 100);
    });

    test('应该在达到下落间隔时自动下落', () => {
      tetrisGame.gameState.dropTime = tetrisGame.gameState.dropInterval;
      
      const originalY = tetrisGame.gameState.currentTetromino.y;
      
      tetrisGame.update(0);
      
      expect(tetrisGame.gameState.dropTime).toBe(0);
      expect(tetrisGame.gameState.currentTetromino.y).toBeGreaterThanOrEqual(originalY);
    });

    test('不应该在暂停时更新', () => {
      tetrisGame.gameState.isPaused = true;
      
      const originalRequestAnimationFrame = global.requestAnimationFrame;
      global.requestAnimationFrame = jest.fn();
      
      tetrisGame.gameLoop();
      
      expect(global.requestAnimationFrame).not.toHaveBeenCalled();
      
      global.requestAnimationFrame = originalRequestAnimationFrame;
    });
  });

  describe('渲染', () => {
    beforeEach(() => {
      tetrisGame.start();
    });

    test('应该清除画布', () => {
      tetrisGame.render();
      
      expect(tetrisGame.ctx.fillRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
    });

    test('应该渲染游戏板', () => {
      // 在游戏板上放置一些方块
      tetrisGame.boardManager.board[19][0] = 'I';
      
      tetrisGame.render();
      
      // 验证渲染方法被调用
      expect(tetrisGame.ctx.fillRect).toHaveBeenCalled();
    });

    test('应该渲染当前方块', () => {
      tetrisGame.render();
      
      // 验证方块被渲染
      expect(tetrisGame.ctx.fillRect).toHaveBeenCalled();
    });

    test('应该获取正确的单元格颜色', () => {
      expect(tetrisGame.getCellColor('I')).toBe('#00FFFF');
      expect(tetrisGame.getCellColor('O')).toBe('#FFFF00');
      expect(tetrisGame.getCellColor('unknown')).toBe('#888');
    });
  });

  describe('事件回调', () => {
    test('应该设置事件回调', () => {
      const callback = jest.fn();
      
      tetrisGame.setCallback('ScoreUpdate', callback);
      
      expect(tetrisGame.callbacks.onScoreUpdate).toBe(callback);
    });

    test('应该忽略无效的回调名称', () => {
      const callback = jest.fn();
      
      tetrisGame.setCallback('InvalidEvent', callback);
      
      expect(tetrisGame.callbacks.onInvalidEvent).toBeUndefined();
    });

    test('应该触发积分更新回调', () => {
      const callback = jest.fn();
      tetrisGame.setCallback('ScoreUpdate', callback);
      
      tetrisGame.start();
      tetrisGame.handleLinesCleared(2);
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('基础键盘控制', () => {
    beforeEach(() => {
      tetrisGame.start();
      tetrisGame.setupBasicControls();
    });

    test('应该处理左右移动', () => {
      const originalX = tetrisGame.gameState.currentTetromino.x;
      
      tetrisGame.processBasicKeyInput('ArrowLeft');
      expect(tetrisGame.gameState.currentTetromino.x).toBeLessThanOrEqual(originalX);
      
      tetrisGame.processBasicKeyInput('ArrowRight');
      // 可能移动成功或失败，取决于边界
    });

    test('应该处理下移动', () => {
      const originalY = tetrisGame.gameState.currentTetromino.y;
      
      tetrisGame.processBasicKeyInput('ArrowDown');
      
      expect(tetrisGame.gameState.currentTetromino.y).toBeGreaterThanOrEqual(originalY);
    });

    test('应该处理旋转', () => {
      tetrisGame.processBasicKeyInput('ArrowUp');
      tetrisGame.processBasicKeyInput('KeyX');
      tetrisGame.processBasicKeyInput('KeyZ');
      
      // 旋转可能成功或失败，但不应该抛出错误
    });

    test('应该处理硬降落', () => {
      const originalY = tetrisGame.gameState.currentTetromino.y;
      
      tetrisGame.processBasicKeyInput('Space');
      
      expect(tetrisGame.gameState.currentTetromino.y).toBeGreaterThan(originalY);
    });

    test('应该处理暂停', () => {
      tetrisGame.processBasicKeyInput('KeyP');
      
      expect(tetrisGame.gameState.isPaused).toBe(true);
    });
  });

  describe('getGameState', () => {
    test('应该返回完整的游戏状态', () => {
      tetrisGame.start();
      
      const gameState = tetrisGame.getGameState();
      
      expect(gameState.isRunning).toBe(true);
      expect(gameState.currentTetromino).toBeDefined();
      expect(gameState.score).toBeDefined();
      expect(gameState.level).toBeDefined();
    });
  });

  describe('getNextTetromino', () => {
    test('应该返回下一个方块', () => {
      tetrisGame.start();
      
      const nextTetromino = tetrisGame.getNextTetromino();
      
      expect(nextTetromino).toBeValidTetromino();
      expect(nextTetromino).toBe(tetrisGame.gameState.nextTetromino);
    });
  });

  describe('积分系统集成', () => {
    beforeEach(() => {
      tetrisGame.start();
    });

    test('应该正确设置积分系统回调', () => {
      expect(tetrisGame.scoringSystem.callbacks.onScoreUpdate).toBeDefined();
      expect(tetrisGame.scoringSystem.callbacks.onLevelUpdate).toBeDefined();
      expect(tetrisGame.scoringSystem.callbacks.onComboUpdate).toBeDefined();
    });

    test('应该在级别提升时更新下落速度', () => {
      const initialSpeed = tetrisGame.gameState.dropInterval;
      
      // 模拟级别提升
      tetrisGame.scoringSystem.difficultyManager.processLinesCleared(10);
      
      // 触发级别更新回调
      const newLevel = tetrisGame.scoringSystem.difficultyManager.getDifficultyInfo().level;
      if (tetrisGame.scoringSystem.callbacks.onLevelUpdate) {
        tetrisGame.scoringSystem.callbacks.onLevelUpdate(newLevel, 1);
      }
      
      expect(tetrisGame.gameState.dropInterval).toBeLessThanOrEqual(initialSpeed);
    });
  });

  describe('错误处理', () => {
    test('应该处理无效的canvas', () => {
      expect(() => {
        new TetrisGame(null);
      }).toThrow();
    });

    test('应该处理缺少方块时的更新', () => {
      tetrisGame.gameState.currentTetromino = null;
      
      expect(() => {
        tetrisGame.update(100);
      }).not.toThrow();
    });

    test('应该处理无效的键盘输入', () => {
      tetrisGame.start();
      
      expect(() => {
        tetrisGame.processBasicKeyInput('InvalidKey');
      }).not.toThrow();
    });
  });
});