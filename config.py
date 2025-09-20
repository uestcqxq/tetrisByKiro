"""
应用配置文件
定义不同环境的配置参数
"""

import os
from datetime import datetime, timedelta, timezone

# 获取项目根目录
basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    """基础配置类"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_RECORD_QUERIES = True
    
    # 数据库连接池配置
    DB_POOL_SIZE = int(os.environ.get('DB_POOL_SIZE', 10))
    DB_MAX_OVERFLOW = int(os.environ.get('DB_MAX_OVERFLOW', 20))
    DB_POOL_TIMEOUT = int(os.environ.get('DB_POOL_TIMEOUT', 30))
    DB_POOL_RECYCLE = int(os.environ.get('DB_POOL_RECYCLE', 3600))  # 1小时
    
    # 数据库操作配置
    DB_QUERY_TIMEOUT = int(os.environ.get('DB_QUERY_TIMEOUT', 30))
    DB_MAX_RETRIES = int(os.environ.get('DB_MAX_RETRIES', 3))
    DB_RETRY_DELAY = float(os.environ.get('DB_RETRY_DELAY', 0.1))
    
    # WebSocket配置
    SOCKETIO_ASYNC_MODE = 'threading'
    
    # 游戏配置
    MAX_LEADERBOARD_SIZE = 100
    DEFAULT_LEADERBOARD_LIMIT = 10
    
    # 数据清理配置
    MAX_GAME_RECORDS_PER_USER = int(os.environ.get('MAX_GAME_RECORDS_PER_USER', 1000))
    DATA_RETENTION_DAYS = int(os.environ.get('DATA_RETENTION_DAYS', 365))
    
    # 日志配置
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FILE = os.environ.get('LOG_FILE', 'tetris_game.log')
    
    # 应用信息
    STARTUP_TIME = datetime.now(timezone.utc).isoformat()
    
    @staticmethod
    def init_app(app):
        # 配置日志
        import logging
        logging.basicConfig(
            level=getattr(logging, app.config.get('LOG_LEVEL', 'INFO')),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )


class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DEV_DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'instance', 'tetris_dev.db')


class TestingConfig(Config):
    """测试环境配置"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('TEST_DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'instance', 'tetris_test.db')
    WTF_CSRF_ENABLED = False


class ProductionConfig(Config):
    """生产环境配置"""
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'instance', 'tetris.db')
    
    @classmethod
    def init_app(cls, app):
        Config.init_app(app)


# 配置字典
config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}