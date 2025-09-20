"""
端到端集成测试 - 验证整个系统的集成和功能
测试游戏的完整流程，包括用户创建、游戏进行、得分保存等
"""

import pytest
import asyncio
import json
import time
from unittest.mock import Mock, patch
from flask import Flask
from flask.testing import FlaskClient

from app import create_app, socketio
from services.database_manager import DatabaseManager
from services.user_service import UserService
from services.game_service import GameService


class TestE2EIntegration:
    """端到端集成测试类"""
    
    @pytest.fixture
    def app(self):
        """直接创建Flask应用并按照正确的顺序手动注册所有路由，确保API路由优先匹配"""
        from flask import Flask
        from models.base import db
        from flask_socketio import SocketIO
        from flask_cors import CORS
        import os
        
        # 创建新的Flask应用实例
        app = Flask(__name__)
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'  # 使用正确的SQLAlchemy配置键
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # 禁用修改跟踪以提高性能
        app.config['SECRET_KEY'] = 'test-secret-key'
        
        # 初始化扩展
        db.init_app(app)
        cors = CORS(app)
        from app import socketio
        socketio.init_app(app)
        
        # 按正确的顺序注册路由
        # 1. 首先注册API路由（带/api前缀）
        from routes.api_routes import api_bp
        app.register_blueprint(api_bp, url_prefix='/api')
        
        # 2. 然后注册健康检查路由
        from routes.health_routes import health_bp
        app.register_blueprint(health_bp, url_prefix='/health')
        
        # 3. 最后注册主路由（包括catch_all路由）
        from routes.main_routes import main_bp
        app.register_blueprint(main_bp)
        
        return app
    
    @pytest.fixture
    def client(self, app):
        """创建测试客户端"""
        return app.test_client()
    
    @pytest.fixture
    def socketio_client(self, app):
        """创建SocketIO测试客户端"""
        from app import socketio
        return socketio.test_client(app)
    
    @pytest.fixture
    def db_manager(self, app):
        """初始化数据库"""
        from models.base import db
        
        with app.app_context():
            # 只需创建表，db.init_app已在create_app中调用
            db.create_all()
            
            # 返回一个简单的对象，包含必要的方法
            class SimpleDBManager:
                def cleanup(self):
                    db.drop_all()
                    db.session.remove()
            
            yield SimpleDBManager()
    
    def test_complete_game_flow(self, client, socketio_client, db_manager):
        """测试完整的游戏流程"""
        
        # 1. 访问主页
        response = client.get('/')
        assert response.status_code == 200
        # 使用文本形式获取响应内容
        content = response.get_data(as_text=True)
        assert '俄罗斯方块' in content
        
        # 2. 创建用户 - 添加详细调试信息
        user_response = client.post('/api/users', json={})
        print(f"创建用户响应状态码: {user_response.status_code}")
        print(f"创建用户响应内容: {user_response.data.decode('utf-8')}")
        assert user_response.status_code == 201
        user_data = json.loads(user_response.data)
        user_id = user_data['data']['id']  # 修正JSON结构访问
        assert 'username' in user_data['data']
        
        # 3. 获取用户信息
        get_user_response = client.get(f'/api/users/{user_id}')
        print(f"获取用户响应状态码: {get_user_response.status_code}")
        print(f"获取用户响应内容: {get_user_response.data.decode('utf-8')}")
        assert get_user_response.status_code == 200
        
        # 4. 连接WebSocket
        socketio_client.connect()
        assert socketio_client.is_connected()
        
        # 5. 提交游戏得分
        game_data = {
            'user_id': user_id,
            'score': 1500,
            'level': 3,
            'lines_cleared': 15,
            'game_duration': 180
        }
        
        score_response = client.post('/api/games', json=game_data)
        print(f"提交游戏得分响应状态码: {score_response.status_code}")
        print(f"提交游戏得分响应内容: {score_response.data.decode('utf-8')}")
        assert score_response.status_code == 201
        
        # 6. 获取排行榜
        leaderboard_response = client.get('/api/leaderboard')
        print(f"获取排行榜响应状态码: {leaderboard_response.status_code}")
        print(f"获取排行榜响应内容: {leaderboard_response.data.decode('utf-8')}")
        assert leaderboard_response.status_code == 200
        leaderboard_data = json.loads(leaderboard_response.data)
        assert len(leaderboard_data['data']) > 0  # 修正JSON结构访问
        assert leaderboard_data[0]['user_id'] == user_id
        
        # 7. 获取用户排名
        rank_response = client.get(f'/api/users/{user_id}/rank')
        assert rank_response.status_code == 200
        rank_data = json.loads(rank_response.data)
        assert rank_data['rank'] == 1
        
        # 8. 测试WebSocket事件
        socketio_client.emit('game_finished', game_data)
        received = socketio_client.get_received()
        
        # 验证收到排行榜更新
        leaderboard_updates = [msg for msg in received if msg['name'] == 'leaderboard_updated']
        assert len(leaderboard_updates) > 0
        
        socketio_client.disconnect()
    
    def test_multiple_users_competition(self, client, socketio_client, db_manager):
        """测试多用户竞争场景"""
        
        users = []
        scores = [2000, 1500, 1800, 1200, 2500]
        
        # 创建多个用户
        for i in range(5):
            response = client.post('/api/users', json={})
            assert response.status_code == 201
            response_data = json.loads(response.data)
            user_data = response_data['data']  # 提取实际的用户数据
            users.append(user_data)
        
        # 提交不同的得分
        for i, (user, score) in enumerate(zip(users, scores)):
            game_data = {
                'user_id': user['id'],
                'score': score,
                'level': score // 500,
                'lines_cleared': score // 100,
                'game_duration': 120 + i * 30
            }
            
            response = client.post('/api/games', json=game_data)
            assert response.status_code == 201
        
        # 验证排行榜排序
        leaderboard_response = client.get('/api/leaderboard')
        assert leaderboard_response.status_code == 200
        response_data = json.loads(leaderboard_response.data)
        leaderboard = response_data['data']  # 提取实际的排行榜数据
        
        # 验证按得分降序排列
        assert len(leaderboard) == 5
        assert leaderboard[0]['score'] == 2500  # 最高分
        assert leaderboard[-1]['score'] == 1200  # 最低分
        
        # 验证每个用户的排名
        for i, user in enumerate(users):
            rank_response = client.get(f'/api/users/{user["id"]}/rank')
            assert rank_response.status_code == 200
            response_data = json.loads(rank_response.data)
            rank_data = response_data['data']  # 提取实际的排名数据
            
            expected_rank = sorted(scores, reverse=True).index(scores[i]) + 1
            assert rank_data['rank'] == expected_rank
    
    def test_websocket_real_time_updates(self, client, db_manager):
        """测试WebSocket实时更新功能"""
        
        # 创建多个WebSocket客户端
        client1 = socketio.test_client(create_app())
        client2 = socketio.test_client(create_app())
        
        client1.connect()
        client2.connect()
        
        # 创建用户
        user_response = client.post('/api/users', json={})
        response_data = json.loads(user_response.data)
        user_data = response_data['data']  # 提取实际的用户数据
        user_id = user_data['id']
        
        # 清空接收的消息
        client1.get_received()
        client2.get_received()
        
        # 提交游戏得分
        game_data = {
            'user_id': user_id,
            'score': 3000,
            'level': 5,
            'lines_cleared': 30,
            'game_duration': 300
        }
        
        # 通过WebSocket发送游戏结束事件
        client1.emit('game_finished', game_data)
        
        # 等待消息传播
        time.sleep(0.1)
        
        # 验证两个客户端都收到了更新
        received1 = client1.get_received()
        received2 = client2.get_received()
        
        # 检查排行榜更新消息
        leaderboard_updates1 = [msg for msg in received1 if msg['name'] == 'leaderboard_updated']
        leaderboard_updates2 = [msg for msg in received2 if msg['name'] == 'leaderboard_updated']
        
        assert len(leaderboard_updates1) > 0
        assert len(leaderboard_updates2) > 0
        
        client1.disconnect()
        client2.disconnect()
    
    def test_error_handling_and_recovery(self, client, db_manager):
        """测试错误处理和恢复机制"""
        
        # 测试无效用户ID
        response = client.get('/api/users/invalid-id')
        assert response.status_code == 404
        
        # 测试无效游戏数据
        invalid_game_data = {
            'user_id': 'non-existent',
            'score': -100,  # 无效分数
            'level': 0,
            'lines_cleared': -5,  # 无效行数
            'game_duration': -10  # 无效时间
        }
        
        response = client.post('/api/games', json=invalid_game_data)
        assert response.status_code == 400
        
        # 测试缺少必需字段
        incomplete_data = {
            'score': 1000
            # 缺少其他必需字段
        }
        
        response = client.post('/api/games', json=incomplete_data)
        assert response.status_code == 400
        
        # 测试数据库连接错误恢复
        with patch.object(db_manager, 'get_connection', side_effect=Exception("Database error")):
            response = client.get('/api/leaderboard')
            assert response.status_code == 500
    
    def test_performance_under_load(self, client, db_manager):
        """测试系统在负载下的性能"""
        
        # 创建大量用户和得分记录
        users = []
        for i in range(50):
            response = client.post('/api/users', json={})
            assert response.status_code == 201
            response_data = json.loads(response.data)
            user_data = response_data['data']  # 提取实际的用户数据
            users.append(user_data)
        
        # 并发提交得分
        import threading
        import random
        
        def submit_score(user):
            game_data = {
                'user_id': user['id'],
                'score': random.randint(100, 5000),
                'level': random.randint(1, 10),
                'lines_cleared': random.randint(1, 50),
                'game_duration': random.randint(60, 600)
            }
            
            response = client.post('/api/games', json=game_data)
            assert response.status_code == 201
        
        # 创建线程并发提交
        threads = []
        for user in users[:20]:  # 限制并发数量
            thread = threading.Thread(target=submit_score, args=(user,))
            threads.append(thread)
            thread.start()
        
        # 等待所有线程完成
        for thread in threads:
            thread.join()
        
        # 验证排行榜仍然正常工作
        start_time = time.time()
        response = client.get('/api/leaderboard')
        end_time = time.time()
        
        assert response.status_code == 200
        assert (end_time - start_time) < 1.0  # 响应时间应该小于1秒
        
        response_data = json.loads(response.data)
        leaderboard = response_data['data']  # 提取实际的排行榜数据
        assert len(leaderboard) <= 10  # 默认返回前10名
    
    def test_data_consistency(self, client, db_manager):
        """测试数据一致性"""
        
        # 创建用户
        user_response = client.post('/api/users', json={})
        response_data = json.loads(user_response.data)
        user_data = response_data['data']  # 提取实际的用户数据
        user_id = user_data['id']
        
        # 提交多个游戏记录
        scores = [1000, 1500, 800, 2000, 1200]
        
        for score in scores:
            game_data = {
                'user_id': user_id,
                'score': score,
                'level': score // 500,
                'lines_cleared': score // 100,
                'game_duration': 180
            }
            
            response = client.post('/api/games', json=game_data)
            assert response.status_code == 201
        
        # 验证用户的最高分
        user_response = client.get(f'/api/users/{user_id}')
        user_data = json.loads(user_response.data)
        
        # 获取排行榜中的用户记录
        leaderboard_response = client.get('/api/leaderboard')
        leaderboard = json.loads(leaderboard_response.data)
        
        user_in_leaderboard = next((item for item in leaderboard if item['user_id'] == user_id), None)
        assert user_in_leaderboard is not None
        assert user_in_leaderboard['score'] == max(scores)  # 应该显示最高分
        
        # 验证排名一致性
        rank_response = client.get(f'/api/users/{user_id}/rank')
        rank_data = json.loads(rank_response.data)
        
        # 在排行榜中找到用户的位置
        leaderboard_rank = next((i + 1 for i, item in enumerate(leaderboard) if item['user_id'] == user_id), None)
        assert rank_data['rank'] == leaderboard_rank
    
    def test_security_and_validation(self, client, db_manager):
        """测试安全性和数据验证"""
        
        # 测试SQL注入防护
        malicious_data = {
            'user_id': "'; DROP TABLE users; --",
            'score': 1000,
            'level': 1,
            'lines_cleared': 10,
            'game_duration': 120
        }
        
        response = client.post('/api/games', json=malicious_data)
        # 应该返回400或404，而不是500（服务器错误）
        assert response.status_code in [400, 404]
        
        # 测试XSS防护
        xss_username = "<script>alert('xss')</script>"
        
        # 尝试通过用户名注入脚本（如果有用户名自定义功能）
        response = client.post('/api/users', json={'username': xss_username})
        if response.status_code == 201:
            response_data = json.loads(response.data)
            user_data = response_data['data']  # 提取实际的用户数据
            # 用户名应该被转义或清理
            assert '<script>' not in user_data.get('username', '')
        
        # 测试数据范围验证
        extreme_data = {
            'user_id': 'valid-user-id',
            'score': 999999999,  # 极大值
            'level': -1,  # 负数
            'lines_cleared': 999999,  # 极大值
            'game_duration': 0  # 零值
        }
        
        response = client.post('/api/games', json=extreme_data)
        assert response.status_code == 400  # 应该被验证拒绝
    
    def test_offline_and_reconnection(self, client, db_manager):
        """测试离线处理和重连机制"""
        
        # 创建用户
        user_response = client.post('/api/users', json={})
        response_data = json.loads(user_response.data)
        user_data = response_data['data']  # 提取实际的用户数据
        user_id = user_data['id']
        
        # 模拟网络中断
        with patch('requests.get', side_effect=Exception("Network error")):
            # 在网络中断期间，API应该返回适当的错误
            response = client.get('/api/leaderboard')
            # 根据实现，可能返回缓存数据或错误
            assert response.status_code in [200, 500, 503]
        
        # 网络恢复后，功能应该正常
        response = client.get('/api/leaderboard')
        assert response.status_code == 200
        
        # 提交离线期间的数据
        offline_game_data = {
            'user_id': user_id,
            'score': 1800,
            'level': 4,
            'lines_cleared': 18,
            'game_duration': 240,
            'offline_timestamp': int(time.time() - 300)  # 5分钟前
        }
        
        response = client.post('/api/games', json=offline_game_data)
        assert response.status_code == 201
    
    def test_mobile_compatibility(self, client):
        """测试移动设备兼容性"""
        
        # 模拟移动设备请求
        mobile_headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
        }
        
        response = client.get('/', headers=mobile_headers)
        assert response.status_code == 200
        
        # 检查响应式设计元素
        assert b'viewport' in response.data
        assert b'mobile-controls' in response.data or b'touch' in response.data
    
    def test_api_rate_limiting(self, client, db_manager):
        """测试API速率限制"""
        
        # 创建用户
        user_response = client.post('/api/users', json={})
        response_data = json.loads(user_response.data)
        user_data = response_data['data']  # 提取实际的用户数据
        user_id = user_data['id']
        
        # 快速连续发送请求
        responses = []
        for i in range(20):
            game_data = {
                'user_id': user_id,
                'score': 1000 + i,
                'level': 1,
                'lines_cleared': 10,
                'game_duration': 120
            }
            
            response = client.post('/api/games', json=game_data)
            responses.append(response.status_code)
        
        # 检查是否有速率限制响应（429状态码）
        # 注意：这取决于是否实现了速率限制
        success_count = sum(1 for status in responses if status == 201)
        rate_limited_count = sum(1 for status in responses if status == 429)
        
        # 至少应该有一些成功的请求
        assert success_count > 0
        
        # 如果实现了速率限制，应该有一些被限制的请求
        if rate_limited_count > 0:
            print(f"Rate limiting working: {rate_limited_count} requests limited")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])