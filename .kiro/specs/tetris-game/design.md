# 设计文档

## 概述

俄罗斯方块游戏将采用Python Flask后端 + HTML5前端的架构。后端负责用户管理、数据存储和排行榜逻辑，前端使用HTML5 Canvas实现游戏渲染和交互。系统设计为单页应用，支持实时排行榜更新和跨设备兼容。

## 架构

### 系统架构图

```
┌─────────────────┐    HTTP/WebSocket    ┌──────────────────┐
│   浏览器客户端    │ ←──────────────────→ │   Flask 后端服务   │
│                 │                      │                  │
│ ┌─────────────┐ │                      │ ┌──────────────┐ │
│ │ HTML5 Canvas│ │                      │ │ 游戏API路由   │ │
│ │ 游戏渲染     │ │                      │ │             │ │
│ └─────────────┘ │                      │ └──────────────┘ │
│                 │                      │                  │
│ ┌─────────────┐ │                      │ ┌──────────────┐ │
│ │ JavaScript  │ │                      │ │ 用户管理服务  │ │
│ │ 游戏逻辑     │ │                      │ │             │ │
│ └─────────────┘ │                      │ └──────────────┘ │
│                 │                      │                  │
│ ┌─────────────┐ │                      │ ┌──────────────┐ │
│ │ 排行榜UI    │ │                      │ │ 排行榜服务    │ │
│ └─────────────┘ │                      │ └──────────────┘ │
└─────────────────┘                      └──────────────────┘
                                                   │
                                                   ▼
                                         ┌──────────────────┐
                                         │   SQLite 数据库   │
                                         │                  │
                                         │ ┌──────────────┐ │
                                         │ │ 用户表        │ │
                                         │ └──────────────┘ │
                                         │ ┌──────────────┐ │
                                         │ │ 得分记录表    │ │
                                         │ └──────────────┘ │
                                         └──────────────────┘
```

### 技术栈

- **后端**: Python 3.8+, Flask, SQLAlchemy, Flask-SocketIO
- **前端**: HTML5, CSS3, JavaScript (ES6+), Canvas API
- **数据库**: SQLite (开发环境), PostgreSQL (生产环境可选)
- **通信**: RESTful API, WebSocket (实时更新)

## 组件和接口

### 后端组件

#### 1. Flask应用主模块 (app.py)
```python
# 主要职责：
# - 应用初始化和配置
# - 路由注册
# - 数据库连接管理
# - WebSocket事件处理
```

#### 2. 用户管理服务 (services/user_service.py)
```python
class UserService:
    def generate_unique_username() -> str
    def create_user(username: str) -> User
    def get_user_by_id(user_id: str) -> User
```

#### 3. 游戏服务 (services/game_service.py)
```python
class GameService:
    def save_game_score(user_id: str, score: int, level: int) -> GameRecord
    def get_leaderboard(limit: int = 10) -> List[GameRecord]
    def get_user_rank(user_id: str) -> int
```

#### 4. 数据模型 (models/)

**用户模型**
```python
class User:
    id: str (UUID)
    username: str
    created_at: datetime
    last_active: datetime
```

**游戏记录模型**
```python
class GameRecord:
    id: str (UUID)
    user_id: str
    score: int
    level: int
    lines_cleared: int
    game_duration: int (秒)
    created_at: datetime
```

### 前端组件

#### 1. 游戏引擎 (js/game-engine.js)
```javascript
class TetrisGame {
    constructor(canvas, config)
    start()
    pause()
    reset()
    update(deltaTime)
    render()
    handleInput(keyCode)
}
```

#### 2. 方块管理器 (js/tetromino-manager.js)
```javascript
class TetrominoManager {
    generateRandomTetromino()
    rotateTetromino(tetromino, direction)
    checkCollision(tetromino, board)
}
```

#### 3. 游戏板管理器 (js/board-manager.js)
```javascript
class BoardManager {
    constructor(width, height)
    placeTetromino(tetromino)
    clearLines()
    checkGameOver()
}
```

#### 4. 得分系统 (js/scoring-system.js)
```javascript
class ScoringSystem {
    calculateScore(linesCleared, level)
    updateLevel(totalLines)
    getDifficultySpeed(level)
}
```

#### 5. UI管理器 (js/ui-manager.js)
```javascript
class UIManager {
    updateScore(score)
    updateLevel(level)
    showGameOver(finalScore)
    updateLeaderboard(leaderboard)
}
```

### API接口设计

#### RESTful API端点

```
GET  /                          # 主游戏页面
POST /api/users                 # 创建新用户
GET  /api/users/{user_id}       # 获取用户信息
POST /api/games                 # 保存游戏得分
GET  /api/leaderboard           # 获取排行榜
GET  /api/users/{user_id}/rank  # 获取用户排名
```

#### WebSocket事件

```
# 客户端发送
'game_finished' - 游戏结束，发送得分数据
'request_leaderboard' - 请求最新排行榜

# 服务器发送
'leaderboard_updated' - 排行榜更新通知
'user_rank_updated' - 用户排名更新
```

## 数据模型

### 数据库表结构

#### users表
```sql
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### game_records表
```sql
CREATE TABLE game_records (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    score INTEGER NOT NULL,
    level INTEGER NOT NULL,
    lines_cleared INTEGER NOT NULL,
    game_duration INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### 索引设计
```sql
CREATE INDEX idx_game_records_score ON game_records(score DESC);
CREATE INDEX idx_game_records_user_id ON game_records(user_id);
CREATE INDEX idx_game_records_created_at ON game_records(created_at DESC);
```

### 游戏状态数据结构

```javascript
// 游戏状态对象
const gameState = {
    board: Array(20).fill().map(() => Array(10).fill(0)),
    currentTetromino: {
        shape: [[1,1,1,1]], // I型方块示例
        x: 3,
        y: 0,
        rotation: 0
    },
    nextTetromino: {
        shape: [[1,1],[1,1]] // O型方块示例
    },
    score: 0,
    level: 1,
    lines: 0,
    gameSpeed: 1000, // 毫秒
    isGameOver: false,
    isPaused: false
};
```

## 错误处理

### 前端错误处理

1. **网络连接错误**
   - 显示离线模式提示
   - 本地保存游戏进度
   - 自动重连机制

2. **游戏渲染错误**
   - Canvas不支持时的降级方案
   - 性能监控和优化

3. **用户输入错误**
   - 键盘事件冲突处理
   - 触摸设备兼容性

### 后端错误处理

1. **数据库连接错误**
   - 连接池管理
   - 自动重连机制
   - 错误日志记录

2. **API请求错误**
   - 请求验证和清理
   - 速率限制
   - 错误响应标准化

```python
# 标准错误响应格式
{
    "error": {
        "code": "INVALID_REQUEST",
        "message": "请求参数无效",
        "details": "score字段必须为正整数"
    }
}
```

## 测试策略

### 单元测试

1. **后端测试**
   - 用户服务测试 (pytest)
   - 游戏服务测试 (pytest)
   - API端点测试 (pytest + Flask-Testing)
   - 数据模型测试 (pytest + SQLAlchemy)

2. **前端测试**
   - 游戏逻辑测试 (Jest)
   - UI组件测试 (Jest + DOM Testing Library)
   - Canvas渲染测试 (Jest + Canvas Mock)

### 集成测试

1. **API集成测试**
   - 端到端API流程测试
   - WebSocket连接测试
   - 数据库集成测试

2. **浏览器测试**
   - 跨浏览器兼容性测试 (Selenium)
   - 移动设备响应式测试
   - 性能测试 (Lighthouse)

### 性能测试

1. **前端性能**
   - 游戏帧率监控
   - 内存使用优化
   - 资源加载优化

2. **后端性能**
   - API响应时间测试
   - 数据库查询优化
   - 并发用户测试

### 测试数据管理

```python
# 测试数据工厂
class TestDataFactory:
    @staticmethod
    def create_test_user(username="test_user"):
        return User(
            id=str(uuid.uuid4()),
            username=username,
            created_at=datetime.utcnow()
        )
    
    @staticmethod
    def create_test_game_record(user_id, score=1000):
        return GameRecord(
            id=str(uuid.uuid4()),
            user_id=user_id,
            score=score,
            level=5,
            lines_cleared=20,
            game_duration=300
        )
```