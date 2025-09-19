"""
数据模型单元测试
测试所有数据模型的功能
"""

import unittest
from datetime import datetime, timezone, timedelta
from flask import Flask
from models.base import db, BaseModel
from models.user import User
from models.game_record import GameRecord


class TestBaseModel(unittest.TestCase):
    """基础模型测试类"""
    
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
    
    def tearDown(self):
        """测试后清理"""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def test_base_model_id_generation(self):
        """测试基础模型ID生成"""
        user = User(username="TestUser")
        
        # ID应该自动生成
        self.assertIsNotNone(user.id)
        self.assertIsInstance(user.id, str)
        self.assertEqual(len(user.id), 36)  # UUID长度
    
    def test_base_model_created_at(self):
        """测试基础模型创建时间"""
        user = User(username="TestUser")
        
        # created_at应该自动设置
        self.assertIsNotNone(user.created_at)
        self.assertIsInstance(user.created_at, datetime)
        
        # 时间应该接近当前时间
        now = datetime.now(timezone.utc)
        time_diff = abs((now - user.created_at).total_seconds())
        self.assertLess(time_diff, 1)  # 1秒内
    
    def test_base_model_to_dict(self):
        """测试模型转字典功能"""
        user = User(username="TestUser")
        user.save()
        
        user_dict = user.to_dict()
        
        self.assertIsInstance(user_dict, dict)
        self.assertIn('id', user_dict)
        self.assertIn('username', user_dict)
        self.assertIn('created_at', user_dict)
        self.assertIn('last_active', user_dict)
        
        # 时间字段应该被转换为ISO格式字符串
        self.assertIsInstance(user_dict['created_at'], str)
        self.assertIsInstance(user_dict['last_active'], str)
    
    def test_base_model_save(self):
        """测试模型保存功能"""
        user = User(username="TestUser")
        
        # 保存前不在数据库中
        self.assertIsNone(User.query.filter_by(username="TestUser").first())
        
        # 保存
        saved_user = user.save()
        
        # 应该返回自身
        self.assertEqual(saved_user, user)
        
        # 现在应该在数据库中
        db_user = User.query.filter_by(username="TestUser").first()
        self.assertIsNotNone(db_user)
        self.assertEqual(db_user.id, user.id)
    
    def test_base_model_get_by_id(self):
        """测试根据ID获取模型"""
        user = User(username="TestUser")
        user.save()
        
        # 根据ID获取
        retrieved_user = User.get_by_id(user.id)
        
        self.assertIsNotNone(retrieved_user)
        self.assertEqual(retrieved_user.id, user.id)
        self.assertEqual(retrieved_user.username, user.username)
        
        # 不存在的ID应该返回None
        non_existent = User.get_by_id("non-existent-id")
        self.assertIsNone(non_existent)
    
    def test_base_model_delete(self):
        """测试模型删除功能"""
        user = User(username="TestUser")
        user.save()
        
        # 确认存在
        self.assertIsNotNone(User.get_by_id(user.id))
        
        # 删除
        user.delete()
        
        # 确认已删除
        self.assertIsNone(User.get_by_id(user.id))


class TestUserModel(unittest.TestCase):
    """用户模型测试类"""
    
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
    
    def tearDown(self):
        """测试后清理"""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def test_user_creation(self):
        """测试用户创建"""
        user = User(username="TestUser")
        
        self.assertEqual(user.username, "TestUser")
        self.assertIsNotNone(user.last_active)
        self.assertIsInstance(user.last_active, datetime)
    
    def test_user_repr(self):
        """测试用户字符串表示"""
        user = User(username="TestUser")
        
        self.assertEqual(repr(user), '<User TestUser>')
    
    def test_update_last_active(self):
        """测试更新最后活跃时间"""
        user = User(username="TestUser")
        user.save()
        
        original_time = user.last_active
        
        # 等待一小段时间
        import time
        time.sleep(0.1)
        
        # 更新活跃时间
        user.update_last_active()
        
        # 时间应该更新
        self.assertGreater(user.last_active, original_time)
    
    def test_get_best_score_no_games(self):
        """测试获取最高得分（无游戏记录）"""
        user = User(username="TestUser")
        user.save()
        
        best_score = user.get_best_score()
        self.assertEqual(best_score, 0)
    
    def test_get_best_score_with_games(self):
        """测试获取最高得分（有游戏记录）"""
        user = User(username="TestUser")
        user.save()
        
        # 创建游戏记录
        scores = [1000, 2500, 1800, 3000, 2200]
        for score in scores:
            game_record = GameRecord(
                user_id=user.id,
                score=score,
                level=5,
                lines_cleared=20,
                game_duration=300
            )
            game_record.save()
        
        best_score = user.get_best_score()
        self.assertEqual(best_score, max(scores))
    
    def test_get_total_games(self):
        """测试获取总游戏次数"""
        user = User(username="TestUser")
        user.save()
        
        # 初始应该为0
        self.assertEqual(user.get_total_games(), 0)
        
        # 创建游戏记录
        for i in range(5):
            game_record = GameRecord(
                user_id=user.id,
                score=1000 + i * 100,
                level=5,
                lines_cleared=20,
                game_duration=300
            )
            game_record.save()
        
        self.assertEqual(user.get_total_games(), 5)
    
    def test_user_game_records_relationship(self):
        """测试用户与游戏记录的关系"""
        user = User(username="TestUser")
        user.save()
        
        # 创建游戏记录
        game_record = GameRecord(
            user_id=user.id,
            score=2000,
            level=8,
            lines_cleared=25,
            game_duration=350
        )
        game_record.save()
        
        # 通过关系访问游戏记录
        self.assertEqual(len(user.game_records), 1)
        self.assertEqual(user.game_records[0].score, 2000)
        
        # 通过游戏记录访问用户
        self.assertEqual(game_record.user.username, "TestUser")


class TestGameRecordModel(unittest.TestCase):
    """游戏记录模型测试类"""
    
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
        
        # 创建测试用户
        self.test_user = User(username="GameTestUser")
        self.test_user.save()
    
    def tearDown(self):
        """测试后清理"""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def test_game_record_creation(self):
        """测试游戏记录创建"""
        game_record = GameRecord(
            user_id=self.test_user.id,
            score=2500,
            level=8,
            lines_cleared=25,
            game_duration=350
        )
        
        self.assertEqual(game_record.user_id, self.test_user.id)
        self.assertEqual(game_record.score, 2500)
        self.assertEqual(game_record.level, 8)
        self.assertEqual(game_record.lines_cleared, 25)
        self.assertEqual(game_record.game_duration, 350)
    
    def test_game_record_repr(self):
        """测试游戏记录字符串表示"""
        game_record = GameRecord(
            user_id=self.test_user.id,
            score=2500,
            level=8,
            lines_cleared=25,
            game_duration=350
        )
        
        expected_repr = f'<GameRecord 2500 points by user {self.test_user.id}>'
        self.assertEqual(repr(game_record), expected_repr)
    
    def test_get_leaderboard_empty(self):
        """测试获取空排行榜"""
        leaderboard = GameRecord.get_leaderboard()
        self.assertEqual(len(leaderboard), 0)
    
    def test_get_leaderboard_with_data(self):
        """测试获取有数据的排行榜"""
        # 创建多个游戏记录
        scores = [3000, 1500, 2500, 1000, 2000]
        for score in scores:
            game_record = GameRecord(
                user_id=self.test_user.id,
                score=score,
                level=5,
                lines_cleared=20,
                game_duration=300
            )
            game_record.save()
        
        leaderboard = GameRecord.get_leaderboard()
        
        # 应该按得分降序排列
        self.assertEqual(len(leaderboard), 5)
        self.assertEqual(leaderboard[0].score, 3000)
        self.assertEqual(leaderboard[1].score, 2500)
        self.assertEqual(leaderboard[2].score, 2000)
        self.assertEqual(leaderboard[3].score, 1500)
        self.assertEqual(leaderboard[4].score, 1000)
    
    def test_get_leaderboard_with_limit(self):
        """测试获取限制数量的排行榜"""
        # 创建多个游戏记录
        for i in range(15):
            game_record = GameRecord(
                user_id=self.test_user.id,
                score=1000 + i * 100,
                level=5,
                lines_cleared=20,
                game_duration=300
            )
            game_record.save()
        
        leaderboard = GameRecord.get_leaderboard(limit=5)
        
        # 应该只返回5条记录
        self.assertEqual(len(leaderboard), 5)
        
        # 应该是最高的5个得分
        expected_scores = [2400, 2300, 2200, 2100, 2000]
        actual_scores = [record.score for record in leaderboard]
        self.assertEqual(actual_scores, expected_scores)
    
    def test_get_user_rank_no_records(self):
        """测试获取用户排名（无记录）"""
        rank = GameRecord.get_user_rank(self.test_user.id)
        self.assertIsNone(rank)
    
    def test_get_user_rank_with_records(self):
        """测试获取用户排名（有记录）"""
        # 创建用户的游戏记录
        user_scores = [1000, 2500, 1800]  # 最高分2500
        for score in user_scores:
            game_record = GameRecord(
                user_id=self.test_user.id,
                score=score,
                level=5,
                lines_cleared=20,
                game_duration=300
            )
            game_record.save()
        
        # 创建其他用户的更高得分
        other_user = User(username="OtherUser")
        other_user.save()
        
        higher_scores = [3000, 2800, 2600]  # 3个更高的得分
        for score in higher_scores:
            game_record = GameRecord(
                user_id=other_user.id,
                score=score,
                level=5,
                lines_cleared=20,
                game_duration=300
            )
            game_record.save()
        
        rank = GameRecord.get_user_rank(self.test_user.id)
        
        # 用户应该排第4（3个更高得分 + 1）
        self.assertEqual(rank, 4)
    
    def test_foreign_key_constraint(self):
        """测试外键约束"""
        # 创建游戏记录
        game_record = GameRecord(
            user_id=self.test_user.id,
            score=2000,
            level=6,
            lines_cleared=22,
            game_duration=320
        )
        game_record.save()
        
        # 通过外键访问用户
        self.assertEqual(game_record.user.username, "GameTestUser")
        
        # 删除用户应该级联删除游戏记录
        self.test_user.delete()
        
        # 游戏记录应该被删除
        remaining_records = GameRecord.query.all()
        self.assertEqual(len(remaining_records), 0)


if __name__ == '__main__':
    unittest.main()