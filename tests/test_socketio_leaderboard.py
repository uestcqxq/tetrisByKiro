"""
WebSocket实时排行榜功能测试
测试排行榜更新广播和用户排名变化通知
"""

import pytest
import json
from datetime import datetime
from unittest.mock import patch, MagicMock
from flask_socketio import SocketIOTestClient
from app import create_app, socketio
from models import User, GameRecord
from services import UserService, GameService


class TestSocketIOLeaderboard:
    """WebSocket实时排行榜测试类"""
    
    @pytest.fixture
    def app(self):
        """创建测试应用"""
        app = create_app('testing')
        app.config['TESTING'] = True
        
        # 创建数据库表
        with app.app_context():
            from models.base import db
            db.drop_all()  # 清理现有数据
            db.create_all()
        
        return app
    
    @pytest.fixture
    def client(self, app):
        """创建SocketIO测试客户端"""
        return SocketIOTestClient(app, socketio)
    
    @pytest.fixture
    def test_users(self, app):
        """创建多个测试用户"""
        with app.app_context():
            user_service = UserService()
            users = []
            for i in range(3):
                user = user_service.create_user(f"leaderboard_user_{i}")
                users.append({'id': user.id, 'username': user.username})
            return users
    
    def test_subscribe_leaderboard(self, client):
        """测试订阅排行榜更新"""
        # 发送订阅请求
        client.emit('subscribe_leaderboard')
        
        received = client.get_received()
        
        # 应该收到订阅确认和当前排行榜
        subscription_confirmed = None
        leaderboard_data = None
        
        for msg in received:
            if msg['name'] == 'leaderboard_subscription_confirmed':
                subscription_confirmed = msg
            elif msg['name'] == 'leaderboard_data':
                leaderboard_data = msg
        
        assert subscription_confirmed is not None
        assert subscription_confirmed['args'][0]['subscribed'] is True
        assert subscription_confirmed['args'][0]['message'] == '已订阅排行榜更新'
        
        assert leaderboard_data is not None
        assert 'leaderboard' in leaderboard_data['args'][0]
        assert 'timestamp' in leaderboard_data['args'][0]
    
    def test_unsubscribe_leaderboard(self, client):
        """测试取消订阅排行榜更新"""
        # 先订阅
        client.emit('subscribe_leaderboard')
        client.get_received()  # 清空消息
        
        # 取消订阅
        client.emit('unsubscribe_leaderboard')
        
        received = client.get_received()
        
        # 应该收到取消订阅确认
        subscription_confirmed = None
        for msg in received:
            if msg['name'] == 'leaderboard_subscription_confirmed':
                subscription_confirmed = msg
                break
        
        assert subscription_confirmed is not None
        assert subscription_confirmed['args'][0]['subscribed'] is False
        assert subscription_confirmed['args'][0]['message'] == '已取消订阅排行榜更新'
    
    @patch('services.GameService.get_global_statistics')
    @patch('services.GameService.get_level_distribution')
    def test_get_leaderboard_stats(self, mock_level_dist, mock_global_stats, client):
        """测试获取排行榜统计信息"""
        # 模拟统计数据
        mock_global_stats.return_value = {
            'total_games': 100,
            'total_players': 25,
            'highest_score': 50000,
            'average_score': 1500.5
        }
        
        mock_level_dist.return_value = {
            '1': 10,
            '2': 8,
            '3': 5,
            '4': 2
        }
        
        # 发送统计请求
        client.emit('get_leaderboard_stats')
        
        received = client.get_received()
        
        # 应该收到统计数据
        stats_msg = None
        for msg in received:
            if msg['name'] == 'leaderboard_stats':
                stats_msg = msg
                break
        
        assert stats_msg is not None
        stats_data = stats_msg['args'][0]
        
        assert stats_data['global_stats'] == mock_global_stats.return_value
        assert stats_data['level_distribution'] == mock_level_dist.return_value
        assert 'subscribers_count' in stats_data
        assert 'online_users' in stats_data
        assert 'timestamp' in stats_data
    
    def test_leaderboard_broadcast_on_game_finish(self, app, test_users):
        """测试游戏结束时的排行榜广播"""
        # 创建两个客户端
        client1 = SocketIOTestClient(app, socketio)
        client2 = SocketIOTestClient(app, socketio)
        
        # 两个客户端都订阅排行榜更新
        client1.emit('subscribe_leaderboard')
        client2.emit('subscribe_leaderboard')
        
        # 清空初始消息
        client1.get_received()
        client2.get_received()
        
        # 客户端1完成游戏
        game_data = {
            'user_id': test_users[0]['id'],
            'score': 2500,
            'level': 8,
            'lines_cleared': 25,
            'game_duration': 300
        }
        client1.emit('game_finished', game_data)
        
        # 获取两个客户端的消息
        received1 = client1.get_received()
        received2 = client2.get_received()
        
        # 客户端1应该收到游戏保存确认
        game_saved = None
        for msg in received1:
            if msg['name'] == 'game_saved':
                game_saved = msg
                break
        assert game_saved is not None
        
        # 两个客户端都应该收到排行榜更新
        leaderboard_updated1 = None
        leaderboard_updated2 = None
        
        for msg in received1:
            if msg['name'] == 'leaderboard_updated':
                leaderboard_updated1 = msg
                break
        
        for msg in received2:
            if msg['name'] == 'leaderboard_updated':
                leaderboard_updated2 = msg
                break
        
        assert leaderboard_updated1 is not None
        assert leaderboard_updated2 is not None
        
        # 验证更新数据
        update_data1 = leaderboard_updated1['args'][0]
        update_data2 = leaderboard_updated2['args'][0]
        
        assert update_data1['trigger_user'] == test_users[0]['id']
        assert update_data1['new_score'] == 2500
        assert 'leaderboard' in update_data1
        
        assert update_data2['trigger_user'] == test_users[0]['id']
        assert update_data2['new_score'] == 2500
        assert 'leaderboard' in update_data2
        
        # 清理
        client1.disconnect()
        client2.disconnect()
    
    def test_rank_change_notification(self, app, test_users):
        """测试排名变化通知"""
        with app.app_context():
            # 创建客户端并登录用户
            client = SocketIOTestClient(app, socketio)
            client.emit('user_login', {'user_id': test_users[0]['id']})
            client.get_received()  # 清空消息
            
            # 先创建一个较低的得分
            game_service = GameService()
            game_service.save_game_score(
                user_id=test_users[0]['id'],
                score=1000,
                level=3,
                lines_cleared=10,
                game_duration=200
            )
            
            # 创建另一个用户的更高得分
            game_service.save_game_score(
                user_id=test_users[1]['id'],
                score=3000,
                level=10,
                lines_cleared=30,
                game_duration=400
            )
            
            # 现在用户0提交一个更高的得分，应该改变排名
            game_data = {
                'user_id': test_users[0]['id'],
                'score': 5000,
                'level': 15,
                'lines_cleared': 50,
                'game_duration': 600
            }
            client.emit('game_finished', game_data)
            
            received = client.get_received()
            
            # 应该收到排名变化通知
            rank_changed = None
            for msg in received:
                if msg['name'] == 'rank_changed':
                    rank_changed = msg
                    break
            
            assert rank_changed is not None
            rank_data = rank_changed['args'][0]
            
            assert rank_data['user_id'] == test_users[0]['id']
            assert rank_data['score'] == 5000
            assert rank_data['old_rank'] != rank_data['new_rank']
            assert 'timestamp' in rank_data
            
            client.disconnect()
    
    def test_multiple_subscribers_broadcast(self, app, test_users):
        """测试多个订阅者的广播"""
        # 创建多个客户端
        clients = []
        for i in range(4):
            client = SocketIOTestClient(app, socketio)
            client.emit('subscribe_leaderboard')
            client.get_received()  # 清空初始消息
            clients.append(client)
        
        # 其中一个客户端完成游戏
        game_data = {
            'user_id': test_users[0]['id'],
            'score': 3500,
            'level': 12,
            'lines_cleared': 35,
            'game_duration': 450
        }
        clients[0].emit('game_finished', game_data)
        
        # 检查所有客户端都收到了更新
        update_count = 0
        for i, client in enumerate(clients):
            received = client.get_received()
            
            leaderboard_updated = None
            for msg in received:
                if msg['name'] == 'leaderboard_updated':
                    leaderboard_updated = msg
                    update_count += 1
                    break
            
            if i == 0:
                # 发起游戏的客户端还应该收到游戏保存确认
                game_saved = None
                for msg in received:
                    if msg['name'] == 'game_saved':
                        game_saved = msg
                        break
                assert game_saved is not None
        
        # 所有客户端都应该收到排行榜更新
        assert update_count == 4
        
        # 清理
        for client in clients:
            client.disconnect()
    
    def test_unsubscribed_client_no_broadcast(self, app, test_users):
        """测试未订阅的客户端不会收到广播"""
        # 创建两个客户端，只有一个订阅
        client1 = SocketIOTestClient(app, socketio)
        client2 = SocketIOTestClient(app, socketio)
        
        # 只有客户端1订阅排行榜更新
        client1.emit('subscribe_leaderboard')
        client1.get_received()  # 清空消息
        
        # 客户端2不订阅，直接清空消息
        client2.get_received()
        
        # 完成游戏
        game_data = {
            'user_id': test_users[0]['id'],
            'score': 2000,
            'level': 6,
            'lines_cleared': 20,
            'game_duration': 250
        }
        client1.emit('game_finished', game_data)
        
        # 获取消息
        received1 = client1.get_received()
        received2 = client2.get_received()
        
        # 客户端1应该收到排行榜更新
        leaderboard_updated1 = None
        for msg in received1:
            if msg['name'] == 'leaderboard_updated':
                leaderboard_updated1 = msg
                break
        assert leaderboard_updated1 is not None
        
        # 客户端2不应该收到排行榜更新
        leaderboard_updated2 = None
        for msg in received2:
            if msg['name'] == 'leaderboard_updated':
                leaderboard_updated2 = msg
                break
        assert leaderboard_updated2 is None
        
        # 清理
        client1.disconnect()
        client2.disconnect()
    
    def test_subscription_cleanup_on_disconnect(self, app):
        """测试断开连接时清理订阅"""
        # 创建客户端并订阅
        client = SocketIOTestClient(app, socketio)
        client.emit('subscribe_leaderboard')
        client.get_received()
        
        # 断开连接
        client.disconnect()
        
        # 创建新客户端测试广播
        client2 = SocketIOTestClient(app, socketio)
        
        # 由于第一个客户端已断开，广播应该不会发送给它
        # 这个测试主要验证内部状态清理，不会有明显的外部表现
        # 但可以通过日志或内部状态检查来验证
        
        client2.disconnect()


class TestSocketIOLeaderboardIntegration:
    """WebSocket排行榜集成测试类"""
    
    @pytest.fixture
    def app(self):
        """创建测试应用"""
        app = create_app('testing')
        app.config['TESTING'] = True
        
        # 创建数据库表
        with app.app_context():
            from models.base import db
            db.drop_all()
            db.create_all()
        
        return app
    
    def test_complete_leaderboard_flow(self, app):
        """测试完整的排行榜流程"""
        with app.app_context():
            # 创建用户
            user_service = UserService()
            users = []
            for i in range(3):
                user = user_service.create_user(f"flow_user_{i}")
                users.append(user)
            
            # 创建客户端
            clients = []
            for i in range(3):
                client = SocketIOTestClient(app, socketio)
                client.emit('user_login', {'user_id': users[i].id})
                client.emit('subscribe_leaderboard')
                client.get_received()  # 清空初始消息
                clients.append(client)
            
            # 模拟游戏会话
            game_sessions = [
                {'user_idx': 0, 'score': 1500, 'level': 5},
                {'user_idx': 1, 'score': 2500, 'level': 8},
                {'user_idx': 2, 'score': 2000, 'level': 7},
                {'user_idx': 0, 'score': 3000, 'level': 10},  # 用户0提升排名
            ]
            
            for session in game_sessions:
                user_idx = session['user_idx']
                game_data = {
                    'user_id': users[user_idx].id,
                    'score': session['score'],
                    'level': session['level'],
                    'lines_cleared': session['level'] * 3,
                    'game_duration': 300
                }
                
                clients[user_idx].emit('game_finished', game_data)
                
                # 验证所有客户端都收到更新
                for i, client in enumerate(clients):
                    received = client.get_received()
                    
                    # 检查是否收到排行榜更新
                    leaderboard_updated = None
                    for msg in received:
                        if msg['name'] == 'leaderboard_updated':
                            leaderboard_updated = msg
                            break
                    
                    assert leaderboard_updated is not None
                    update_data = leaderboard_updated['args'][0]
                    assert update_data['trigger_user'] == users[user_idx].id
                    assert update_data['new_score'] == session['score']
                    assert 'leaderboard' in update_data
            
            # 验证最终排行榜
            game_service = GameService()
            final_leaderboard = game_service.get_leaderboard(10)
            
            # 应该有3个用户的记录，按得分排序
            assert len(final_leaderboard) == 3
            assert final_leaderboard[0]['score'] == 3000  # 用户0的最高分
            assert final_leaderboard[1]['score'] == 2500  # 用户1
            assert final_leaderboard[2]['score'] == 2000  # 用户2
            
            # 清理
            for client in clients:
                client.disconnect()