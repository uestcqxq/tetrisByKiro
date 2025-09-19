/**
 * ScoringSystem 单元测试
 * 测试积分计算系统的所有功能
 */

const fs = require('fs');
const path = require('path');

// 读取依赖文件
const difficultyManagerSource = fs.readFileSync(
  path.join(__dirname, '../../static/js/difficulty-manager.js'),
  'utf8'
);
const scoringSystemSource = fs.readFileSync(
  path.join(__dirname, '../../static/js/scoring-system.js'),
  'utf8'
);

// 在全局作用域中执行
eval(difficultyManagerSource);
eval(scoringSystemSource);

describe('ScoringSystem', () => {
  let scoringSystem;

  beforeEach(() => {
    scoringSystem = new ScoringSystem();
  });

  describe('构造函数', () => {
    test('应该使用默认配置初始化', () => {
      expect(scoringSystem.config.lineScores[1]).toBe(100);
      expect(scoringSystem.config.lineScores[2]).toBe(300);
      expect(scoringSystem.config.lineScores[3]).toBe(500);
      expect(scoringSystem.config.lineScores[4]).toBe(800);
      expect(scoringSystem.config.softDropScore).toBe(1);
      expect(scoringSystem.config.hardDropScore).toBe(2);
    });

    test('应该接受自定义配置', () => {
      const customConfig = {
        lineScores: { 1: 200, 2: 600, 3: 1000, 4: 1600 },
        softDropScore: 2,
        hardDropScore: 4
      };
      
      const customScoring = new ScoringSystem(customConfig);
      
      expect(customScoring.config.lineScores[1]).toBe(200);
      expect(customScoring.config.softDropScore).toBe(2);
      expect(customScoring.config.hardDropScore).toBe(4);
    });

    test('应该初始化游戏统计', () => {
      expect(scoringSystem.gameStats.score).toBe(0);
      expect(scoringSystem.gameStats.combo).toBe(0);
      expect(scoringSystem.gameStats.totalPieces).toBe(0);
    });

    test('应该初始化难度管理器', () => {
      expect(scoringSystem.difficultyManager).toBeDefined();
      expect(typeof scoringSystem.getDifficultyManager).toBe('function');
    });
  });

  describe('reset', () => {
    test('应该重置所有游戏统计', () => {
      // 修改游戏状态
      scoringSystem.gameStats.score = 1000;
      scoringSystem.gameStats.combo = 5;
      scoringSystem.gameStats.totalPieces = 10;
      
      scoringSystem.reset();
      
      expect(scoringSystem.gameStats.score).toBe(0);
      expect(scoringSystem.gameStats.combo).toBe(0);
      expect(scoringSystem.gameStats.totalPieces).toBe(0);
      expect(scoringSystem.gameStats.startTime).toBeDefined();
    });

    test('应该重置难度管理器', () => {
      const initialLevel = scoringSystem.difficultyManager.getDifficultyInfo().level;
      
      // 模拟级别提升
      scoringSystem.difficultyManager.processLinesCleared(10);
      
      scoringSystem.reset();
      
      const resetLevel = scoringSystem.difficultyManager.getDifficultyInfo().level;
      expect(resetLevel).toBe(initialLevel);
    });
  });

  describe('calculateLineScore', () => {
    test('应该计算单行消除积分', () => {
      const result = scoringSystem.calculateLineScore(1, 1);
      
      expect(result.baseScore).toBe(100);
      expect(result.levelMultiplier).toBe(1);
      expect(result.totalScore).toBe(100);
    });

    test('应该计算多行消除积分', () => {
      const result = scoringSystem.calculateLineScore(4, 2); // Tetris at level 2
      
      expect(result.baseScore).toBe(800);
      expect(result.levelMultiplier).toBe(2);
      expect(result.totalScore).toBe(1600);
    });

    test('应该计算连击奖励', () => {
      scoringSystem.gameStats.combo = 3;
      
      const result = scoringSystem.calculateLineScore(2, 2);
      
      expect(result.comboBonus).toBe(300); // 50 * 3 * 2
      expect(result.totalScore).toBe((300 + 300) * 2); // (base + combo) * level
    });

    test('应该计算T-Spin奖励', () => {
      const result = scoringSystem.calculateLineScore(1, 1, true, 'single');
      
      expect(result.tSpinBonus).toBe(800);
      expect(result.totalScore).toBe(900); // (100 + 800) * 1
    });

    test('应该计算完美清除奖励', () => {
      const result = scoringSystem.calculateLineScore(4, 1, false, null, true);
      
      expect(result.perfectClearBonus).toBe(2000);
      expect(result.totalScore).toBe(2800); // (800 + 2000) * 1
    });

    test('应该处理零行消除', () => {
      const result = scoringSystem.calculateLineScore(0, 1);
      
      expect(result.baseScore).toBe(0);
      expect(result.totalScore).toBe(0);
    });

    test('应该使用当前级别如果未指定', () => {
      // 设置难度管理器的级别
      scoringSystem.difficultyManager.processLinesCleared(10); // 提升级别
      
      const result = scoringSystem.calculateLineScore(1);
      
      expect(result.levelMultiplier).toBeGreaterThan(1);
    });
  });

  describe('processLineClears', () => {
    test('应该更新连击计数', () => {
      scoringSystem.processLineClears(2);
      expect(scoringSystem.gameStats.combo).toBe(1);
      
      scoringSystem.processLineClears(1);
      expect(scoringSystem.gameStats.combo).toBe(2);
      
      scoringSystem.processLineClears(0);
      expect(scoringSystem.gameStats.combo).toBe(0);
    });

    test('应该更新总分', () => {
      const initialScore = scoringSystem.gameStats.score;
      
      scoringSystem.processLineClears(2);
      
      expect(scoringSystem.gameStats.score).toBeGreaterThan(initialScore);
    });

    test('应该处理难度调整', () => {
      const initialLevel = scoringSystem.difficultyManager.getDifficultyInfo().level;
      
      // 消除足够的行来提升级别
      scoringSystem.processLineClears(10);
      
      const newLevel = scoringSystem.difficultyManager.getDifficultyInfo().level;
      expect(newLevel).toBeGreaterThanOrEqual(initialLevel);
    });

    test('应该创建积分动画', () => {
      const initialAnimations = scoringSystem.scoreAnimations.length;
      
      scoringSystem.processLineClears(4); // Tetris
      
      expect(scoringSystem.scoreAnimations.length).toBeGreaterThan(initialAnimations);
    });

    test('应该触发回调函数', () => {
      const scoreCallback = jest.fn();
      const levelCallback = jest.fn();
      const comboCallback = jest.fn();
      
      scoringSystem.setCallback('scoreUpdate', scoreCallback);
      scoringSystem.setCallback('levelUpdate', levelCallback);
      scoringSystem.setCallback('comboUpdate', comboCallback);
      
      scoringSystem.processLineClears(2);
      
      expect(scoreCallback).toHaveBeenCalled();
      expect(comboCallback).toHaveBeenCalled();
    });
  });

  describe('processSoftDrop', () => {
    test('应该计算软降落积分', () => {
      const initialScore = scoringSystem.gameStats.score;
      
      const score = scoringSystem.processSoftDrop(5);
      
      expect(score).toBe(5); // 5 * 1
      expect(scoringSystem.gameStats.score).toBe(initialScore + 5);
    });

    test('应该触发积分更新回调', () => {
      const callback = jest.fn();
      scoringSystem.setCallback('scoreUpdate', callback);
      
      scoringSystem.processSoftDrop(3);
      
      expect(callback).toHaveBeenCalledWith(3, 3);
    });
  });

  describe('processHardDrop', () => {
    test('应该计算硬降落积分', () => {
      const initialScore = scoringSystem.gameStats.score;
      
      const score = scoringSystem.processHardDrop(10);
      
      expect(score).toBe(20); // 10 * 2
      expect(scoringSystem.gameStats.score).toBe(initialScore + 20);
    });

    test('应该触发积分更新回调', () => {
      const callback = jest.fn();
      scoringSystem.setCallback('scoreUpdate', callback);
      
      scoringSystem.processHardDrop(8);
      
      expect(callback).toHaveBeenCalledWith(16, 16);
    });
  });

  describe('getDropSpeed', () => {
    test('应该返回当前级别的下落速度', () => {
      const speed = scoringSystem.getDropSpeed();
      
      expect(typeof speed).toBe('number');
      expect(speed).toBeGreaterThan(0);
    });

    test('应该随级别变化而变化', () => {
      const initialSpeed = scoringSystem.getDropSpeed();
      
      // 提升级别
      scoringSystem.difficultyManager.processLinesCleared(10);
      
      const newSpeed = scoringSystem.getDropSpeed();
      expect(newSpeed).toBeLessThanOrEqual(initialSpeed); // 速度应该更快（时间更短）
    });
  });

  describe('积分动画管理', () => {
    test('应该添加积分动画', () => {
      const scoreResult = {
        totalScore: 800,
        baseScore: 800,
        comboBonus: 0,
        tSpinBonus: 0,
        perfectClearBonus: 0
      };
      
      scoringSystem.addScoreAnimation(scoreResult);
      
      expect(scoringSystem.scoreAnimations.length).toBe(1);
      expect(scoringSystem.scoreAnimations[0].score).toBe(800);
    });

    test('应该自动清理过期动画', (done) => {
      const scoreResult = {
        totalScore: 100,
        baseScore: 100,
        comboBonus: 0,
        tSpinBonus: 0,
        perfectClearBonus: 0
      };
      
      // 使用短动画时间进行测试
      scoringSystem.addScoreAnimation(scoreResult);
      scoringSystem.scoreAnimations[0].duration = 50; // 50ms
      
      setTimeout(() => {
        expect(scoringSystem.scoreAnimations.length).toBe(0);
        done();
      }, 100);
    });

    test('应该正确识别动画类型', () => {
      const tetrisResult = { baseScore: 800, tSpinBonus: 0, comboBonus: 0, perfectClearBonus: 0 };
      const tSpinResult = { baseScore: 100, tSpinBonus: 800, comboBonus: 0, perfectClearBonus: 0 };
      const perfectResult = { baseScore: 800, tSpinBonus: 0, comboBonus: 0, perfectClearBonus: 2000 };
      
      expect(scoringSystem.getAnimationType(tetrisResult)).toBe('tetris');
      expect(scoringSystem.getAnimationType(tSpinResult)).toBe('t-spin');
      expect(scoringSystem.getAnimationType(perfectResult)).toBe('perfect-clear');
    });

    test('应该获取活跃动画列表', () => {
      const scoreResult = { totalScore: 100, baseScore: 100, comboBonus: 0, tSpinBonus: 0, perfectClearBonus: 0 };
      
      scoringSystem.addScoreAnimation(scoreResult);
      scoringSystem.addScoreAnimation(scoreResult);
      
      const activeAnimations = scoringSystem.getActiveAnimations();
      
      expect(activeAnimations.length).toBe(2);
      expect(Array.isArray(activeAnimations)).toBe(true);
    });
  });

  describe('incrementPieceCount', () => {
    test('应该增加方块计数', () => {
      const initialCount = scoringSystem.gameStats.totalPieces;
      
      scoringSystem.incrementPieceCount();
      
      expect(scoringSystem.gameStats.totalPieces).toBe(initialCount + 1);
    });
  });

  describe('getGameStats', () => {
    test('应该返回完整的游戏统计', () => {
      scoringSystem.gameStats.score = 1000;
      scoringSystem.gameStats.totalPieces = 50;
      scoringSystem.startGame();
      
      const stats = scoringSystem.getGameStats();
      
      expect(stats.score).toBe(1000);
      expect(stats.totalPieces).toBe(50);
      expect(stats.pps).toBeDefined();
      expect(stats.lpm).toBeDefined();
      expect(stats.efficiency).toBeDefined();
      expect(stats.level).toBeDefined();
    });

    test('应该计算正确的PPS', () => {
      scoringSystem.gameStats.totalPieces = 60;
      scoringSystem.gameStats.gameTime = 60000; // 60秒
      
      const stats = scoringSystem.getGameStats();
      
      expect(parseFloat(stats.pps)).toBe(1.0); // 60 pieces / 60 seconds
    });

    test('应该处理零时间情况', () => {
      scoringSystem.gameStats.totalPieces = 10;
      scoringSystem.gameStats.gameTime = 0;
      
      const stats = scoringSystem.getGameStats();
      
      expect(parseFloat(stats.pps)).toBe(0);
      expect(parseFloat(stats.lpm)).toBe(0);
    });
  });

  describe('setCallback', () => {
    test('应该设置有效的回调函数', () => {
      const callback = jest.fn();
      
      scoringSystem.setCallback('scoreUpdate', callback);
      
      expect(scoringSystem.callbacks.onScoreUpdate).toBe(callback);
    });

    test('应该忽略无效的回调名称', () => {
      const callback = jest.fn();
      
      scoringSystem.setCallback('invalidCallback', callback);
      
      expect(scoringSystem.callbacks.onInvalidCallback).toBeUndefined();
    });
  });

  describe('getLevelProgress', () => {
    test('应该返回级别进度信息', () => {
      const progress = scoringSystem.getLevelProgress();
      
      expect(progress).toBeDefined();
      expect(typeof progress).toBe('object');
    });
  });

  describe('exportGameData', () => {
    test('应该导出完整的游戏数据', () => {
      scoringSystem.gameStats.score = 5000;
      scoringSystem.gameStats.totalPieces = 100;
      scoringSystem.gameStats.gameTime = 300000; // 5分钟
      
      const exportedData = scoringSystem.exportGameData();
      
      expect(exportedData.score).toBe(5000);
      expect(exportedData.totalPieces).toBe(100);
      expect(exportedData.gameTime).toBe(300000);
      expect(exportedData.level).toBeDefined();
      expect(exportedData.lines).toBeDefined();
      expect(exportedData.pps).toBeDefined();
      expect(exportedData.lpm).toBeDefined();
      expect(exportedData.efficiency).toBeDefined();
      expect(exportedData.difficultyData).toBeDefined();
    });

    test('导出的数据应该可序列化', () => {
      const exportedData = scoringSystem.exportGameData();
      
      expect(() => JSON.stringify(exportedData)).not.toThrow();
      
      const jsonString = JSON.stringify(exportedData);
      const parsedData = JSON.parse(jsonString);
      
      expect(parsedData.score).toBe(exportedData.score);
    });
  });

  describe('startGame 和 updateGameTime', () => {
    test('应该设置游戏开始时间', () => {
      scoringSystem.startGame();
      
      expect(scoringSystem.gameStats.startTime).toBeDefined();
      expect(typeof scoringSystem.gameStats.startTime).toBe('number');
    });

    test('应该更新游戏时间', () => {
      scoringSystem.startGame();
      
      // 模拟时间流逝
      const originalNow = Date.now;
      Date.now = jest.fn(() => scoringSystem.gameStats.startTime + 5000);
      
      scoringSystem.updateGameTime();
      
      expect(scoringSystem.gameStats.gameTime).toBe(5000);
      
      // 恢复原始Date.now
      Date.now = originalNow;
    });
  });

  describe('效率计算', () => {
    test('应该计算正确的游戏效率', () => {
      scoringSystem.gameStats.totalPieces = 100;
      
      // 模拟消除了40行
      for (let i = 0; i < 10; i++) {
        scoringSystem.difficultyManager.processLinesCleared(4);
      }
      
      const efficiency = scoringSystem.calculateEfficiency();
      
      expect(parseFloat(efficiency)).toBe(40.0); // 40 lines / 100 pieces * 100%
    });

    test('应该处理零方块情况', () => {
      scoringSystem.gameStats.totalPieces = 0;
      
      const efficiency = scoringSystem.calculateEfficiency();
      
      expect(parseFloat(efficiency)).toBe(0);
    });
  });
});