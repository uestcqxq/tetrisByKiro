"""
基础服务单元测试
测试BaseService类的通用功能
"""

import unittest
from datetime import datetime, timezone
from flask import Flask
from models.base import db
from services.base_service import BaseService, ValidationError, DatabaseError


class TestBaseService(unittest.TestCase):
    """基础服务测试类"""
    
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
        
        self.service = BaseService()
    
    def tearDown(self):
        """测试后清理"""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def test_validate_required_fields(self):
        """测试必需字段验证"""
        data = {
            'field1': 'value1',
            'field2': 'value2',
            'field3': None
        }
        
        # 有效情况
        try:
            self.service.validate_required_fields(data, ['field1', 'field2'])
        except ValidationError:
            self.fail("有效字段验证失败")
        
        # 缺少字段
        with self.assertRaises(ValidationError) as context:
            self.service.validate_required_fields(data, ['field1', 'missing_field'])
        
        self.assertIn("缺少必需字段", str(context.exception))
        
        # 字段值为None
        with self.assertRaises(ValidationError) as context:
            self.service.validate_required_fields(data, ['field1', 'field3'])
        
        self.assertIn("不能为空", str(context.exception))
    
    def test_validate_field_type(self):
        """测试字段类型验证"""
        # 有效类型
        try:
            self.service.validate_field_type("test", str, "test_field")
            self.service.validate_field_type(123, int, "test_field")
            self.service.validate_field_type(12.5, float, "test_field")
        except ValidationError:
            self.fail("有效类型验证失败")
        
        # 无效类型
        with self.assertRaises(ValidationError) as context:
            self.service.validate_field_type("123", int, "test_field")
        
        self.assertIn("类型必须是", str(context.exception))
    
    def test_validate_field_range(self):
        """测试字段范围验证"""
        # 有效范围
        try:
            self.service.validate_field_range(5, 1, 10, "test_field")
            self.service.validate_field_range(1, 1, 10, "test_field")
            self.service.validate_field_range(10, 1, 10, "test_field")
        except ValidationError:
            self.fail("有效范围验证失败")
        
        # 超出范围
        with self.assertRaises(ValidationError) as context:
            self.service.validate_field_range(0, 1, 10, "test_field")
        
        self.assertIn("必须在", str(context.exception))
        
        with self.assertRaises(ValidationError) as context:
            self.service.validate_field_range(11, 1, 10, "test_field")
        
        self.assertIn("必须在", str(context.exception))
    
    def test_sanitize_string(self):
        """测试字符串清理"""
        # 正常字符串
        result = self.service.sanitize_string("  test string  ")
        self.assertEqual(result, "test string")
        
        # 超长字符串
        long_string = "a" * 100
        result = self.service.sanitize_string(long_string, max_length=50)
        self.assertEqual(len(result), 50)
        
        # 空字符串
        result = self.service.sanitize_string("   ")
        self.assertEqual(result, "")
        
        # None值
        result = self.service.sanitize_string(None)
        self.assertEqual(result, "")
    
    def test_log_operation(self):
        """测试操作日志记录"""
        # 测试不同级别的日志
        try:
            self.service.log_operation("test_operation", {"key": "value"}, level="info")
            self.service.log_operation("test_operation", {"key": "value"}, level="warning")
            self.service.log_operation("test_operation", {"key": "value"}, level="error")
        except Exception as e:
            self.fail(f"日志记录失败: {str(e)}")
    
    def test_handle_database_error(self):
        """测试数据库错误处理"""
        test_error = Exception("Test database error")
        
        # 测试错误处理不会抛出异常
        try:
            self.service.handle_database_error(test_error, "test_operation", {"context": "test"})
        except Exception as e:
            self.fail(f"数据库错误处理失败: {str(e)}")
    
    def test_database_transaction_context(self):
        """测试数据库事务上下文管理器"""
        # 测试正常事务
        try:
            with self.service.database_transaction():
                # 模拟数据库操作
                pass
        except Exception as e:
            self.fail(f"正常事务处理失败: {str(e)}")
        
        # 测试事务回滚
        try:
            with self.service.database_transaction():
                raise Exception("Test transaction rollback")
        except Exception:
            # 异常应该被重新抛出
            pass
    
    def test_validation_error_creation(self):
        """测试ValidationError异常创建"""
        error = ValidationError("Test message", field="test_field", value="test_value")
        
        self.assertEqual(str(error), "Test message")
        self.assertEqual(error.field, "test_field")
        self.assertEqual(error.value, "test_value")
        
        # 测试to_dict方法
        error_dict = error.to_dict()
        self.assertIn("message", error_dict)
        self.assertIn("field", error_dict)
        self.assertIn("value", error_dict)
    
    def test_database_error_creation(self):
        """测试DatabaseError异常创建"""
        original_error = Exception("Original error")
        error = DatabaseError("Database error message", original_error=original_error)
        
        self.assertEqual(str(error), "Database error message")
        self.assertEqual(error.original_error, original_error)
        
        # 测试to_dict方法
        error_dict = error.to_dict()
        self.assertIn("message", error_dict)
        self.assertIn("original_error", error_dict)


if __name__ == '__main__':
    unittest.main()