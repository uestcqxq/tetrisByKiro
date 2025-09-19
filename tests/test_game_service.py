"""
游戏服务单元测试
测试游戏数据管理相关的所有功能
"""

import unittest
from datetime import datetime, timezone, timedelta
from flask import Flask
from models.base import db
from models.user import User
from models.game_record import GameRecord
from services.game_service import GameService
from services.user_service import UserService
from services.base_service import ValidationError, DatabaseError


class TestGameService(unittest.TestCase):
    """游戏服务测试类"""
    
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
        self.game_service = GameService()
        self.user_service = UserService()
        
        # 创建测试用户
        self.test_user1 = self.user_service.create_user("TestPlayer1")
        self.test_user2 = self.user_service.create_user("TestPlayer2")
        self.test_user3 = self.user_service.create_user("TestPlayer3")
    
    def tearDown(self):
        """测试后清理"""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def test_validate_game_data(self):
        """测试游戏数据验证"""
        # 有效数据
        valid_data = [
            (1000, 5, 20, 300),
            (0, 1, 0, 1),
            (999999, 99, 500, 7200)
        ]
        
        for score, level, lines, duration in valid_data:
            try:
                self.game_service._validate_game_data(score, level, lines, duration)
            except ValueError:
                self.fail(f"有效数据被错误拒绝: {score}, {level}, {lines}, {duration}")
        
        # 无效数据
        invalid_data = [
            (-1, 5, 20, 300),      # 负分数
            (1000, 0, 20, 300),    # 级别太低
            (1000, 100, 20, 300),  # 级别太高
            (1000, 5, -1, 300),    # 负消除行数
            (1000, 5, 20, 0),      # 游戏时长太短
            (1000, 5, 20, 10000),  # 游戏时长太长
            (1000, 5, 0, 300),     # 有得分但没消除行数
            (1000, 15, 5, 300),    # 级别与消除行数不匹配（高级别但消除行数过少）
        ]
        
        for score, level, lines, duration in invalid_data:
            with self.assertRaises(ValidationError):
                self.game_service._validate_game_data(score, level, lines, duration)
    
    def test_save_game_score_valid(self):
        """测试保存有效游戏得分"""
        score = 15000
        level = 8
        lines_cleared = 25
        game_duration = 300
        
        record = self.game_service.save_game_score(
            self.test_user1.id, score, level, lines_cleared, game_duration
        )
        
        self.assertIsNotNone(record)
        self.assertEqual(record.user_id, self.test_user1.id)
        self.assertEqual(record.score, score)
        self.assertEqual(record.level, level)
        self.assertEqual(record.lines_cleared, lines_cleared)
        self.assertEqual(record.game_duration, game_duration)
        
        # 验证记录已保存到数据库
        saved_record = GameRecord.get_by_id(record.id)
        self.assertIsNotNone(saved_record)
        self.assertEqual(saved_record.score, score)
    
    def test_save_game_score_invalid_user(self):
        """测试保存游戏得分时用户不存在"""
        with self.assertRaises(ValidationError) as context:
            self.game_service.save_game_score(
                "non-existent-user", 1000, 5, 10, 300
            )
        
        self.assertIn("不存在", str(context.exception))
    
    def test_save_game_score_invalid_data(self):
        """测试保存无效游戏数据"""
        invalid_data_sets = [
            (-100, 5, 10, 300),    # 负分数
            (1000, 0, 10, 300),    # 无效级别
            (1000, 5, -5, 300),    # 负消除行数
            (1000, 5, 10, -10),    # 负游戏时长
        ]
        
        for score, level, lines, duration in invalid_data_sets:
            with self.assertRaises(ValidationError):
                self.game_service.save_game_score(
                    self.test_user1.id, score, level, lines, duration
                )
    
    def test_get_user_best_score(self):
        """测试获取用户最高得分"""
        # 为用户创建多个游戏记录
        scores = [1000, 2500, 1800, 3000, 2200]
        for score in scores:
            self.game_service.save_game_score(
                self.test_user1.id, score, 5, 20, 300
            )
        
        best_score = self.game_service.get_user_best_score(self.test_user1.id)
        self.assertEqual(best_score, max(scores))
        
        # 测试没有游戏记录的用户
        no_games_score = self.game_service.get_user_best_score(self.test_user2.id)
        self.assertEqual(no_games_score, 0)
        
        # 测试不存在的用户
        non_existent_score = self.game_service.get_user_best_score("non-existent")
        self.assertEqual(non_existent_score, 0)
    
    def test_get_user_game_history(self):
        """测试获取用户游戏历史"""
        # 创建多个游戏记录
        scores = [1000, 1500, 2000, 2500, 3000]
        records = []
        
        for score in scores:
            record = self.game_service.save_game_score(
                self.test_user1.id, score, 5, 20, 300
            )
            records.append(record)
        
        # 获取游戏历史
        history = self.game_service.get_user_game_history(self.test_user1.id, limit=3)
        
        self.assertEqual(len(history), 3)
        
        # 验证按时间倒序排列
        for i in range(len(history) - 1):
            self.assertGreaterEqual(
                history[i].created_at,
                history[i + 1].created_at
            )
        
        # 测试分页
        history_page2 = self.game_service.get_user_game_history(
            self.test_user1.id, limit=2, offset=2
        )
        self.assertEqual(len(history_page2), 2)
        
        # 测试没有游戏记录的用户
        empty_history = self.game_service.get_user_game_history(self.test_user2.id)
        self.assertEqual(len(empty_history), 0)
    
    def test_get_leaderboard(self):
        """测试获取排行榜"""
        # 为不同用户创建游戏记录
        user_scores = [
            (self.test_user1.id, [1000, 2000, 1500]),  # 最高分: 2000
            (self.test_user2.id, [3000, 2500, 2800]),  # 最高分: 3000
            (self.test_user3.id, [1800, 1600, 1900]),  # 最高分: 1900
        ]
        
        for user_id, scores in user_scores:
            for score in scores:
                self.game_service.save_game_score(user_id, score, 5, 20, 300)
        
        # 获取排行榜
        leaderboard = self.game_service.get_leaderboard(limit=3)
        
        self.assertEqual(len(leaderboard), 3)
        
        # 验证排序正确（按得分降序）
        expected_order = [3000, 2000, 1900]
        for i, entry in enumerate(leaderboard):
            self.assertEqual(entry['score'], expected_order[i])
            self.assertEqual(entry['rank'], i + 1)
            self.assertIn('username', entry)
            self.assertIn('user_id', entry)
            self.assertIn('level', entry)
            self.assertIn('lines_cleared', entry)
            self.assertIn('game_duration', entry)
            self.assertIn('achieved_at', entry)
        
        # 测试分页
        leaderboard_page2 = self.game_service.get_leaderboard(limit=2, offset=1)
        self.assertEqual(len(leaderboard_page2), 2)
        self.assertEqual(leaderboard_page2[0]['rank'], 2)
    
    def test_get_user_rank(self):
        """测试获取用户排名"""
        # 创建测试数据
        user_scores = [
            (self.test_user1.id, 3000),  # 排名: 1
            (self.test_user2.id, 2000),  # 排名: 2
            (self.test_user3.id, 1000),  # 排名: 3
        ]
        
        for user_id, score in user_scores:
            self.game_service.save_game_score(user_id, score, 5, 20, 300)
        
        # 测试各用户排名
        rank1 = self.game_service.get_user_rank(self.test_user1.id)
        self.assertIsNotNone(rank1)
        self.assertEqual(rank1['rank'], 1)
        self.assertEqual(rank1['best_score'], 3000)
        self.assertEqual(rank1['total_users'], 3)
        self.assertIn('percentile', rank1)
        
        rank2 = self.game_service.get_user_rank(self.test_user2.id)
        self.assertEqual(rank2['rank'], 2)
        self.assertEqual(rank2['best_score'], 2000)
        
        rank3 = self.game_service.get_user_rank(self.test_user3.id)
        self.assertEqual(rank3['rank'], 3)
        self.assertEqual(rank3['best_score'], 1000)
        
        # 测试没有游戏记录的用户
        new_user = self.user_service.create_user("NoGamesUser")
        no_rank = self.game_service.get_user_rank(new_user.id)
        self.assertIsNone(no_rank)
    
    def test_get_user_statistics(self):
        """测试获取用户统计信息"""
        # 创建多个游戏记录
        game_data = [
            (1000, 3, 10, 180),
            (1500, 4, 15, 240),
            (2000, 5, 20, 300),
            (1200, 3, 12, 200),
            (1800, 4, 18, 280),
        ]
        
        for score, level, lines, duration in game_data:
            self.game_service.save_game_score(
                self.test_user1.id, score, level, lines, duration
            )
        
        stats = self.game_service.get_user_statistics(self.test_user1.id)
        
        self.assertIsInstance(stats, dict)
        self.assertEqual(stats['user_id'], self.test_user1.id)
        self.assertEqual(stats['total_games'], 5)
        self.assertEqual(stats['best_score'], 2000)
        self.assertEqual(stats['total_lines_cleared'], sum(data[2] for data in game_data))
        self.assertEqual(stats['total_play_time'], sum(data[3] for data in game_data))
        self.assertEqual(stats['max_level_reached'], 5)
        self.assertIn('average_score', stats)
        self.assertIn('average_game_duration', stats)
        self.assertIn('games_this_week', stats)
        self.assertIn('improvement_trend', stats)
        
        # 测试没有游戏记录的用户
        empty_stats = self.game_service.get_user_statistics(self.test_user2.id)
        self.assertEqual(empty_stats['total_games'], 0)
        self.assertEqual(empty_stats['best_score'], 0)
    
    def test_get_global_statistics(self):
        """测试获取全局统计信息"""
        # 创建多个用户的游戏记录
        users_data = [
            (self.test_user1.id, [(1000, 3, 10, 180), (1500, 4, 15, 240)]),
            (self.test_user2.id, [(2000, 5, 20, 300), (1200, 3, 12, 200)]),
            (self.test_user3.id, [(1800, 4, 18, 280)]),
        ]
        
        total_games = 0
        total_lines = 0
        total_time = 0
        highest_score = 0
        
        for user_id, games in users_data:
            for score, level, lines, duration in games:
                self.game_service.save_game_score(user_id, score, level, lines, duration)
                total_games += 1
                total_lines += lines
                total_time += duration
                highest_score = max(highest_score, score)
        
        global_stats = self.game_service.get_global_statistics()
        
        self.assertIsInstance(global_stats, dict)
        self.assertEqual(global_stats['total_games'], total_games)
        self.assertEqual(global_stats['total_players'], 3)
        self.assertEqual(global_stats['highest_score'], highest_score)
        self.assertEqual(global_stats['total_lines_cleared'], total_lines)
        self.assertIn('average_score', global_stats)
        self.assertIn('total_play_time_hours', global_stats)
        self.assertIn('games_today', global_stats)
        self.assertIn('active_players_today', global_stats)
        self.assertIn('games_this_week', global_stats)
        self.assertIn('active_players_this_week', global_stats)
    
    def test_get_level_distribution(self):
        """测试获取级别分布"""
        # 创建不同级别的游戏记录
        level_data = [
            (1000, 1), (1200, 1), (1500, 2), (1800, 2), (2000, 3),
            (2200, 3), (2500, 3), (2800, 4), (3000, 5)
        ]
        
        for score, level in level_data:
            self.game_service.save_game_score(
                self.test_user1.id, score, level, level * 10, 300
            )
        
        distribution = self.game_service.get_level_distribution()
        
        self.assertIsInstance(distribution, dict)
        self.assertEqual(distribution[1], 2)  # 级别1有2个记录
        self.assertEqual(distribution[2], 2)  # 级别2有2个记录
        self.assertEqual(distribution[3], 3)  # 级别3有3个记录
        self.assertEqual(distribution[4], 1)  # 级别4有1个记录
        self.assertEqual(distribution[5], 1)  # 级别5有1个记录
    
    def test_delete_user_games(self):
        """测试删除用户游戏记录"""
        # 为用户创建游戏记录
        for i in range(3):
            self.game_service.save_game_score(
                self.test_user1.id, 1000 + i * 100, 3, 10, 300
            )
        
        # 验证记录存在
        history_before = self.game_service.get_user_game_history(self.test_user1.id)
        self.assertEqual(len(history_before), 3)
        
        # 删除用户游戏记录
        result = self.game_service.delete_user_games(self.test_user1.id)
        self.assertTrue(result)
        
        # 验证记录已删除
        history_after = self.game_service.get_user_game_history(self.test_user1.id)
        self.assertEqual(len(history_after), 0)
        
        # 验证用户最高得分为0
        best_score = self.game_service.get_user_best_score(self.test_user1.id)
        self.assertEqual(best_score, 0)


if __name__ == '__main__':
    unittest.main()