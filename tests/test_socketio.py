"""
WebSocket (SocketIO) 功能测试
测试WebSocket连接管理和事件处理
"""

import pytest
import json
from datetime import datetime
from unittest.mock import patch, MagicMock
from flask_socketio import SocketIOTestClient
from app import create_app, socketio
from models import User, GameRecord
from services import UserService, GameService


class TestSocketIOEvents:
    """WebSocket事件测试类"""
    
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
    def test_user(self, app):
        """创建测试用户"""
        with app.app_context():
            user_service = UserService()
            user = user_service.create_user("test_user_socketio")
            # 返回用户ID而不是用户对象，避免会话问题
            return {'id': user.id, 'username': user.username}
    
    def test_client_connect(self, client):
        """测试客户端连接"""
        # 测试连接
        received = client.get_received()
        
        # 应该收到连接确认和在线用户数
        assert len(received) >= 2
        
        # 检查连接确认消息
        connection_confirmed = None
        online_count = None
        
        for msg in received:
            if msg['name'] == 'connection_confirmed':
                connection_confirmed = msg
            elif msg['name'] == 'online_users_count':
                online_count = msg
        
        assert connection_confirmed is not None
        assert 'sid' in connection_confirmed['args'][0]
        assert 'server_time' in connection_confirmed['args'][0]
        assert connection_confirmed['args'][0]['message'] == '连接成功'
        
        assert online_count is not None
        assert online_count['args'][0]['count'] >= 1
    
    def test_client_connect_with_auth(self, client, test_user):
        """测试带认证信息的客户端连接"""
        # 断开当前连接
        client.disconnect()
        
        # 使用认证信息重新连接
        client.connect(auth={'user_id': test_user['id']})
        
        received = client.get_received()
        
        # 检查连接确认消息
        connection_confirmed = None
        for msg in received:
            if msg['name'] == 'connection_confirmed':
                connection_confirmed = msg
                break
        
        assert connection_confirmed is not None
        assert connection_confirmed['args'][0]['message'] == '连接成功'
    
    def test_client_disconnect(self, client):
        """测试客户端断开连接"""
        # 连接后断开
        client.disconnect()
        
        # 重新连接以检查在线用户数是否正确更新
        client.connect()
        received = client.get_received()
        
        # 应该收到在线用户数更新
        online_count = None
        for msg in received:
            if msg['name'] == 'online_users_count':
                online_count = msg
                break
        
        assert online_count is not None
        assert online_count['args'][0]['count'] >= 1
    
    def test_user_login_event(self, client, test_user):
        """测试用户登录事件"""
        # 发送用户登录事件
        client.emit('user_login', {'user_id': test_user['id']})
        
        received = client.get_received()
        
        # 应该收到登录确认
        login_confirmed = None
        for msg in received:
            if msg['name'] == 'login_confirmed':
                login_confirmed = msg
                break
        
        assert login_confirmed is not None
        assert login_confirmed['args'][0]['user_id'] == test_user['id']
        assert login_confirmed['args'][0]['message'] == '登录成功'
    
    def test_user_login_event_invalid(self, client):
        """测试无效用户登录事件"""
        # 发送无效的用户登录事件
        client.emit('user_login', {})
        
        received = client.get_received()
        
        # 应该收到错误消息
        error_msg = None
        for msg in received:
            if msg['name'] == 'error':
                error_msg = msg
                break
        
        assert error_msg is not None
        assert error_msg['args'][0]['message'] == '用户ID不能为空'
    
    def test_game_started_event(self, client, test_user):
        """测试游戏开始事件"""
        # 发送游戏开始事件
        client.emit('game_started', {'user_id': test_user['id']})
        
        # 这个事件主要是记录日志，不返回特定消息
        # 但应该不会产生错误
        received = client.get_received()
        
        # 检查是否有错误消息
        error_msg = None
        for msg in received:
            if msg['name'] == 'error':
                error_msg = msg
                break
        
        assert error_msg is None
    
    @patch('services.GameService.save_game_score')
    @patch('services.GameService.get_user_rank')
    def test_game_finished_event_success(self, mock_get_rank, mock_save_score, client, test_user):
        """测试游戏结束事件（成功保存）"""
        # 先订阅排行榜更新以接收广播
        client.emit('subscribe_leaderboard')
        client.get_received()  # 清空订阅消息
        
        # 模拟保存游戏得分
        mock_game_record = MagicMock()
        mock_game_record.id = 'test_game_id'
        mock_save_score.return_value = mock_game_record
        
        # 模拟用户排名信息
        mock_rank_info = {
            'user_id': test_user['id'],
            'rank': 1,
            'total_users': 10,
            'best_score': 1000
        }
        mock_get_rank.return_value = mock_rank_info
        
        # 发送游戏结束事件
        game_data = {
            'user_id': test_user['id'],
            'score': 1000,
            'level': 5,
            'lines_cleared': 20,
            'game_duration': 300
        }
        client.emit('game_finished', game_data)
        
        received = client.get_received()
        
        # 应该收到游戏保存确认和排行榜更新通知
        game_saved = None
        leaderboard_updated = None
        
        for msg in received:
            if msg['name'] == 'game_saved':
                game_saved = msg
            elif msg['name'] == 'leaderboard_updated':
                leaderboard_updated = msg
        
        assert game_saved is not None
        assert game_saved['args'][0]['game_id'] == 'test_game_id'
        assert game_saved['args'][0]['score'] == 1000
        assert game_saved['args'][0]['rank_info'] == mock_rank_info
        
        assert leaderboard_updated is not None
        assert leaderboard_updated['args'][0]['trigger_user'] == test_user['id']
        assert leaderboard_updated['args'][0]['new_score'] == 1000
        
        # 验证服务方法被调用（现在会调用两次get_user_rank - 保存前后各一次）
        mock_save_score.assert_called_once_with(
            user_id=test_user['id'],
            score=1000,
            level=5,
            lines_cleared=20,
            game_duration=300
        )
        assert mock_get_rank.call_count == 2  # 保存前后各调用一次
    
    @patch('services.GameService.save_game_score')
    def test_game_finished_event_save_error(self, mock_save_score, client, test_user):
        """测试游戏结束事件（保存失败）"""
        # 模拟保存失败
        mock_save_score.side_effect = Exception("数据库错误")
        
        # 发送游戏结束事件
        game_data = {
            'user_id': test_user['id'],
            'score': 1000,
            'level': 5,
            'lines_cleared': 20,
            'game_duration': 300
        }
        client.emit('game_finished', game_data)
        
        received = client.get_received()
        
        # 应该收到错误消息
        error_msg = None
        for msg in received:
            if msg['name'] == 'error':
                error_msg = msg
                break
        
        assert error_msg is not None
        assert '保存游戏得分失败' in error_msg['args'][0]['message']
    
    def test_game_finished_event_no_score(self, client, test_user):
        """测试游戏结束事件（无得分数据）"""
        # 发送没有得分的游戏结束事件
        game_data = {
            'user_id': test_user['id'],
            'score': 0
        }
        client.emit('game_finished', game_data)
        
        received = client.get_received()
        
        # 不应该有保存确认或错误消息
        game_saved = None
        error_msg = None
        
        for msg in received:
            if msg['name'] == 'game_saved':
                game_saved = msg
            elif msg['name'] == 'error':
                error_msg = msg
        
        assert game_saved is None
        assert error_msg is None
    
    @patch('services.GameService.get_leaderboard')
    def test_request_leaderboard_event(self, mock_get_leaderboard, client):
        """测试请求排行榜事件"""
        # 模拟排行榜数据
        mock_leaderboard = [
            {
                'rank': 1,
                'user_id': 'user1',
                'username': 'player1',
                'score': 2000
            },
            {
                'rank': 2,
                'user_id': 'user2',
                'username': 'player2',
                'score': 1500
            }
        ]
        mock_get_leaderboard.return_value = mock_leaderboard
        
        # 发送请求排行榜事件
        client.emit('request_leaderboard')
        
        received = client.get_received()
        
        # 应该收到排行榜数据
        leaderboard_data = None
        for msg in received:
            if msg['name'] == 'leaderboard_data':
                leaderboard_data = msg
                break
        
        assert leaderboard_data is not None
        assert leaderboard_data['args'][0]['leaderboard'] == mock_leaderboard
        assert leaderboard_data['args'][0]['total_records'] == 2
        assert 'timestamp' in leaderboard_data['args'][0]
        
        # 验证服务方法被调用
        mock_get_leaderboard.assert_called_once_with(10)
    
    @patch('services.GameService.get_leaderboard')
    def test_request_leaderboard_with_limit(self, mock_get_leaderboard, client):
        """测试带限制的请求排行榜事件"""
        mock_get_leaderboard.return_value = []
        
        # 发送带限制的请求排行榜事件
        client.emit('request_leaderboard', {'limit': 5})
        
        received = client.get_received()
        
        # 应该收到排行榜数据
        leaderboard_data = None
        for msg in received:
            if msg['name'] == 'leaderboard_data':
                leaderboard_data = msg
                break
        
        assert leaderboard_data is not None
        
        # 验证服务方法被调用时使用了正确的限制
        mock_get_leaderboard.assert_called_once_with(5)
    
    @patch('services.GameService.get_leaderboard')
    def test_request_leaderboard_error(self, mock_get_leaderboard, client):
        """测试请求排行榜事件（服务错误）"""
        # 模拟服务错误
        mock_get_leaderboard.side_effect = Exception("数据库连接失败")
        
        # 发送请求排行榜事件
        client.emit('request_leaderboard')
        
        received = client.get_received()
        
        # 应该收到错误消息
        error_msg = None
        for msg in received:
            if msg['name'] == 'error':
                error_msg = msg
                break
        
        assert error_msg is not None
        assert error_msg['args'][0]['message'] == '获取排行榜失败'
    
    @patch('services.GameService.get_user_rank')
    def test_request_user_rank_event(self, mock_get_rank, client, test_user):
        """测试请求用户排名事件"""
        # 模拟用户排名数据
        mock_rank_info = {
            'user_id': test_user['id'],
            'username': test_user['username'],
            'rank': 3,
            'total_users': 10,
            'best_score': 1200
        }
        mock_get_rank.return_value = mock_rank_info
        
        # 发送请求用户排名事件
        client.emit('request_user_rank', {'user_id': test_user['id']})
        
        received = client.get_received()
        
        # 应该收到用户排名数据
        user_rank_data = None
        for msg in received:
            if msg['name'] == 'user_rank_data':
                user_rank_data = msg
                break
        
        assert user_rank_data is not None
        assert user_rank_data['args'][0]['rank_info'] == mock_rank_info
        assert 'timestamp' in user_rank_data['args'][0]
        
        # 验证服务方法被调用
        mock_get_rank.assert_called_once_with(test_user['id'])
    
    @patch('services.GameService.get_user_rank')
    def test_request_user_rank_no_data(self, mock_get_rank, client, test_user):
        """测试请求用户排名事件（无数据）"""
        # 模拟无排名数据
        mock_get_rank.return_value = None
        
        # 发送请求用户排名事件
        client.emit('request_user_rank', {'user_id': test_user['id']})
        
        received = client.get_received()
        
        # 应该收到空排名数据
        user_rank_data = None
        for msg in received:
            if msg['name'] == 'user_rank_data':
                user_rank_data = msg
                break
        
        assert user_rank_data is not None
        assert user_rank_data['args'][0]['rank_info'] is None
        assert user_rank_data['args'][0]['message'] == '用户暂无游戏记录'
    
    def test_request_user_rank_invalid(self, client):
        """测试请求用户排名事件（无效用户ID）"""
        # 发送无效的用户排名请求
        client.emit('request_user_rank', {})
        
        received = client.get_received()
        
        # 应该收到错误消息
        error_msg = None
        for msg in received:
            if msg['name'] == 'error':
                error_msg = msg
                break
        
        assert error_msg is not None
        assert error_msg['args'][0]['message'] == '用户ID不能为空'
    
    def test_ping_pong(self, client):
        """测试心跳检测"""
        # 发送ping
        client.emit('ping')
        
        received = client.get_received()
        
        # 应该收到pong响应
        pong_msg = None
        for msg in received:
            if msg['name'] == 'pong':
                pong_msg = msg
                break
        
        assert pong_msg is not None
        assert 'timestamp' in pong_msg['args'][0]
        assert 'server_time' in pong_msg['args'][0]
    
    def test_get_online_count(self, client):
        """测试获取在线用户数"""
        # 发送获取在线用户数请求
        client.emit('get_online_count')
        
        received = client.get_received()
        
        # 应该收到在线用户数
        online_count = None
        for msg in received:
            if msg['name'] == 'online_users_count':
                online_count = msg
                break
        
        assert online_count is not None
        assert online_count['args'][0]['count'] >= 1
    
    def test_multiple_clients_online_count(self, app):
        """测试多个客户端的在线用户数"""
        # 创建多个客户端
        client1 = SocketIOTestClient(app, socketio)
        client2 = SocketIOTestClient(app, socketio)
        
        # 清空接收的消息
        client1.get_received()
        client2.get_received()
        
        # 请求在线用户数
        client1.emit('get_online_count')
        
        received = client1.get_received()
        
        # 应该显示2个在线用户
        online_count = None
        for msg in received:
            if msg['name'] == 'online_users_count':
                online_count = msg
                break
        
        assert online_count is not None
        assert online_count['args'][0]['count'] == 2
        
        # 断开一个客户端
        client2.disconnect()
        
        # 再次请求在线用户数
        client1.emit('get_online_count')
        
        received = client1.get_received()
        
        # 应该显示1个在线用户
        online_count = None
        for msg in received:
            if msg['name'] == 'online_users_count':
                online_count = msg
                break
        
        assert online_count is not None
        assert online_count['args'][0]['count'] == 1
        
        # 清理
        client1.disconnect()


class TestSocketIOIntegration:
    """WebSocket集成测试类"""
    
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
    
    def test_complete_game_flow(self, client, app):
        """测试完整的游戏流程"""
        with app.app_context():
            # 1. 创建用户
            user_service = UserService()
            user = user_service.create_user("integration_test_user")
            
            # 2. 用户登录
            client.emit('user_login', {'user_id': user.id})
            
            # 3. 订阅排行榜更新
            client.emit('subscribe_leaderboard')
            
            # 4. 开始游戏
            client.emit('game_started', {'user_id': user.id})
            
            # 5. 结束游戏
            game_data = {
                'user_id': user.id,
                'score': 1500,
                'level': 8,
                'lines_cleared': 30,
                'game_duration': 450
            }
            client.emit('game_finished', game_data)
            
            # 6. 请求排行榜
            client.emit('request_leaderboard')
            
            # 7. 请求用户排名
            client.emit('request_user_rank', {'user_id': user.id})
            
            # 获取所有接收的消息
            received = client.get_received()
            
            # 验证收到了预期的消息
            message_types = [msg['name'] for msg in received]
            
            assert 'login_confirmed' in message_types
            assert 'game_saved' in message_types
            assert 'leaderboard_updated' in message_types
            assert 'leaderboard_data' in message_types
            assert 'user_rank_data' in message_types
            
            # 验证游戏记录被正确保存
            game_service = GameService()
            user_stats = game_service.get_user_statistics(user.id)
            
            assert user_stats['total_games'] == 1
            assert user_stats['best_score'] == 1500
    
    def test_concurrent_users_leaderboard_update(self, app):
        """测试并发用户的排行榜更新"""
        with app.app_context():
            # 创建多个用户和客户端
            user_service = UserService()
            user1 = user_service.create_user("concurrent_user1")
            user2 = user_service.create_user("concurrent_user2")
            
            client1 = SocketIOTestClient(app, socketio)
            client2 = SocketIOTestClient(app, socketio)
            
            # 两个客户端都订阅排行榜更新
            client1.emit('subscribe_leaderboard')
            client2.emit('subscribe_leaderboard')
            
            # 清空初始消息
            client1.get_received()
            client2.get_received()
            
            # 用户1完成游戏
            game_data1 = {
                'user_id': user1.id,
                'score': 2000,
                'level': 10,
                'lines_cleared': 40,
                'game_duration': 600
            }
            client1.emit('game_finished', game_data1)
            
            # 获取两个客户端的消息
            received1 = client1.get_received()
            received2 = client2.get_received()
            
            # 验证用户1收到了游戏保存确认
            game_saved = None
            for msg in received1:
                if msg['name'] == 'game_saved':
                    game_saved = msg
                    break
            assert game_saved is not None
            
            # 验证用户2收到了排行榜更新通知
            leaderboard_updated = None
            for msg in received2:
                if msg['name'] == 'leaderboard_updated':
                    leaderboard_updated = msg
                    break
            assert leaderboard_updated is not None
            assert leaderboard_updated['args'][0]['trigger_user'] == user1.id
            
            # 清理
            client1.disconnect()
            client2.disconnect()