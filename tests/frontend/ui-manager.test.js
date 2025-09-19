/**
 * UIManager 单元测试
 * 测试用户界面管理器的所有功能
 */

const fs = require('fs');
const path = require('path');

// 读取源文件
const uiManagerSource = fs.readFileSync(
  path.join(__dirname, '../../static/js/ui-manager.js'),
  'utf8'
);
eval(uiManagerSource);

describe('UIManager', () => {
  let uiManager;
  let mockElements;

  beforeEach(() => {
    // 创建模拟DOM元素
    mockElements = {
      score: { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } },
      level: { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } },
      lines: { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } },
      nextPiece: { innerHTML: '', classList: { add: jest.fn(), remove: jest.fn() } },
      gameStats: { style: { display: '' }, innerHTML: '' },
      levelProgress: { style: { width: '' } },
      comboDisplay: { textContent: '', style: { display: '' } },
      difficultyIndicator: { textContent: '', className: '' }
    };

    // 模拟document.getElementById
    document.getElementById = jest.fn((id) => {
      const elementMap = {
        'score-display': mockElements.score,
        'level-display': mockElements.level,
        'lines-display': mockElements.lines,
        'next-piece-display': mockElements.nextPiece,
        'game-stats': mockElements.gameStats,
        'level-progress': mockElements.levelProgress,
        'combo-display': mockElements.comboDisplay,
        'difficulty-indicator': mockElements.difficultyIndicator
      };
      return elementMap[id] || null;
    });

    uiManager = new UIManager();
  });

  describe('构造函数', () => {
    test('应该初始化UI元素引用', () => {
      expect(uiManager.elements).toBeDefined();
      expect(uiManager.elements.score).toBe(mockElements.score);
      expect(uiManager.elements.level).toBe(mockElements.level);
    });

    test('应该初始化动画队列', () => {
      expect(Array.isArray(uiManager.animations)).toBe(true);
      expect(uiManager.animations.length).toBe(0);
    });

    test('应该处理缺失的DOM元素', () => {
      document.getElementById = jest.fn(() => null);
      
      expect(() => {
        new UIManager();
      }).not.toThrow();
    });
  });

  describe('updateScore', () => {
    test('应该更新分数显示', () => {
      uiManager.updateScore(15000);
      
      expect(mockElements.score.textContent).toBe('15,000');
    });

    test('应该显示分数增加动画', () => {
      uiManager.updateScore(5000, 1000);
      
      expect(mockElements.score.classList.add).toHaveBeenCalledWith('score-increase');
    });

    test('应该处理零分数', () => {
      uiManager.updateScore(0);
      
      expect(mockElements.score.textContent).toBe('0');
    });

    test('应该处理大数字格式化', () => {
      uiManager.updateScore(1234567);
      
      expect(mockElements.score.textContent).toBe('1,234,567');
    });

    test('应该处理缺失的分数元素', () => {
      uiManager.elements.score = null;
      
      expect(() => {
        uiManager.updateScore(1000);
      }).not.toThrow();
    });
  });

  describe('updateLevel', () => {
    test('应该更新级别显示', () => {
      uiManager.updateLevel(5);
      
      expect(mockElements.level.textContent).toBe('5');
    });

    test('应该显示级别提升动画', () => {
      uiManager.updateLevel(3, 2);
      
      expect(mockElements.level.classList.add).toHaveBeenCalledWith('level-up');
    });

    test('应该处理相同级别', () => {
      uiManager.updateLevel(2, 2);
      
      expect(mockElements.level.classList.add).not.toHaveBeenCalledWith('level-up');
    });

    test('应该处理级别下降', () => {
      uiManager.updateLevel(1, 2);
      
      expect(mockElements.level.textContent).toBe('1');
    });
  });

  describe('updateLines', () => {
    test('应该更新消除行数显示', () => {
      uiManager.updateLines(25);
      
      expect(mockElements.lines.textContent).toBe('25');
    });

    test('应该显示行数增加动画', () => {
      uiManager.updateLines(10, 5);
      
      expect(mockElements.lines.classList.add).toHaveBeenCalledWith('lines-increase');
    });

    test('应该处理零行数', () => {
      uiManager.updateLines(0);
      
      expect(mockElements.lines.textContent).toBe('0');
    });
  });

  describe('updateNextPiece', () => {
    test('应该显示下一个方块', () => {
      const nextTetromino = {
        type: 'T',
        shape: [[0, 1, 0], [1, 1, 1]],
        color: '#800080'
      };
      
      uiManager.updateNextPiece(nextTetromino);
      
      expect(mockElements.nextPiece.innerHTML).toContain('tetromino-preview');
    });

    test('应该处理不同类型的方块', () => {
      const tetrominoes = [
        { type: 'I', shape: [[1, 1, 1, 1]], color: '#00FFFF' },
        { type: 'O', shape: [[1, 1], [1, 1]], color: '#FFFF00' },
        { type: 'L', shape: [[0, 0, 1], [1, 1, 1]], color: '#FFA500' }
      ];
      
      tetrominoes.forEach(tetromino => {
        expect(() => {
          uiManager.updateNextPiece(tetromino);
        }).not.toThrow();
      });
    });

    test('应该处理空方块', () => {
      expect(() => {
        uiManager.updateNextPiece(null);
      }).not.toThrow();
    });
  });

  describe('showGameStats', () => {
    test('应该显示游戏统计信息', () => {
      const stats = {
        score: 25000,
        level: 8,
        lines: 45,
        totalPieces: 120,
        gameTime: 300000, // 5分钟
        pps: '2.5',
        lpm: '9.0',
        efficiency: '37.5'
      };
      
      uiManager.showGameStats(stats);
      
      expect(mockElements.gameStats.style.display).toBe('block');
      expect(mockElements.gameStats.innerHTML).toContain('25,000');
      expect(mockElements.gameStats.innerHTML).toContain('8');
      expect(mockElements.gameStats.innerHTML).toContain('45');
    });

    test('应该格式化游戏时间', () => {
      const stats = {
        score: 1000,
        gameTime: 125000 // 2分5秒
      };
      
      uiManager.showGameStats(stats);
      
      expect(mockElements.gameStats.innerHTML).toContain('2:05');
    });

    test('应该处理长时间游戏', () => {
      const stats = {
        score: 1000,
        gameTime: 3665000 // 1小时1分5秒
      };
      
      uiManager.showGameStats(stats);
      
      expect(mockElements.gameStats.innerHTML).toContain('1:01:05');
    });

    test('应该处理缺失的统计数据', () => {
      const incompleteStats = {
        score: 1000
      };
      
      expect(() => {
        uiManager.showGameStats(incompleteStats);
      }).not.toThrow();
    });
  });

  describe('updateLevelProgress', () => {
    test('应该更新级别进度条', () => {
      const progress = {
        currentLines: 7,
        linesNeeded: 10,
        percentage: 70
      };
      
      uiManager.updateLevelProgress(progress);
      
      expect(mockElements.levelProgress.style.width).toBe('70%');
    });

    test('应该处理100%进度', () => {
      const progress = {
        currentLines: 10,
        linesNeeded: 10,
        percentage: 100
      };
      
      uiManager.updateLevelProgress(progress);
      
      expect(mockElements.levelProgress.style.width).toBe('100%');
    });

    test('应该处理0%进度', () => {
      const progress = {
        currentLines: 0,
        linesNeeded: 10,
        percentage: 0
      };
      
      uiManager.updateLevelProgress(progress);
      
      expect(mockElements.levelProgress.style.width).toBe('0%');
    });
  });

  describe('updateCombo', () => {
    test('应该显示连击信息', () => {
      uiManager.updateCombo(5);
      
      expect(mockElements.comboDisplay.textContent).toContain('5');
      expect(mockElements.comboDisplay.style.display).toBe('block');
    });

    test('应该隐藏零连击', () => {
      uiManager.updateCombo(0);
      
      expect(mockElements.comboDisplay.style.display).toBe('none');
    });

    test('应该处理高连击数', () => {
      uiManager.updateCombo(15);
      
      expect(mockElements.comboDisplay.textContent).toContain('15');
    });
  });

  describe('updateDifficultyIndicator', () => {
    test('应该更新难度指示器', () => {
      const difficultyInfo = {
        level: 5,
        rating: 'Medium',
        dropSpeed: 500
      };
      
      uiManager.updateDifficultyIndicator(difficultyInfo);
      
      expect(mockElements.difficultyIndicator.textContent).toContain('Medium');
      expect(mockElements.difficultyIndicator.className).toContain('difficulty-medium');
    });

    test('应该处理不同难度等级', () => {
      const difficulties = [
        { rating: 'Easy', level: 1 },
        { rating: 'Hard', level: 10 },
        { rating: 'Extreme', level: 20 }
      ];
      
      difficulties.forEach(diff => {
        expect(() => {
          uiManager.updateDifficultyIndicator(diff);
        }).not.toThrow();
      });
    });
  });

  describe('showScoreAnimation', () => {
    test('应该创建分数动画', () => {
      const animation = {
        score: 800,
        type: 'tetris',
        duration: 2000
      };
      
      uiManager.showScoreAnimation(animation);
      
      expect(uiManager.animations.length).toBe(1);
    });

    test('应该处理不同类型的动画', () => {
      const animations = [
        { score: 100, type: 'normal' },
        { score: 800, type: 'tetris' },
        { score: 1200, type: 't-spin' },
        { score: 2000, type: 'perfect-clear' }
      ];
      
      animations.forEach(anim => {
        expect(() => {
          uiManager.showScoreAnimation(anim);
        }).not.toThrow();
      });
    });

    test('应该自动清理过期动画', (done) => {
      const animation = {
        score: 100,
        type: 'normal',
        duration: 50 // 短时间用于测试
      };
      
      uiManager.showScoreAnimation(animation);
      
      setTimeout(() => {
        expect(uiManager.animations.length).toBe(0);
        done();
      }, 100);
    });
  });

  describe('showLevelUpDetails', () => {
    test('应该显示级别提升详情', () => {
      const levelUpInfo = {
        newLevel: 5,
        oldLevel: 4,
        levelsGained: 1,
        newSpeed: 400,
        oldSpeed: 500,
        difficultyRating: 'Medium'
      };
      
      expect(() => {
        uiManager.showLevelUpDetails(levelUpInfo);
      }).not.toThrow();
    });

    test('应该处理多级别提升', () => {
      const levelUpInfo = {
        newLevel: 8,
        oldLevel: 5,
        levelsGained: 3,
        newSpeed: 200,
        oldSpeed: 500,
        difficultyRating: 'Hard'
      };
      
      expect(() => {
        uiManager.showLevelUpDetails(levelUpInfo);
      }).not.toThrow();
    });
  });

  describe('工具方法', () => {
    test('应该正确格式化数字', () => {
      expect(uiManager.formatNumber(1000)).toBe('1,000');
      expect(uiManager.formatNumber(1234567)).toBe('1,234,567');
      expect(uiManager.formatNumber(0)).toBe('0');
      expect(uiManager.formatNumber(123)).toBe('123');
    });

    test('应该正确格式化时间', () => {
      expect(uiManager.formatTime(65000)).toBe('1:05'); // 1分5秒
      expect(uiManager.formatTime(3665000)).toBe('1:01:05'); // 1小时1分5秒
      expect(uiManager.formatTime(30000)).toBe('0:30'); // 30秒
      expect(uiManager.formatTime(0)).toBe('0:00');
    });

    test('应该获取难度CSS类名', () => {
      expect(uiManager.getDifficultyClass('Easy')).toBe('difficulty-easy');
      expect(uiManager.getDifficultyClass('Medium')).toBe('difficulty-medium');
      expect(uiManager.getDifficultyClass('Hard')).toBe('difficulty-hard');
      expect(uiManager.getDifficultyClass('Unknown')).toBe('difficulty-unknown');
    });
  });

  describe('cleanup', () => {
    test('应该清理所有动画', () => {
      // 添加一些动画
      uiManager.animations.push({ id: 1 }, { id: 2 }, { id: 3 });
      
      uiManager.cleanup();
      
      expect(uiManager.animations.length).toBe(0);
    });

    test('应该重置UI元素', () => {
      // 设置一些值
      mockElements.score.textContent = '1000';
      mockElements.level.textContent = '5';
      
      uiManager.cleanup();
      
      expect(mockElements.score.textContent).toBe('0');
      expect(mockElements.level.textContent).toBe('1');
    });

    test('应该隐藏游戏统计', () => {
      mockElements.gameStats.style.display = 'block';
      
      uiManager.cleanup();
      
      expect(mockElements.gameStats.style.display).toBe('none');
    });
  });

  describe('动画管理', () => {
    test('应该添加动画到队列', () => {
      const animation = { id: 'test', duration: 1000 };
      
      uiManager.addAnimation(animation);
      
      expect(uiManager.animations).toContain(animation);
    });

    test('应该移除指定动画', () => {
      const animation1 = { id: 'test1' };
      const animation2 = { id: 'test2' };
      
      uiManager.animations.push(animation1, animation2);
      
      uiManager.removeAnimation('test1');
      
      expect(uiManager.animations).not.toContain(animation1);
      expect(uiManager.animations).toContain(animation2);
    });

    test('应该更新所有动画', () => {
      const animation1 = { 
        id: 'test1', 
        startTime: Date.now() - 500, 
        duration: 1000,
        update: jest.fn()
      };
      const animation2 = { 
        id: 'test2', 
        startTime: Date.now() - 1500, 
        duration: 1000,
        update: jest.fn()
      };
      
      uiManager.animations.push(animation1, animation2);
      
      uiManager.updateAnimations();
      
      expect(animation1.update).toHaveBeenCalled();
      // animation2应该被移除因为已过期
      expect(uiManager.animations).not.toContain(animation2);
    });
  });

  describe('错误处理', () => {
    test('应该处理DOM元素不存在的情况', () => {
      uiManager.elements.score = null;
      
      expect(() => {
        uiManager.updateScore(1000);
      }).not.toThrow();
    });

    test('应该处理无效的动画数据', () => {
      expect(() => {
        uiManager.showScoreAnimation(null);
      }).not.toThrow();
      
      expect(() => {
        uiManager.showScoreAnimation({});
      }).not.toThrow();
    });

    test('应该处理无效的统计数据', () => {
      expect(() => {
        uiManager.showGameStats(null);
      }).not.toThrow();
      
      expect(() => {
        uiManager.showGameStats({});
      }).not.toThrow();
    });

    test('应该处理无效的数字格式化', () => {
      expect(uiManager.formatNumber(null)).toBe('0');
      expect(uiManager.formatNumber(undefined)).toBe('0');
      expect(uiManager.formatNumber('invalid')).toBe('0');
    });

    test('应该处理无效的时间格式化', () => {
      expect(uiManager.formatTime(null)).toBe('0:00');
      expect(uiManager.formatTime(undefined)).toBe('0:00');
      expect(uiManager.formatTime('invalid')).toBe('0:00');
    });
  });
});