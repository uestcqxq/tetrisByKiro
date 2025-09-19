"""
用户服务单元测试
测试用户管理相关的所有功能
"""

import unittest
import tempfile
import os
from datetime import datetime, timezone, timedelta
from flask import Flask
from models.base import db
from models.user import User
from services.user_service import UserService
from services.base_service import ValidationError, DatabaseError


class TestUserService(unittest.TestCase):
    """用户服务测试类"""
    
    def setUp(self):
        """测试前设置"""
        # 使用内存数据库进行测试
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        
        # 初始化数据库
        db.init_app(self.app)
        
        # 设置应用上下文
        self.app_context = self.app.app_context()
        self.app_context.push()
        
        # 创建所有表
        db.create_all()
        
        # 创建服务实例
        self.user_service = UserService()
    
    def tearDown(self):
        """测试后清理"""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def test_generate_unique_username(self):
        """测试唯一用户名生成"""
        # 生成多个用户名，确保它们都是唯一的
        usernames = set()
        for _ in range(10):
            username = self.user_service.generate_unique_username()
            self.assertNotIn(username, usernames)
            usernames.add(username)
            
            # 验证用户名格式
            self.assertIsInstance(username, str)
            self.assertGreater(len(username), 0)
            self.assertLessEqual(len(username), 50)
    
    def test_generate_unique_username_with_existing_users(self):
        """测试在已有用户的情况下生成唯一用户名"""
        # 创建一些现有用户
        existing_usernames = ["Player_1234", "GamerPro123", "TetrisMaster"]
        for username in existing_usernames:
            user = User(username=username)
            user.save()
        
        # 生成新用户名，确保不与现有用户名冲突
        new_username = self.user_service.generate_unique_username()
        self.assertNotIn(new_username, existing_usernames)
    
    def test_validate_username(self):
        """测试用户名验证"""
        # 有效用户名
        valid_usernames = [
            "Player123",
            "Gamer_Pro",
            "TetrisMaster",
            "abc",
            "User_123_Test"
        ]
        
        for username in valid_usernames:
            self.assertTrue(
                self.user_service._validate_username(username),
                f"用户名 '{username}' 应该是有效的"
            )
        
        # 无效用户名
        invalid_usernames = [
            "",           # 空字符串
            "ab",         # 太短
            "a" * 51,     # 太长
            "123abc",     # 以数字开头
            "user@name",  # 包含特殊字符
            "user name",  # 包含空格
            None,         # None值
            "用户名",      # 包含中文
        ]
        
        for username in invalid_usernames:
            self.assertFalse(
                self.user_service._validate_username(username),
                f"用户名 '{username}' 应该是无效的"
            )
    
    def test_create_user_with_auto_generated_username(self):
        """测试使用自动生成用户名创建用户"""
        user = self.user_service.create_user()
        
        self.assertIsNotNone(user)
        self.assertIsNotNone(user.id)
        self.assertIsNotNone(user.username)
        self.assertIsInstance(user.created_at, datetime)
        self.assertIsInstance(user.last_active, datetime)
        
        # 验证用户已保存到数据库
        saved_user = User.get_by_id(user.id)
        self.assertIsNotNone(saved_user)
        self.assertEqual(saved_user.username, user.username)
    
    def test_create_user_with_custom_username(self):
        """测试使用自定义用户名创建用户"""
        custom_username = "TestPlayer123"
        user = self.user_service.create_user(custom_username)
        
        self.assertIsNotNone(user)
        self.assertEqual(user.username, custom_username)
        
        # 验证用户已保存到数据库
        saved_user = User.get_by_id(user.id)
        self.assertIsNotNone(saved_user)
        self.assertEqual(saved_user.username, custom_username)
    
    def test_create_user_with_duplicate_username(self):
        """测试创建重复用户名的用户"""
        username = "DuplicateUser"
        
        # 创建第一个用户
        user1 = self.user_service.create_user(username)
        self.assertIsNotNone(user1)
        
        # 尝试创建相同用户名的用户，应该抛出异常
        with self.assertRaises(ValidationError) as context:
            self.user_service.create_user(username)
        
        self.assertIn("已存在", str(context.exception))
    
    def test_create_user_with_invalid_username(self):
        """测试使用无效用户名创建用户"""
        invalid_usernames = ["", "ab", "123abc", "user@name"]
        
        for username in invalid_usernames:
            with self.assertRaises(ValidationError) as context:
                self.user_service.create_user(username)
            
            self.assertIn("格式无效", str(context.exception))
    
    def test_get_user_by_id(self):
        """测试根据ID获取用户"""
        # 创建测试用户
        user = self.user_service.create_user("TestUser")
        
        # 根据ID获取用户
        retrieved_user = self.user_service.get_user_by_id(user.id)
        
        self.assertIsNotNone(retrieved_user)
        self.assertEqual(retrieved_user.id, user.id)
        self.assertEqual(retrieved_user.username, user.username)
        
        # 测试不存在的ID
        non_existent_user = self.user_service.get_user_by_id("non-existent-id")
        self.assertIsNone(non_existent_user)
        
        # 测试空ID
        empty_id_user = self.user_service.get_user_by_id("")
        self.assertIsNone(empty_id_user)
    
    def test_get_user_by_username(self):
        """测试根据用户名获取用户"""
        # 创建测试用户
        username = "TestUser123"
        user = self.user_service.create_user(username)
        
        # 根据用户名获取用户
        retrieved_user = self.user_service.get_user_by_username(username)
        
        self.assertIsNotNone(retrieved_user)
        self.assertEqual(retrieved_user.id, user.id)
        self.assertEqual(retrieved_user.username, username)
        
        # 测试不存在的用户名
        non_existent_user = self.user_service.get_user_by_username("NonExistentUser")
        self.assertIsNone(non_existent_user)
        
        # 测试空用户名
        empty_username_user = self.user_service.get_user_by_username("")
        self.assertIsNone(empty_username_user)
    
    def test_update_user_activity(self):
        """测试更新用户活跃时间"""
        # 创建测试用户
        user = self.user_service.create_user("TestUser")
        original_last_active = user.last_active
        
        # 等待一小段时间确保时间戳不同
        import time
        time.sleep(0.1)
        
        # 更新用户活跃时间
        updated_user = self.user_service.update_user_activity(user.id)
        
        self.assertIsNotNone(updated_user)
        self.assertGreater(updated_user.last_active, original_last_active)
        
        # 测试不存在的用户ID
        result = self.user_service.update_user_activity("non-existent-id")
        self.assertIsNone(result)
    
    def test_get_all_users(self):
        """测试获取所有用户"""
        # 创建多个测试用户
        usernames = ["User1", "User2", "User3"]
        created_users = []
        
        for username in usernames:
            user = self.user_service.create_user(username)
            created_users.append(user)
        
        # 获取所有用户
        all_users = self.user_service.get_all_users()
        
        self.assertEqual(len(all_users), len(usernames))
        
        # 验证用户按创建时间倒序排列
        for i in range(len(all_users) - 1):
            self.assertGreaterEqual(
                all_users[i].created_at,
                all_users[i + 1].created_at
            )
    
    def test_get_active_users(self):
        """测试获取活跃用户"""
        # 创建测试用户
        user1 = self.user_service.create_user("ActiveUser1")
        user2 = self.user_service.create_user("ActiveUser2")
        user3 = self.user_service.create_user("InactiveUser")
        
        # 模拟用户3为非活跃用户（修改last_active时间）
        old_time = datetime.now(timezone.utc) - timedelta(days=10)
        user3.last_active = old_time
        user3.save()
        
        # 获取7天内活跃用户
        active_users = self.user_service.get_active_users(days=7)
        
        # 应该只包含user1和user2
        active_usernames = [user.username for user in active_users]
        self.assertIn("ActiveUser1", active_usernames)
        self.assertIn("ActiveUser2", active_usernames)
        self.assertNotIn("InactiveUser", active_usernames)
    
    def test_get_user_statistics(self):
        """测试获取用户统计信息"""
        # 创建测试用户
        user = self.user_service.create_user("StatUser")
        
        # 获取用户统计
        stats = self.user_service.get_user_statistics(user.id)
        
        self.assertIsInstance(stats, dict)
        self.assertEqual(stats['user_id'], user.id)
        self.assertEqual(stats['username'], user.username)
        self.assertIn('created_at', stats)
        self.assertIn('last_active', stats)
        self.assertIn('total_games', stats)
        self.assertIn('best_score', stats)
        
        # 测试不存在的用户
        empty_stats = self.user_service.get_user_statistics("non-existent-id")
        self.assertEqual(empty_stats, {})
    
    def test_delete_user(self):
        """测试删除用户"""
        # 创建测试用户
        user = self.user_service.create_user("UserToDelete")
        original_username = user.username
        
        # 删除用户
        result = self.user_service.delete_user(user.id)
        self.assertTrue(result)
        
        # 验证用户名已被修改（软删除）
        updated_user = User.get_by_id(user.id)
        self.assertIsNotNone(updated_user)
        self.assertNotEqual(updated_user.username, original_username)
        self.assertIn("deleted_user", updated_user.username)
        
        # 测试删除不存在的用户
        result = self.user_service.delete_user("non-existent-id")
        self.assertFalse(result)


if __name__ == '__main__':
    unittest.main()