# 前端JavaScript测试套件

这个目录包含了俄罗斯方块游戏前端JavaScript代码的完整测试套件。

## 📁 文件结构

```
tests/frontend/
├── jest.config.js              # Jest配置文件
├── setup.js                    # 测试环境设置
├── package.json                # 测试依赖配置
├── run-frontend-tests.js       # 测试运行器
├── README.md                   # 本文件
├── tetromino-manager.test.js   # 方块管理器测试
├── board-manager.test.js       # 游戏板管理器测试
├── scoring-system.test.js      # 积分系统测试
├── tetris-game.test.js         # 游戏主类测试
└── ui-manager.test.js          # UI管理器测试
```

## 🧪 测试覆盖范围

### 核心游戏逻辑
- **TetrominoManager**: 方块生成、旋转、碰撞检测
- **BoardManager**: 游戏板管理、行消除、统计计算
- **ScoringSystem**: 积分计算、难度调整、连击系统
- **TetrisGame**: 游戏主循环、状态管理、事件处理

### 用户界面
- **UIManager**: UI更新、动画管理、数据格式化

### 测试类型
- 单元测试：测试各个类的独立功能
- 集成测试：测试组件间的交互
- 边界测试：测试边界条件和错误处理
- 性能测试：测试关键算法的性能

## 🚀 运行测试

### 方法1：使用测试运行器（推荐）
```bash
node tests/frontend/run-frontend-tests.js
```

### 方法2：直接使用Jest
```bash
cd tests/frontend
npm install
npm test
```

### 方法3：使用npx（如果已安装Jest）
```bash
npx jest --config tests/frontend/jest.config.js
```

## 📊 测试选项

### 基本测试
```bash
node run-frontend-tests.js
```

### 详细输出
```bash
node run-frontend-tests.js --verbose
```

### 覆盖率报告
```bash
npm run test:coverage
```

### 监视模式
```bash
npm run test:watch
```

## 🔧 环境要求

### 必需依赖
- Node.js 14+
- Jest 29+
- Babel 7+
- jsdom 20+

### 自动安装
测试运行器会自动检查并提示安装缺失的依赖：
```bash
npm install --save-dev jest @babel/core @babel/preset-env babel-jest jsdom
```

## 📈 测试覆盖率

目标覆盖率：
- 行覆盖率：≥ 70%
- 函数覆盖率：≥ 70%
- 分支覆盖率：≥ 70%
- 语句覆盖率：≥ 70%

查看覆盖率报告：
- 控制台输出：运行测试时自动显示
- HTML报告：`tests/frontend/coverage/lcov-report/index.html`
- LCOV文件：`tests/frontend/coverage/lcov.info`

## 🧩 测试示例

### 基本单元测试
```javascript
describe('TetrominoManager', () => {
  test('应该生成有效的随机方块', () => {
    const tetromino = tetrominoManager.generateRandomTetromino();
    expect(tetromino).toBeValidTetromino();
  });
});
```

### 模拟测试
```javascript
test('应该触发积分更新回调', () => {
  const callback = jest.fn();
  scoringSystem.setCallback('scoreUpdate', callback);
  
  scoringSystem.processLineClears(2);
  
  expect(callback).toHaveBeenCalled();
});
```

### 异步测试
```javascript
test('应该自动清理过期动画', (done) => {
  uiManager.showScoreAnimation({ duration: 50 });
  
  setTimeout(() => {
    expect(uiManager.animations.length).toBe(0);
    done();
  }, 100);
});
```

## 🎯 自定义匹配器

测试套件包含自定义Jest匹配器：

### toBeWithinRange
```javascript
expect(value).toBeWithinRange(min, max);
```

### toBeValidTetromino
```javascript
expect(tetromino).toBeValidTetromino();
```

## 🔍 调试测试

### 运行单个测试文件
```bash
npx jest tetromino-manager.test.js
```

### 运行特定测试
```bash
npx jest --testNamePattern="应该生成有效的随机方块"
```

### 调试模式
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 📝 编写新测试

### 测试文件命名
- 使用 `.test.js` 或 `.spec.js` 后缀
- 文件名应该对应被测试的模块

### 测试结构
```javascript
describe('模块名', () => {
  let instance;
  
  beforeEach(() => {
    instance = new ModuleClass();
  });
  
  describe('方法名', () => {
    test('应该执行预期行为', () => {
      // 准备
      const input = 'test';
      
      // 执行
      const result = instance.method(input);
      
      // 验证
      expect(result).toBe('expected');
    });
  });
});
```

### 最佳实践
1. **描述性测试名称**：使用"应该..."格式
2. **单一职责**：每个测试只验证一个行为
3. **独立性**：测试之间不应该相互依赖
4. **清理**：在`afterEach`中清理副作用
5. **模拟**：使用Jest mocks模拟外部依赖

## 🐛 常见问题

### Canvas相关错误
```
TypeError: Cannot read property 'getContext' of null
```
**解决方案**：确保使用了`createMockCanvas()`创建模拟canvas

### 模块导入错误
```
ReferenceError: TetrominoManager is not defined
```
**解决方案**：检查测试文件中是否正确加载了源文件

### 异步测试超时
```
Timeout - Async callback was not invoked within the 5000ms timeout
```
**解决方案**：使用`done()`回调或增加超时时间

## 🔄 持续集成

测试套件支持CI/CD集成：

### GitHub Actions示例
```yaml
- name: Run Frontend Tests
  run: |
    cd tests/frontend
    npm install
    npm test
```

### 退出码
- `0`：所有测试通过
- `1`：测试失败或错误

## 📚 相关文档

- [Jest官方文档](https://jestjs.io/docs/getting-started)
- [jsdom文档](https://github.com/jsdom/jsdom)
- [Babel配置](https://babeljs.io/docs/en/configuration)

## 🤝 贡献指南

1. 为新功能编写测试
2. 确保测试覆盖率不降低
3. 遵循现有的测试模式
4. 更新相关文档

## 📞 支持

如果遇到测试相关问题：
1. 检查Node.js和npm版本
2. 清理node_modules并重新安装
3. 查看Jest配置是否正确
4. 检查测试文件语法