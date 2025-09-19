"""
生产环境配置文件
包含生产环境的安全设置、性能优化和部署配置
"""

import os
from datetime import timedelta


class ProductionConfig:
    """生产环境配置类"""
    
    # 基本配置
    DEBUG = False
    TESTING = False
    
    # 安全配置
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-production-secret-key-change-this'
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = 3600  # 1小时
    
    # 数据库配置
    DATABASE_URL = os.environ.get('DATABASE_URL') or 'sqlite:///tetris_production.db'
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 20,
        'pool_recycle': 3600,
        'pool_pre_ping': True,
        'max_overflow': 30
    }
    
    # Redis配置（用于会话和缓存）
    REDIS_URL = os.environ.get('REDIS_URL') or 'redis://localhost:6379/0'
    SESSION_TYPE = 'redis'
    SESSION_REDIS = None  # 将在应用初始化时设置
    SESSION_PERMANENT = False
    SESSION_USE_SIGNER = True
    SESSION_KEY_PREFIX = 'tetris:'
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    
    # 缓存配置
    CACHE_TYPE = 'redis'
    CACHE_REDIS_URL = REDIS_URL
    CACHE_DEFAULT_TIMEOUT = 300
    CACHE_KEY_PREFIX = 'tetris_cache:'
    
    # WebSocket配置
    SOCKETIO_REDIS_URL = REDIS_URL
    SOCKETIO_ASYNC_MODE = 'threading'
    SOCKETIO_CORS_ALLOWED_ORIGINS = []  # 在部署时设置具体域名
    
    # 日志配置
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FILE = os.environ.get('LOG_FILE', 'logs/tetris_production.log')
    LOG_MAX_BYTES = 10 * 1024 * 1024  # 10MB
    LOG_BACKUP_COUNT = 5
    
    # 性能配置
    SEND_FILE_MAX_AGE_DEFAULT = timedelta(days=365)  # 静态文件缓存1年
    MAX_CONTENT_LENGTH = 1 * 1024 * 1024  # 1MB最大请求大小
    
    # 安全头配置
    SECURITY_HEADERS = {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Content-Security-Policy': (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.socket.io; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "connect-src 'self' ws: wss:; "
            "font-src 'self'; "
            "object-src 'none'; "
            "base-uri 'self';"
        )
    }
    
    # 速率限制配置
    RATELIMIT_STORAGE_URL = REDIS_URL
    RATELIMIT_DEFAULT = "100 per hour"
    RATELIMIT_HEADERS_ENABLED = True
    
    # API速率限制
    API_RATE_LIMITS = {
        'create_user': '10 per minute',
        'submit_score': '30 per minute',
        'get_leaderboard': '60 per minute',
        'get_user_rank': '60 per minute'
    }
    
    # 游戏配置
    GAME_CONFIG = {
        'max_username_length': 20,
        'min_username_length': 3,
        'max_score': 999999999,
        'max_level': 99,
        'max_lines': 9999,
        'max_game_duration': 7200,  # 2小时
        'leaderboard_size': 100,
        'user_cleanup_days': 90,  # 90天后清理不活跃用户
        'score_cleanup_days': 365  # 1年后清理旧分数记录
    }
    
    # WebSocket事件配置
    WEBSOCKET_CONFIG = {
        'max_connections_per_ip': 10,
        'connection_timeout': 60,
        'ping_interval': 25,
        'ping_timeout': 60,
        'max_message_size': 1024,
        'message_rate_limit': '100 per minute'
    }
    
    # 监控和健康检查
    HEALTH_CHECK_ENABLED = True
    METRICS_ENABLED = True
    METRICS_PORT = int(os.environ.get('METRICS_PORT', 9090))
    
    # 错误报告
    SENTRY_DSN = os.environ.get('SENTRY_DSN')
    SENTRY_ENVIRONMENT = 'production'
    
    # 邮件配置（用于错误通知）
    MAIL_SERVER = os.environ.get('MAIL_SERVER')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER')
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL')
    
    # 备份配置
    BACKUP_ENABLED = True
    BACKUP_SCHEDULE = '0 2 * * *'  # 每天凌晨2点
    BACKUP_RETENTION_DAYS = 30
    BACKUP_S3_BUCKET = os.environ.get('BACKUP_S3_BUCKET')
    BACKUP_S3_ACCESS_KEY = os.environ.get('BACKUP_S3_ACCESS_KEY')
    BACKUP_S3_SECRET_KEY = os.environ.get('BACKUP_S3_SECRET_KEY')
    
    # CDN配置
    CDN_DOMAIN = os.environ.get('CDN_DOMAIN')
    STATIC_URL_PREFIX = f"https://{CDN_DOMAIN}" if CDN_DOMAIN else None
    
    # 压缩配置
    COMPRESS_MIMETYPES = [
        'text/html',
        'text/css',
        'text/xml',
        'application/json',
        'application/javascript',
        'application/xml+rss',
        'application/atom+xml',
        'image/svg+xml'
    ]
    COMPRESS_LEVEL = 6
    COMPRESS_MIN_SIZE = 500
    
    @staticmethod
    def init_app(app):
        """初始化应用配置"""
        
        # 设置日志
        import logging
        from logging.handlers import RotatingFileHandler
        import os
        
        if not os.path.exists('logs'):
            os.mkdir('logs')
        
        file_handler = RotatingFileHandler(
            ProductionConfig.LOG_FILE,
            maxBytes=ProductionConfig.LOG_MAX_BYTES,
            backupCount=ProductionConfig.LOG_BACKUP_COUNT
        )
        
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        
        file_handler.setLevel(getattr(logging, ProductionConfig.LOG_LEVEL))
        app.logger.addHandler(file_handler)
        app.logger.setLevel(getattr(logging, ProductionConfig.LOG_LEVEL))
        app.logger.info('Tetris game startup')
        
        # 设置错误邮件通知
        if ProductionConfig.MAIL_SERVER:
            import logging
            from logging.handlers import SMTPHandler
            
            auth = None
            if ProductionConfig.MAIL_USERNAME or ProductionConfig.MAIL_PASSWORD:
                auth = (ProductionConfig.MAIL_USERNAME, ProductionConfig.MAIL_PASSWORD)
            
            secure = None
            if ProductionConfig.MAIL_USE_TLS:
                secure = ()
            
            mail_handler = SMTPHandler(
                mailhost=(ProductionConfig.MAIL_SERVER, ProductionConfig.MAIL_PORT),
                fromaddr=ProductionConfig.MAIL_DEFAULT_SENDER,
                toaddrs=[ProductionConfig.ADMIN_EMAIL],
                subject='Tetris Game Error',
                credentials=auth,
                secure=secure
            )
            
            mail_handler.setLevel(logging.ERROR)
            app.logger.addHandler(mail_handler)
        
        # 设置Sentry错误追踪
        if ProductionConfig.SENTRY_DSN:
            import sentry_sdk
            from sentry_sdk.integrations.flask import FlaskIntegration
            from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
            
            sentry_sdk.init(
                dsn=ProductionConfig.SENTRY_DSN,
                integrations=[
                    FlaskIntegration(),
                    SqlalchemyIntegration()
                ],
                environment=ProductionConfig.SENTRY_ENVIRONMENT,
                traces_sample_rate=0.1
            )


class DockerConfig(ProductionConfig):
    """Docker容器配置"""
    
    # Docker特定配置
    DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://tetris:password@db:5432/tetris')
    REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
    
    # 健康检查
    HEALTH_CHECK_ENDPOINT = '/health'
    
    @staticmethod
    def init_app(app):
        """初始化Docker应用配置"""
        ProductionConfig.init_app(app)
        
        # Docker容器日志输出到stdout
        import logging
        import sys
        
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setLevel(logging.INFO)
        stream_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s'
        ))
        
        app.logger.addHandler(stream_handler)


class KubernetesConfig(DockerConfig):
    """Kubernetes部署配置"""
    
    # Kubernetes特定配置
    POD_NAME = os.environ.get('POD_NAME', 'tetris-pod')
    NAMESPACE = os.environ.get('NAMESPACE', 'default')
    
    # 服务发现
    DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://tetris:password@postgres-service:5432/tetris')
    REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis-service:6379/0')
    
    # 监控配置
    PROMETHEUS_METRICS = True
    METRICS_PATH = '/metrics'
    
    @staticmethod
    def init_app(app):
        """初始化Kubernetes应用配置"""
        DockerConfig.init_app(app)
        
        # 添加Kubernetes特定的健康检查
        @app.route('/health')
        def health_check():
            return {'status': 'healthy', 'pod': KubernetesConfig.POD_NAME}
        
        @app.route('/ready')
        def readiness_check():
            # 检查数据库连接等
            try:
                from services.database_manager import DatabaseManager
                db_manager = DatabaseManager()
                db_manager.check_connection()
                return {'status': 'ready'}
            except Exception as e:
                return {'status': 'not ready', 'error': str(e)}, 503


# 配置映射
config = {
    'production': ProductionConfig,
    'docker': DockerConfig,
    'kubernetes': KubernetesConfig,
    'default': ProductionConfig
}