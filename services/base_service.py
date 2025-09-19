"""
基础服务类
定义所有服务的通用接口和基础功能
"""

import logging
import time
from abc import ABC
from contextlib import contextmanager
from typing import Any, Optional, Dict, List
from functools import wraps
from sqlalchemy.exc import (
    SQLAlchemyError, 
    IntegrityError, 
    OperationalError, 
    DisconnectionError,
    TimeoutError as SQLTimeoutError
)
from models.base import db


# 配置日志
logger = logging.getLogger(__name__)


class DatabaseError(Exception):
    """数据库操作异常"""
    def __init__(self, message: str, original_error: Exception = None, error_code: str = None):
        super().__init__(message)
        self.original_error = original_error
        self.error_code = error_code or 'DB_ERROR'


class ValidationError(Exception):
    """数据验证异常"""
    def __init__(self, message: str, field: str = None, value: Any = None):
        super().__init__(message)
        self.field = field
        self.value = value


def retry_on_database_error(max_retries: int = 3, delay: float = 0.1):
    """数据库操作重试装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except (OperationalError, DisconnectionError, SQLTimeoutError) as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(f"数据库操作失败，第 {attempt + 1} 次重试: {str(e)}")
                        time.sleep(delay * (2 ** attempt))  # 指数退避
                        continue
                    else:
                        logger.error(f"数据库操作重试 {max_retries} 次后仍然失败: {str(e)}")
                        break
                except Exception as e:
                    # 对于非连接相关的错误，不进行重试
                    raise e
            
            # 如果所有重试都失败了，抛出最后一个异常
            raise DatabaseError(
                f"数据库操作失败，已重试 {max_retries} 次",
                original_error=last_exception,
                error_code='DB_CONNECTION_FAILED'
            )
        
        return wrapper
    return decorator


class BaseService(ABC):
    """所有服务类的基类"""
    
    def __init__(self):
        self.db = db
        self.logger = logging.getLogger(self.__class__.__name__)
    
    @contextmanager
    def database_transaction(self, auto_commit: bool = True):
        """
        数据库事务上下文管理器
        
        Args:
            auto_commit: 是否自动提交事务
            
        Usage:
            with self.database_transaction():
                # 数据库操作
                pass
        """
        try:
            yield self.db.session
            if auto_commit:
                self.db.session.commit()
                self.logger.debug("数据库事务提交成功")
        except IntegrityError as e:
            self.db.session.rollback()
            self.logger.error(f"数据完整性错误: {str(e)}")
            raise DatabaseError(
                "数据完整性约束违反",
                original_error=e,
                error_code='DB_INTEGRITY_ERROR'
            )
        except OperationalError as e:
            self.db.session.rollback()
            self.logger.error(f"数据库操作错误: {str(e)}")
            raise DatabaseError(
                "数据库操作失败",
                original_error=e,
                error_code='DB_OPERATIONAL_ERROR'
            )
        except SQLAlchemyError as e:
            self.db.session.rollback()
            self.logger.error(f"SQLAlchemy错误: {str(e)}")
            raise DatabaseError(
                "数据库错误",
                original_error=e,
                error_code='DB_SQLALCHEMY_ERROR'
            )
        except Exception as e:
            self.db.session.rollback()
            self.logger.error(f"未知错误: {str(e)}")
            raise DatabaseError(
                "数据库操作发生未知错误",
                original_error=e,
                error_code='DB_UNKNOWN_ERROR'
            )
    
    @retry_on_database_error(max_retries=3)
    def commit_transaction(self):
        """提交数据库事务"""
        try:
            self.db.session.commit()
            self.logger.debug("数据库事务提交成功")
        except Exception as e:
            self.db.session.rollback()
            self.logger.error(f"提交事务失败: {str(e)}")
            raise DatabaseError(
                "提交数据库事务失败",
                original_error=e,
                error_code='DB_COMMIT_FAILED'
            )
    
    def rollback_transaction(self):
        """回滚数据库事务"""
        try:
            self.db.session.rollback()
            self.logger.debug("数据库事务回滚成功")
        except Exception as e:
            self.logger.error(f"回滚事务失败: {str(e)}")
            # 即使回滚失败也不抛出异常，避免掩盖原始错误
    
    @retry_on_database_error(max_retries=2)
    def check_database_connection(self) -> bool:
        """
        检查数据库连接状态
        
        Returns:
            bool: 连接是否正常
        """
        try:
            from sqlalchemy import text
            with self.db.engine.connect() as conn:
                conn.execute(text("SELECT 1")).fetchone()
            self.logger.debug("数据库连接检查通过")
            return True
        except Exception as e:
            self.logger.error(f"数据库连接检查失败: {str(e)}")
            return False
    
    def validate_required_fields(self, data: Dict[str, Any], required_fields: List[str]) -> None:
        """
        验证必需字段
        
        Args:
            data: 要验证的数据字典
            required_fields: 必需字段列表
            
        Raises:
            ValidationError: 如果缺少必需字段
        """
        missing_fields = []
        for field in required_fields:
            if field not in data or data[field] is None:
                missing_fields.append(field)
        
        if missing_fields:
            raise ValidationError(
                f"缺少必需字段: {', '.join(missing_fields)}",
                field=missing_fields[0] if len(missing_fields) == 1 else None
            )
    
    def validate_field_type(self, value: Any, expected_type: type, field_name: str) -> None:
        """
        验证字段类型
        
        Args:
            value: 要验证的值
            expected_type: 期望的类型
            field_name: 字段名称
            
        Raises:
            ValidationError: 如果类型不匹配
        """
        if not isinstance(value, expected_type):
            raise ValidationError(
                f"字段 {field_name} 类型错误，期望 {expected_type.__name__}，实际 {type(value).__name__}",
                field=field_name,
                value=value
            )
    
    def validate_field_range(self, value: int, min_val: int, max_val: int, field_name: str) -> None:
        """
        验证数值字段范围
        
        Args:
            value: 要验证的值
            min_val: 最小值
            max_val: 最大值
            field_name: 字段名称
            
        Raises:
            ValidationError: 如果值超出范围
        """
        if not isinstance(value, (int, float)):
            raise ValidationError(
                f"字段 {field_name} 必须是数值类型",
                field=field_name,
                value=value
            )
        
        if value < min_val or value > max_val:
            raise ValidationError(
                f"字段 {field_name} 值 {value} 超出范围 [{min_val}, {max_val}]",
                field=field_name,
                value=value
            )
    
    def sanitize_string(self, value: str, max_length: int = None, allow_empty: bool = False) -> str:
        """
        清理字符串输入
        
        Args:
            value: 要清理的字符串
            max_length: 最大长度限制
            allow_empty: 是否允许空字符串
            
        Returns:
            str: 清理后的字符串
            
        Raises:
            ValidationError: 如果字符串无效
        """
        if not isinstance(value, str):
            raise ValidationError("输入必须是字符串类型")
        
        # 去除首尾空白
        cleaned = value.strip()
        
        # 检查空字符串
        if not cleaned and not allow_empty:
            raise ValidationError("字符串不能为空")
        
        # 检查长度
        if max_length and len(cleaned) > max_length:
            raise ValidationError(f"字符串长度不能超过 {max_length} 个字符")
        
        # 移除潜在的危险字符（基础清理）
        dangerous_chars = ['<', '>', '"', "'", '&', '\x00']
        for char in dangerous_chars:
            if char in cleaned:
                cleaned = cleaned.replace(char, '')
        
        return cleaned
    
    def log_operation(self, operation: str, details: Dict[str, Any] = None, level: str = 'info') -> None:
        """
        记录操作日志
        
        Args:
            operation: 操作名称
            details: 操作详情
            level: 日志级别
        """
        log_message = f"操作: {operation}"
        if details:
            log_message += f", 详情: {details}"
        
        log_func = getattr(self.logger, level.lower(), self.logger.info)
        log_func(log_message)
    
    def handle_database_error(self, error: Exception, operation: str, context: Dict[str, Any] = None) -> None:
        """
        统一处理数据库错误
        
        Args:
            error: 原始异常
            operation: 操作名称
            context: 错误上下文信息
        """
        error_context = context or {}
        
        if isinstance(error, IntegrityError):
            self.logger.error(f"数据完整性错误 - 操作: {operation}, 上下文: {error_context}, 错误: {str(error)}")
        elif isinstance(error, OperationalError):
            self.logger.error(f"数据库操作错误 - 操作: {operation}, 上下文: {error_context}, 错误: {str(error)}")
        elif isinstance(error, DisconnectionError):
            self.logger.error(f"数据库连接断开 - 操作: {operation}, 上下文: {error_context}, 错误: {str(error)}")
        else:
            self.logger.error(f"未知数据库错误 - 操作: {operation}, 上下文: {error_context}, 错误: {str(error)}")
    
    def get_database_stats(self) -> Dict[str, Any]:
        """
        获取数据库连接统计信息
        
        Returns:
            Dict[str, Any]: 数据库统计信息
        """
        try:
            engine = self.db.engine
            pool = engine.pool
            
            return {
                'pool_size': pool.size(),
                'checked_in': pool.checkedin(),
                'checked_out': pool.checkedout(),
                'overflow': pool.overflow(),
                'invalid': pool.invalid(),
                'connection_info': str(engine.url).replace(engine.url.password or '', '***') if engine.url.password else str(engine.url)
            }
        except Exception as e:
            self.logger.error(f"获取数据库统计信息失败: {str(e)}")
            return {'error': str(e)}