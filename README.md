# 俄罗斯方块游戏

基于Python Flask + HTML5的俄罗斯方块游戏，具有动态难度调整、积分系统和玩家排名功能。

## 项目结构

```
tetris-game/
├── app.py                 # Flask应用主模块
├── config.py             # 配置文件
├── run.py                # 启动脚本
├── requirements.txt      # Python依赖
├── models/               # 数据模型
│   ├── __init__.py
│   ├── base.py          # 基础模型类
│   ├── user.py          # 用户模型
│   └── game_record.py   # 游戏记录模型
├── services/            # 业务逻辑服务
│   ├── __init__.py
│   ├── base_service.py  # 基础服务类
│   ├── user_service.py  # 用户服务
│   └── game_service.py  # 游戏服务
├── routes/              # 路由定义
│   ├── __init__.py
│   ├── main_routes.py   # 主页面路由
│   └── api_routes.py    # API路由
├── static/              # 静态文件
│   ├── css/
│   │   └── style.css    # 样式文件
│   └── js/
│       └── main.js      # 主JavaScript文件
└── templates/           # HTML模板
    ├── base.html        # 基础模板
    └── index.html       # 主页面模板
```

## 安装和运行

1. 安装依赖：
```bash
pip install -r requirements.txt
```

2. 运行应用：
```bash
python run.py
```

3. 访问游戏：
打开浏览器访问 http://localhost:5000

## 开发说明

这是项目的基础结构，后续任务将逐步实现：
- 数据库层和用户管理
- Flask API端点
- WebSocket实时通信
- HTML5游戏前端
- 俄罗斯方块游戏逻辑
- 用户界面和交互
- 测试用例

## 技术栈

- **后端**: Python 3.8+, Flask, SQLAlchemy, Flask-SocketIO
- **前端**: HTML5, CSS3, JavaScript (ES6+), Canvas API
- **数据库**: SQLite (开发环境)
- **通信**: RESTful API, WebSocket