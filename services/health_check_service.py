"""
系统健康检查服务
监控应用的各个组件状态，提供健康检查端点
"""

import time
import psutil
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum

from .database_manager import DatabaseManager
from .base_service import BaseService


class HealthStatus(Enum):
    """健康状态枚举"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class ComponentHealth:
    """组件健康状态"""
    name: str
    status: HealthStatus
    message: str
    response_time: float
    last_check: datetime
    details: Dict[str, Any] = None
    
    def to_dict(self):
        """转换为字典"""
        data = asdict(self)
        data['status'] = self.status.value
        data['last_check'] = self.last_check.isoformat()
        return data


class HealthCheckService(BaseService):
    """健康检查服务"""
    
    def __init__(self):
        super().__init__()
        self.components = {}
        self.system_metrics = {}
        self.check_interval = 30  # 30秒检查一次
        self.monitoring_thread = None
        self.is_monitoring = False
        
        # 健康检查阈值
        self.thresholds = {
            'cpu_usage': 80.0,  # CPU使用率阈值
            'memory_usage': 85.0,  # 内存使用率阈值
            'disk_usage': 90.0,  # 磁盘使用率阈值
            'response_time': 5.0,  # 响应时间阈值（秒）
            'error_rate': 0.05,  # 错误率阈值（5%）
        }
        
        self.initialize_components()
    
    def initialize_components(self):
        """初始化监控组件"""
        self.components = {
            'database': ComponentHealth(
                name='database',
                status=HealthStatus.UNKNOWN,
                message='Not checked',
                response_time=0.0,
                last_check=datetime.now()
            ),
            'redis': ComponentHealth(
                name='redis',
                status=HealthStatus.UNKNOWN,
                message='Not checked',
                response_time=0.0,
                last_check=datetime.now()
            ),
            'websocket': ComponentHealth(
                name='websocket',
                status=HealthStatus.UNKNOWN,
                message='Not checked',
                response_time=0.0,
                last_check=datetime.now()
            ),
            'system': ComponentHealth(
                name='system',
                status=HealthStatus.UNKNOWN,
                message='Not checked',
                response_time=0.0,
                last_check=datetime.now()
            )
        }
    
    def start_monitoring(self):
        """开始健康监控"""
        if self.is_monitoring:
            return
        
        self.is_monitoring = True
        self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitoring_thread.start()
        
        self.logger.info("健康监控已启动")
    
    def stop_monitoring(self):
        """停止健康监控"""
        self.is_monitoring = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=5)
        
        self.logger.info("健康监控已停止")
    
    def _monitoring_loop(self):
        """监控循环"""
        while self.is_monitoring:
            try:
                self.check_all_components()
                time.sleep(self.check_interval)
            except Exception as e:
                self.logger.error(f"健康监控循环错误: {e}")
                time.sleep(self.check_interval)
    
    def check_all_components(self):
        """检查所有组件"""
        self.check_database()
        self.check_redis()
        self.check_websocket()
        self.check_system()
    
    def check_database(self):
        """检查数据库健康状态"""
        start_time = time.time()
        
        try:
            # 检查是否在Flask应用上下文中
            from flask import has_app_context, current_app
            
            if not has_app_context():
                self.components['database'] = ComponentHealth(
                    name='database',
                    status=HealthStatus.UNKNOWN,
                    message="无应用上下文，跳过数据库检查",
                    response_time=0.0,
                    last_check=datetime.now()
                )
                return
            
            # 使用Flask-SQLAlchemy的数据库连接
            from models.base import db
            from sqlalchemy import text
            
            # 执行简单查询测试连接
            result = db.session.execute(text("SELECT 1")).fetchone()
            
            response_time = time.time() - start_time
            
            if response_time > self.thresholds['response_time']:
                status = HealthStatus.DEGRADED
                message = f"数据库响应缓慢: {response_time:.2f}s"
            else:
                status = HealthStatus.HEALTHY
                message = "数据库连接正常"
            
            # 获取连接池信息
            pool_info = {}
            try:
                pool = db.engine.pool
                pool_info = {
                    'pool_size': pool.size(),
                    'checked_in': pool.checkedin(),
                    'checked_out': pool.checkedout(),
                    'overflow': pool.overflow(),
                    'invalid': pool.invalid(),
                }
            except Exception:
                pool_info = {'pool_info': 'unavailable'}
            
            self.components['database'] = ComponentHealth(
                name='database',
                status=status,
                message=message,
                response_time=response_time,
                last_check=datetime.now(),
                details=pool_info
            )
            
        except Exception as e:
            self.components['database'] = ComponentHealth(
                name='database',
                status=HealthStatus.UNHEALTHY,
                message=f"数据库连接失败: {str(e)}",
                response_time=time.time() - start_time,
                last_check=datetime.now(),
                details={'error': str(e)}
            )
    
    def check_redis(self):
        """检查Redis健康状态"""
        start_time = time.time()
        
        try:
            import redis
            from flask import current_app
            
            redis_url = current_app.config.get('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            
            # 执行ping测试
            r.ping()
            
            # 获取Redis信息
            info = r.info()
            
            response_time = time.time() - start_time
            
            if response_time > self.thresholds['response_time']:
                status = HealthStatus.DEGRADED
                message = f"Redis响应缓慢: {response_time:.2f}s"
            else:
                status = HealthStatus.HEALTHY
                message = "Redis连接正常"
            
            self.components['redis'] = ComponentHealth(
                name='redis',
                status=status,
                message=message,
                response_time=response_time,
                last_check=datetime.now(),
                details={
                    'version': info.get('redis_version'),
                    'connected_clients': info.get('connected_clients'),
                    'used_memory_human': info.get('used_memory_human'),
                    'uptime_in_seconds': info.get('uptime_in_seconds')
                }
            )
            
        except ImportError:
            self.components['redis'] = ComponentHealth(
                name='redis',
                status=HealthStatus.UNKNOWN,
                message="Redis客户端未安装",
                response_time=0.0,
                last_check=datetime.now()
            )
        except Exception as e:
            self.components['redis'] = ComponentHealth(
                name='redis',
                status=HealthStatus.UNHEALTHY,
                message=f"Redis连接失败: {str(e)}",
                response_time=time.time() - start_time,
                last_check=datetime.now(),
                details={'error': str(e)}
            )
    
    def check_websocket(self):
        """检查WebSocket健康状态"""
        start_time = time.time()
        
        try:
            # 这里可以添加WebSocket连接测试
            # 由于WebSocket服务通常与主应用集成，我们检查相关配置
            from flask import current_app
            
            socketio_config = current_app.config.get('SOCKETIO_REDIS_URL')
            
            response_time = time.time() - start_time
            
            if socketio_config:
                status = HealthStatus.HEALTHY
                message = "WebSocket配置正常"
            else:
                status = HealthStatus.DEGRADED
                message = "WebSocket配置缺失"
            
            self.components['websocket'] = ComponentHealth(
                name='websocket',
                status=status,
                message=message,
                response_time=response_time,
                last_check=datetime.now(),
                details={
                    'redis_url_configured': bool(socketio_config),
                    'async_mode': current_app.config.get('SOCKETIO_ASYNC_MODE', 'unknown')
                }
            )
            
        except Exception as e:
            self.components['websocket'] = ComponentHealth(
                name='websocket',
                status=HealthStatus.UNHEALTHY,
                message=f"WebSocket检查失败: {str(e)}",
                response_time=time.time() - start_time,
                last_check=datetime.now(),
                details={'error': str(e)}
            )
    
    def check_system(self):
        """检查系统资源健康状态"""
        start_time = time.time()
        
        try:
            # CPU使用率
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # 内存使用率
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # 磁盘使用率
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            
            # 网络统计
            network = psutil.net_io_counters()
            
            # 进程信息
            process = psutil.Process()
            process_memory = process.memory_info()
            
            response_time = time.time() - start_time
            
            # 判断系统健康状态
            issues = []
            if cpu_percent > self.thresholds['cpu_usage']:
                issues.append(f"CPU使用率过高: {cpu_percent:.1f}%")
            
            if memory_percent > self.thresholds['memory_usage']:
                issues.append(f"内存使用率过高: {memory_percent:.1f}%")
            
            if disk_percent > self.thresholds['disk_usage']:
                issues.append(f"磁盘使用率过高: {disk_percent:.1f}%")
            
            if issues:
                status = HealthStatus.DEGRADED if len(issues) == 1 else HealthStatus.UNHEALTHY
                message = "; ".join(issues)
            else:
                status = HealthStatus.HEALTHY
                message = "系统资源正常"
            
            # 更新系统指标
            self.system_metrics = {
                'cpu_percent': cpu_percent,
                'memory_percent': memory_percent,
                'memory_available': memory.available,
                'memory_total': memory.total,
                'disk_percent': disk_percent,
                'disk_free': disk.free,
                'disk_total': disk.total,
                'network_bytes_sent': network.bytes_sent,
                'network_bytes_recv': network.bytes_recv,
                'process_memory_rss': process_memory.rss,
                'process_memory_vms': process_memory.vms,
                'load_average': psutil.getloadavg() if hasattr(psutil, 'getloadavg') else None
            }
            
            self.components['system'] = ComponentHealth(
                name='system',
                status=status,
                message=message,
                response_time=response_time,
                last_check=datetime.now(),
                details=self.system_metrics
            )
            
        except Exception as e:
            self.components['system'] = ComponentHealth(
                name='system',
                status=HealthStatus.UNHEALTHY,
                message=f"系统检查失败: {str(e)}",
                response_time=time.time() - start_time,
                last_check=datetime.now(),
                details={'error': str(e)}
            )
    
    def get_overall_health(self) -> Dict[str, Any]:
        """获取整体健康状态"""
        component_statuses = [comp.status for comp in self.components.values()]
        
        # 确定整体状态
        if all(status == HealthStatus.HEALTHY for status in component_statuses):
            overall_status = HealthStatus.HEALTHY
            overall_message = "所有组件正常"
        elif any(status == HealthStatus.UNHEALTHY for status in component_statuses):
            overall_status = HealthStatus.UNHEALTHY
            unhealthy_components = [
                comp.name for comp in self.components.values() 
                if comp.status == HealthStatus.UNHEALTHY
            ]
            overall_message = f"组件异常: {', '.join(unhealthy_components)}"
        elif any(status == HealthStatus.DEGRADED for status in component_statuses):
            overall_status = HealthStatus.DEGRADED
            degraded_components = [
                comp.name for comp in self.components.values() 
                if comp.status == HealthStatus.DEGRADED
            ]
            overall_message = f"组件性能下降: {', '.join(degraded_components)}"
        else:
            overall_status = HealthStatus.UNKNOWN
            overall_message = "状态未知"
        
        return {
            'status': overall_status.value,
            'message': overall_message,
            'timestamp': datetime.now().isoformat(),
            'components': {name: comp.to_dict() for name, comp in self.components.items()},
            'system_metrics': self.system_metrics
        }
    
    def get_component_health(self, component_name: str) -> Optional[Dict[str, Any]]:
        """获取特定组件的健康状态"""
        component = self.components.get(component_name)
        if component:
            return component.to_dict()
        return None
    
    def get_metrics(self) -> Dict[str, Any]:
        """获取系统指标"""
        return {
            'timestamp': datetime.now().isoformat(),
            'system_metrics': self.system_metrics,
            'component_response_times': {
                name: comp.response_time 
                for name, comp in self.components.items()
            },
            'component_statuses': {
                name: comp.status.value 
                for name, comp in self.components.items()
            }
        }
    
    def is_healthy(self) -> bool:
        """检查系统是否健康"""
        overall_health = self.get_overall_health()
        return overall_health['status'] == HealthStatus.HEALTHY.value
    
    def get_readiness_status(self) -> Dict[str, Any]:
        """获取就绪状态（用于Kubernetes就绪探针）"""
        critical_components = ['database']  # 关键组件
        
        critical_healthy = all(
            self.components[comp].status in [HealthStatus.HEALTHY, HealthStatus.DEGRADED]
            for comp in critical_components
            if comp in self.components
        )
        
        return {
            'ready': critical_healthy,
            'timestamp': datetime.now().isoformat(),
            'critical_components': {
                comp: self.components[comp].to_dict()
                for comp in critical_components
                if comp in self.components
            }
        }
    
    def get_liveness_status(self) -> Dict[str, Any]:
        """获取存活状态（用于Kubernetes存活探针）"""
        # 简单的存活检查 - 只要进程在运行就认为存活
        return {
            'alive': True,
            'timestamp': datetime.now().isoformat(),
            'uptime': time.time() - psutil.Process().create_time()
        }
    
    def set_threshold(self, metric: str, value: float):
        """设置阈值"""
        if metric in self.thresholds:
            self.thresholds[metric] = value
            self.logger.info(f"阈值已更新: {metric} = {value}")
        else:
            raise ValueError(f"未知的指标: {metric}")
    
    def get_thresholds(self) -> Dict[str, float]:
        """获取当前阈值"""
        return self.thresholds.copy()
    
    def reset_component_status(self, component_name: str):
        """重置组件状态"""
        if component_name in self.components:
            self.components[component_name].status = HealthStatus.UNKNOWN
            self.components[component_name].message = "Status reset"
            self.components[component_name].last_check = datetime.now()
            self.logger.info(f"组件状态已重置: {component_name}")
    
    def force_check(self, component_name: Optional[str] = None):
        """强制检查组件"""
        if component_name:
            if component_name == 'database':
                self.check_database()
            elif component_name == 'redis':
                self.check_redis()
            elif component_name == 'websocket':
                self.check_websocket()
            elif component_name == 'system':
                self.check_system()
            else:
                raise ValueError(f"未知的组件: {component_name}")
        else:
            self.check_all_components()


# 全局健康检查服务实例
health_service = HealthCheckService()