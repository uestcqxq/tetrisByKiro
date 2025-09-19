"""
数据库管理器单元测试
测试数据库连接管理和监控功能
"""

import unittest
import time
from datetime import datetime, timezone, timedelta
from flask import Flask
from models.base import db
from services.database_manager import DatabaseManager, init_database_manager, connection_manager


class TestDatabaseManager(unittest.TestCase):
    """数据库管理器测试类"""
    
    def setUp(self):
        """测试前设置"""
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        
        db.init_app(self.app)
        
        self.app_context = self.app.app_context()
        self.app_context.push()
        
        db.create_all()
        
        # 初始化数据库管理器
        init_database_manager(self.app)
        self.db_manager = connection_manager
    
    def tearDown(self):
        """测试后清理"""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def test_database_manager_initialization(self):
        """测试数据库管理器初始化"""
        self.assertIsNotNone(self.db_manager)
        self.assertIsInstance(self.db_manager, DatabaseManager)
    
    def test_check_connection_health(self):
        """测试数据库连接健康检查"""
        # 正常情况下应该返回True
        is_healthy = self.db_manager.check_connection_health()
        self.assertTrue(is_healthy)
        
        # 强制检查
        is_healthy_forced = self.db_manager.check_connection_health(force_check=True)
        self.assertTrue(is_healthy_forced)
    
    def test_get_connection_stats(self):
        """测试获取连接统计信息"""
        stats = self.db_manager.get_connection_stats()
        
        self.assertIsInstance(stats, dict)
        self.assertIn('total_queries', stats)
        self.assertIn('successful_queries', stats)
        self.assertIn('failed_queries', stats)
        self.assertIn('last_check_time', stats)
        self.assertIn('is_healthy', stats)
        self.assertIn('uptime_seconds', stats)
    
    def test_record_query_success(self):
        """测试记录查询成功"""
        initial_stats = self.db_manager.get_connection_stats()
        initial_successful = initial_stats['successful_queries']
        
        # 记录成功查询
        self.db_manager.record_query_success()
        
        updated_stats = self.db_manager.get_connection_stats()
        self.assertEqual(updated_stats['successful_queries'], initial_successful + 1)
    
    def test_record_query_failure(self):
        """测试记录查询失败"""
        initial_stats = self.db_manager.get_connection_stats()
        initial_failed = initial_stats['failed_queries']
        
        # 记录失败查询
        test_error = Exception("Test database error")
        self.db_manager.record_query_failure(test_error)
        
        updated_stats = self.db_manager.get_connection_stats()
        self.assertEqual(updated_stats['failed_queries'], initial_failed + 1)
    
    def test_get_health_status(self):
        """测试获取健康状态"""
        health_status = self.db_manager.get_health_status()
        
        self.assertIsInstance(health_status, dict)
        self.assertIn('is_healthy', health_status)
        self.assertIn('last_error', health_status)
        self.assertIn('error_count', health_status)
        self.assertIn('uptime', health_status)
    
    def test_reset_stats(self):
        """测试重置统计信息"""
        # 先记录一些统计
        self.db_manager.record_query_success()
        self.db_manager.record_query_failure(Exception("Test"))
        
        # 重置统计
        self.db_manager.reset_stats()
        
        stats = self.db_manager.get_connection_stats()
        self.assertEqual(stats['total_queries'], 0)
        self.assertEqual(stats['successful_queries'], 0)
        self.assertEqual(stats['failed_queries'], 0)
    
    def test_connection_monitoring(self):
        """测试连接监控功能"""
        # 测试连接监控不会抛出异常
        try:
            # 模拟一些数据库操作
            db.session.execute('SELECT 1')
            db.session.commit()
        except Exception as e:
            self.fail(f"连接监控测试失败: {str(e)}")
    
    def test_error_threshold_handling(self):
        """测试错误阈值处理"""
        # 记录多个错误以测试阈值处理
        for i in range(5):
            self.db_manager.record_query_failure(Exception(f"Test error {i}"))
        
        health_status = self.db_manager.get_health_status()
        
        # 错误计数应该被记录
        self.assertGreaterEqual(health_status['error_count'], 5)
    
    def test_performance_monitoring(self):
        """测试性能监控"""
        start_time = time.time()
        
        # 模拟一些数据库操作
        db.session.execute('SELECT 1')
        
        end_time = time.time()
        query_time = end_time - start_time
        
        # 验证查询时间被合理记录
        self.assertGreater(query_time, 0)
        self.assertLess(query_time, 1)  # 简单查询应该很快


if __name__ == '__main__':
    unittest.main()