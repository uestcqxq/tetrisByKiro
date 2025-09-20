"""
数据库连接池和事务管理器
提供高级数据库连接管理、连接池监控和事务处理功能
"""

import logging
import time
import threading
from contextlib import contextmanager
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timedelta
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError, DisconnectionError, OperationalError
from sqlalchemy.pool import QueuePool, StaticPool
from flask import current_app
from models.base import db


logger = logging.getLogger(__name__)


class DatabaseConnectionManager:
    """数据库连接管理器"""
    
    def __init__(self):
        self._connection_stats = {
            'total_connections': 0,
            'active_connections': 0,
            'failed_connections': 0,
            'last_connection_time': None,
            'last_error': None,
            'error_count': 0,
            'start_time': datetime.now()
        }
        self._lock = threading.Lock()
        self._health_check_interval = 30  # 秒
        self._last_health_check = None
        self._is_healthy = True
    
    def configure_connection_pool(self, app) -> None:
        """
        配置数据库连接池
        
        Args:
            app: Flask应用实例
        """
        try:
            # 获取数据库URI
            database_uri = app.config.get('SQLALCHEMY_DATABASE_URI')
            if not database_uri:
                raise ValueError("未配置数据库URI")
            
            # 连接池配置
            pool_config = {
                'poolclass': QueuePool if 'sqlite' not in database_uri else StaticPool,
                'pool_size': app.config.get('DB_POOL_SIZE', 10),
                'max_overflow': app.config.get('DB_MAX_OVERFLOW', 20),
                'pool_timeout': app.config.get('DB_POOL_TIMEOUT', 30),
                'pool_recycle': app.config.get('DB_POOL_RECYCLE', 3600),  # 1小时
                'pool_pre_ping': True,  # 连接前检查连接有效性
            }
            
            # 为SQLite使用不同的配置
            if 'sqlite' in database_uri:
                pool_config.update({
                    'poolclass': StaticPool,
                    'pool_size': 1,
                    'max_overflow': 0,
                    'connect_args': {
                        'check_same_thread': False,
                        'timeout': 20
                    }
                })
            
            # 更新SQLAlchemy配置
            app.config.update({
                'SQLALCHEMY_ENGINE_OPTIONS': pool_config
            })
            
            logger.info(f"数据库连接池配置完成: {pool_config}")
            
        except Exception as e:
            logger.error(f"配置数据库连接池失败: {str(e)}")
            raise
    
    def setup_connection_events(self, engine: Engine) -> None:
        """
        设置数据库连接事件监听器
        
        Args:
            engine: SQLAlchemy引擎实例
        """
        @event.listens_for(engine, "connect")
        def on_connect(dbapi_connection, connection_record):
            """连接建立时的回调"""
            with self._lock:
                self._connection_stats['total_connections'] += 1
                self._connection_stats['active_connections'] += 1
                self._connection_stats['last_connection_time'] = datetime.now()
            
            logger.debug("数据库连接已建立")
        
        @event.listens_for(engine, "checkout")
        def on_checkout(dbapi_connection, connection_record, connection_proxy):
            """连接检出时的回调"""
            logger.debug("数据库连接已检出")
        
        @event.listens_for(engine, "checkin")
        def on_checkin(dbapi_connection, connection_record):
            """连接检入时的回调"""
            logger.debug("数据库连接已检入")
        
        @event.listens_for(engine, "close")
        def on_close(dbapi_connection, connection_record):
            """连接关闭时的回调"""
            with self._lock:
                self._connection_stats['active_connections'] = max(0, 
                    self._connection_stats['active_connections'] - 1)
            
            logger.debug("数据库连接已关闭")
        
        @event.listens_for(engine, "invalidate")
        def on_invalidate(dbapi_connection, connection_record, exception):
            """连接失效时的回调"""
            with self._lock:
                self._connection_stats['failed_connections'] += 1
                self._connection_stats['last_error'] = str(exception) if exception else "连接失效"
                self._connection_stats['error_count'] += 1
            
            logger.warning(f"数据库连接失效: {exception}")
    
    @contextmanager
    def get_connection(self, auto_commit: bool = False):
        """
        获取数据库连接的上下文管理器
        
        Args:
            auto_commit: 是否自动提交事务
        """
        connection = None
        transaction = None
        
        try:
            # 获取连接
            connection = db.engine.connect()
            
            # 开始事务
            if not auto_commit:
                transaction = connection.begin()
            
            yield connection
            
            # 提交事务
            if transaction:
                transaction.commit()
                logger.debug("数据库事务提交成功")
            
        except Exception as e:
            # 回滚事务
            if transaction:
                try:
                    transaction.rollback()
                    logger.debug("数据库事务已回滚")
                except Exception as rollback_error:
                    logger.error(f"事务回滚失败: {str(rollback_error)}")
            
            # 记录错误
            with self._lock:
                self._connection_stats['error_count'] += 1
                self._connection_stats['last_error'] = str(e)
            
            logger.error(f"数据库操作失败: {str(e)}")
            raise
        
        finally:
            # 关闭连接
            if connection:
                try:
                    connection.close()
                except Exception as close_error:
                    logger.error(f"关闭数据库连接失败: {str(close_error)}")
    
    def execute_with_retry(self, operation: Callable, max_retries: int = 3, 
                          delay: float = 0.1) -> Any:
        """
        执行数据库操作并在失败时重试
        
        Args:
            operation: 要执行的操作函数
            max_retries: 最大重试次数
            delay: 重试延迟（秒）
            
        Returns:
            Any: 操作结果
        """
        last_exception = None
        
        for attempt in range(max_retries + 1):
            try:
                return operation()
            
            except (DisconnectionError, OperationalError) as e:
                last_exception = e
                
                if attempt < max_retries:
                    wait_time = delay * (2 ** attempt)  # 指数退避
                    logger.warning(f"数据库操作失败，{wait_time}秒后进行第 {attempt + 1} 次重试: {str(e)}")
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f"数据库操作重试 {max_retries} 次后仍然失败: {str(e)}")
                    break
            
            except Exception as e:
                # 对于非连接相关的错误，不进行重试
                logger.error(f"数据库操作失败（不可重试）: {str(e)}")
                raise e
        
        # 如果所有重试都失败了，抛出最后一个异常
        raise last_exception
    
    def check_connection_health(self, force_check: bool = False) -> bool:
        """
        检查数据库连接健康状态
        
        Args:
            force_check: 是否强制检查（忽略检查间隔）
            
        Returns:
            bool: 连接是否健康
        """
        now = datetime.now()
        
        # 检查是否需要进行健康检查
        if not force_check and self._last_health_check:
            if (now - self._last_health_check).seconds < self._health_check_interval:
                return self._is_healthy
        
        try:
            # 执行简单查询测试连接
            with self.get_connection() as conn:
                result = conn.execute(text("SELECT 1")).fetchone()
                if result:
                    self._is_healthy = True
                    self._last_health_check = now
                    logger.debug("数据库连接健康检查通过")
                    return True
        
        except Exception as e:
            self._is_healthy = False
            self._last_health_check = now
            
            with self._lock:
                self._connection_stats['error_count'] += 1
                self._connection_stats['last_error'] = f"健康检查失败: {str(e)}"
            
            logger.error(f"数据库连接健康检查失败: {str(e)}")
            return False
        
        return False
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """
        获取连接统计信息
        
        Returns:
            Dict[str, Any]: 连接统计信息
        """
        with self._lock:
            stats = self._connection_stats.copy()
        
        # 添加运行时间
        stats['uptime_seconds'] = (datetime.now() - stats['start_time']).total_seconds()
        
        # 添加连接池信息
        try:
            pool = db.engine.pool
            stats.update({
                'pool_size': pool.size(),
                'checked_in': pool.checkedin(),
                'checked_out': pool.checkedout(),
                'overflow': pool.overflow(),
                'invalid': pool.invalid(),
            })
        except Exception as e:
            stats['pool_error'] = str(e)
        
        # 添加健康状态
        stats['is_healthy'] = self._is_healthy
        stats['last_health_check'] = self._last_health_check.isoformat() if self._last_health_check else None
        
        return stats
    
    def cleanup_connections(self) -> None:
        """清理无效连接"""
        try:
            # 获取连接池
            pool = db.engine.pool
            
            # 清理无效连接
            invalid_count = pool.invalid()
            if invalid_count > 0:
                logger.info(f"清理 {invalid_count} 个无效连接")
                pool.dispose()
        
        except Exception as e:
            logger.error(f"清理连接失败: {str(e)}")
    
    def reset_stats(self) -> None:
        """重置统计信息"""
        with self._lock:
            self._connection_stats = {
                'total_connections': 0,
                'active_connections': 0,
                'failed_connections': 0,
                'last_connection_time': None,
                'last_error': None,
                'error_count': 0,
                'start_time': datetime.now()
            }
        
        logger.info("数据库连接统计信息已重置")


class DatabaseTransactionManager:
    """数据库事务管理器"""
    
    def __init__(self, connection_manager: DatabaseConnectionManager):
        self.connection_manager = connection_manager
        self._transaction_stats = {
            'total_transactions': 0,
            'committed_transactions': 0,
            'rolled_back_transactions': 0,
            'failed_transactions': 0,
            'start_time': datetime.now()
        }
        self._lock = threading.Lock()
    
    @contextmanager
    def transaction(self, isolation_level: str = None, read_only: bool = False):
        """
        事务上下文管理器
        
        Args:
            isolation_level: 事务隔离级别
            read_only: 是否为只读事务
        """
        with self._lock:
            self._transaction_stats['total_transactions'] += 1
        
        transaction_start = time.time()
        
        try:
            with self.connection_manager.get_connection() as conn:
                # 设置事务隔离级别
                if isolation_level:
                    conn.execute(text(f"SET TRANSACTION ISOLATION LEVEL {isolation_level}"))
                
                # 设置只读模式（如果支持）
                if read_only:
                    try:
                        conn.execute(text("SET TRANSACTION READ ONLY"))
                    except Exception:
                        # 某些数据库可能不支持只读事务
                        pass
                
                transaction = conn.begin()
                
                try:
                    yield conn
                    transaction.commit()
                    
                    with self._lock:
                        self._transaction_stats['committed_transactions'] += 1
                    
                    transaction_time = time.time() - transaction_start
                    logger.debug(f"事务提交成功，耗时: {transaction_time:.3f}秒")
                
                except Exception as e:
                    transaction.rollback()
                    
                    with self._lock:
                        self._transaction_stats['rolled_back_transactions'] += 1
                    
                    logger.error(f"事务回滚: {str(e)}")
                    raise
        
        except Exception as e:
            with self._lock:
                self._transaction_stats['failed_transactions'] += 1
            
            logger.error(f"事务失败: {str(e)}")
            raise
    
    def get_transaction_stats(self) -> Dict[str, Any]:
        """
        获取事务统计信息
        
        Returns:
            Dict[str, Any]: 事务统计信息
        """
        with self._lock:
            stats = self._transaction_stats.copy()
        
        # 计算成功率
        total = stats['total_transactions']
        if total > 0:
            stats['success_rate'] = (stats['committed_transactions'] / total) * 100
            stats['rollback_rate'] = (stats['rolled_back_transactions'] / total) * 100
            stats['failure_rate'] = (stats['failed_transactions'] / total) * 100
        else:
            stats['success_rate'] = 0
            stats['rollback_rate'] = 0
            stats['failure_rate'] = 0
        
        # 添加运行时间
        stats['uptime_seconds'] = (datetime.now() - stats['start_time']).total_seconds()
        
        return stats


# 全局实例 - 延迟初始化
connection_manager = None
transaction_manager = None

def get_connection_manager():
    """获取连接管理器实例"""
    global connection_manager
    if connection_manager is None:
        connection_manager = DatabaseConnectionManager()
    return connection_manager

def get_transaction_manager():
    """获取事务管理器实例"""
    global transaction_manager
    if transaction_manager is None:
        transaction_manager = DatabaseTransactionManager(get_connection_manager())
    return transaction_manager

# 兼容性别名
DatabaseManager = DatabaseConnectionManager


def init_database_manager(app) -> None:
    """
    初始化数据库管理器
    
    Args:
        app: Flask应用实例
    """
    try:
        # 获取管理器实例
        conn_manager = get_connection_manager()
        trans_manager = get_transaction_manager()
        
        # 配置连接池
        conn_manager.configure_connection_pool(app)
        
        # 设置连接事件监听器 - 延迟到应用完全初始化后
        # 这样可以避免在应用完全初始化之前访问数据库引擎
        def setup_events():
            try:
                if hasattr(db, 'engine') and db.engine:
                    conn_manager.setup_connection_events(db.engine)
                    logger.info("数据库连接事件监听器设置完成")
            except Exception as e:
                logger.warning(f"设置数据库连接事件监听器失败: {str(e)}")
        
        # 使用 teardown_appcontext 来延迟设置事件监听器
        @app.teardown_appcontext
        def setup_db_events_once(error):
            if not hasattr(app, '_db_events_setup'):
                setup_events()
                app._db_events_setup = True
        
        # 添加健康检查路由
        @app.route('/api/health/database')
        def database_health():
            is_healthy = conn_manager.check_connection_health(force_check=True)
            stats = conn_manager.get_connection_stats()
            
            return {
                'healthy': is_healthy,
                'stats': stats,
                'timestamp': datetime.now().isoformat()
            }, 200 if is_healthy else 503
        
        # 添加数据库统计路由
        @app.route('/api/admin/database/stats')
        def database_stats():
            connection_stats = conn_manager.get_connection_stats()
            transaction_stats = trans_manager.get_transaction_stats()
            
            return {
                'connection_stats': connection_stats,
                'transaction_stats': transaction_stats,
                'timestamp': datetime.now().isoformat()
            }
        
        logger.info("数据库管理器初始化完成")
        
    except Exception as e:
        logger.error(f"初始化数据库管理器失败: {str(e)}")
        # 不要抛出异常，让应用继续启动
        logger.warning("数据库管理器初始化失败，但应用将继续启动")