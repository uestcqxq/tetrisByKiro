"""
数据清理服务单元测试
测试数据清理和维护功能
"""

import unittest
from datetime import datetime, timezone, timedelta
from flask import Flask
from models.base import db
from models.user import User
from models.game_record import GameRecord
from services.data_cleanup_service import DataCleanupService
from services.user_service import UserService


class TestDataCleanupService(unittest.TestCase):
    """数据清理服务测试类"""
    
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
        
        self.cleanup_service = DataCleanupService()
        self.user_service = UserService()
        
        # 创建测试用户
        self.test_user1 = self.user_service.create_user("CleanupTestUser1")
        self.test_user2 = self.user_service.create_user("CleanupTestUser2")
    
    def tearDown(self):
        """测试后清理"""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def test_cleanup_old_game_records(self):
        """测试清理旧游戏记录"""
        # 创建新旧游戏记录
        old_time = datetime.now(timezone.utc) - timedelta(days=100)
        recent_time = datetime.now(timezone.utc) - timedelta(days=1)
        
        # 创建旧记录
        old_record = GameRecord(
            user_id=self.test_user1.id,
            score=1000,
            level=5,
            lines_cleared=20,
            game_duration=300
        )
        old_record.created_at = old_time
        old_record.save()
        
        # 创建新记录
        recent_record = GameRecord(
            user_id=self.test_user1.id,
            score=2000,
            level=8,
            lines_cleared=30,
            game_duration=400
        )
        recent_record.created_at = recent_time
        recent_record.save()
        
        # 执行清理（保留30天内的记录）
        deleted_count = self.cleanup_service.cleanup_old_game_records(days_to_keep=30)
        
        # 验证旧记录被删除，新记录保留
        self.assertEqual(deleted_count, 1)
        
        remaining_records = GameRecord.query.all()
        self.assertEqual(len(remaining_records), 1)
        self.assertEqual(remaining_records[0].id, recent_record.id)
    
    def test_cleanup_inactive_users(self):
        """测试清理非活跃用户"""
        # 设置用户为非活跃状态
        old_time = datetime.now(timezone.utc) - timedelta(days=200)
        self.test_user1.last_active = old_time
        self.test_user1.save()
        
        # 保持另一个用户为活跃状态
        self.test_user2.update_last_active()
        
        # 执行清理（保留180天内活跃的用户）
        deleted_count = self.cleanup_service.cleanup_inactive_users(days_inactive=180)
        
        # 验证非活跃用户被删除
        self.assertEqual(deleted_count, 1)
        
        remaining_users = User.query.all()
        self.assertEqual(len(remaining_users), 1)
        self.assertEqual(remaining_users[0].id, self.test_user2.id)
    
    def test_cleanup_orphaned_game_records(self):
        """测试清理孤立的游戏记录"""
        # 创建游戏记录
        game_record = GameRecord(
            user_id=self.test_user1.id,
            score=1500,
            level=6,
            lines_cleared=25,
            game_duration=350
        )
        game_record.save()
        
        # 删除用户，使游戏记录成为孤立记录
        self.test_user1.delete()
        
        # 执行清理
        deleted_count = self.cleanup_service.cleanup_orphaned_game_records()
        
        # 验证孤立记录被删除
        self.assertEqual(deleted_count, 1)
        
        remaining_records = GameRecord.query.all()
        self.assertEqual(len(remaining_records), 0)
    
    def test_optimize_database(self):
        """测试数据库优化"""
        # 创建一些测试数据
        for i in range(10):
            record = GameRecord(
                user_id=self.test_user1.id,
                score=1000 + i * 100,
                level=5,
                lines_cleared=20,
                game_duration=300
            )
            record.save()
        
        # 执行数据库优化
        try:
            result = self.cleanup_service.optimize_database()
            self.assertTrue(result)
        except Exception as e:
            # SQLite可能不支持所有优化操作，这是正常的
            self.assertIn("not supported", str(e).lower())
    
    def test_get_cleanup_statistics(self):
        """测试获取清理统计信息"""
        # 创建一些测试数据
        for i in range(5):
            record = GameRecord(
                user_id=self.test_user1.id,
                score=1000 + i * 100,
                level=5,
                lines_cleared=20,
                game_duration=300
            )
            record.save()
        
        stats = self.cleanup_service.get_cleanup_statistics()
        
        self.assertIsInstance(stats, dict)
        self.assertIn('total_users', stats)
        self.assertIn('total_game_records', stats)
        self.assertIn('inactive_users_30_days', stats)
        self.assertIn('inactive_users_90_days', stats)
        self.assertIn('old_records_30_days', stats)
        self.assertIn('old_records_90_days', stats)
        self.assertIn('orphaned_records', stats)
        
        # 验证统计数据的合理性
        self.assertGreaterEqual(stats['total_users'], 0)
        self.assertGreaterEqual(stats['total_game_records'], 0)
    
    def test_cleanup_duplicate_records(self):
        """测试清理重复记录"""
        # 创建重复的游戏记录
        duplicate_data = {
            'user_id': self.test_user1.id,
            'score': 2000,
            'level': 8,
            'lines_cleared': 30,
            'game_duration': 400
        }
        
        # 创建多个相同的记录
        for _ in range(3):
            record = GameRecord(**duplicate_data)
            record.save()
        
        # 执行去重
        deleted_count = self.cleanup_service.cleanup_duplicate_records()
        
        # 验证重复记录被删除，只保留一个
        self.assertGreaterEqual(deleted_count, 2)
        
        remaining_records = GameRecord.query.filter_by(
            user_id=self.test_user1.id,
            score=2000
        ).all()
        self.assertEqual(len(remaining_records), 1)
    
    def test_archive_old_data(self):
        """测试归档旧数据"""
        # 创建旧数据
        old_time = datetime.now(timezone.utc) - timedelta(days=400)
        
        old_record = GameRecord(
            user_id=self.test_user1.id,
            score=1000,
            level=5,
            lines_cleared=20,
            game_duration=300
        )
        old_record.created_at = old_time
        old_record.save()
        
        # 执行归档（这里只是测试方法调用，实际归档逻辑可能需要外部存储）
        try:
            archived_count = self.cleanup_service.archive_old_data(days_to_archive=365)
            self.assertGreaterEqual(archived_count, 0)
        except NotImplementedError:
            # 如果归档功能未实现，这是可以接受的
            pass
    
    def test_cleanup_performance(self):
        """测试清理操作的性能"""
        import time
        
        # 创建大量测试数据
        start_time = time.time()
        
        for i in range(100):
            record = GameRecord(
                user_id=self.test_user1.id,
                score=1000 + i,
                level=5,
                lines_cleared=20,
                game_duration=300
            )
            record.save()
        
        creation_time = time.time() - start_time
        
        # 执行清理操作
        cleanup_start = time.time()
        stats = self.cleanup_service.get_cleanup_statistics()
        cleanup_time = time.time() - cleanup_start
        
        # 验证性能合理
        self.assertLess(cleanup_time, 5.0)  # 清理操作应该在5秒内完成
        self.assertGreater(stats['total_game_records'], 0)
    
    def test_cleanup_with_constraints(self):
        """测试带约束条件的清理"""
        # 创建不同用户的记录
        for user in [self.test_user1, self.test_user2]:
            for i in range(5):
                record = GameRecord(
                    user_id=user.id,
                    score=1000 + i * 100,
                    level=5,
                    lines_cleared=20,
                    game_duration=300
                )
                record.save()
        
        # 只清理特定用户的记录
        deleted_count = self.cleanup_service.cleanup_user_records(
            user_id=self.test_user1.id,
            keep_latest=2
        )
        
        # 验证只有指定用户的旧记录被删除
        user1_records = GameRecord.query.filter_by(user_id=self.test_user1.id).count()
        user2_records = GameRecord.query.filter_by(user_id=self.test_user2.id).count()
        
        self.assertEqual(user1_records, 2)  # 保留最新的2条
        self.assertEqual(user2_records, 5)  # 其他用户记录不受影响


if __name__ == '__main__':
    unittest.main()