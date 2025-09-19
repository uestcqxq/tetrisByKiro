"""
API路由集成测试
测试所有API端点的完整功能
"""

import json
import uuid
import pytest
from app import create_app
from models.base import db
from models.user import User
from models.game_record import GameRecord


class TestUserAPI:
    """用户API测试类"""
    
    @pytest.fixture
    def app(self):
        """创建测试应用"""
        app = create_app()
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def client(self, app):
        """创建测试客户端"""
        return app.test_client()
    
    @pytest.fixture
    def sample_user(self, app):
        """创建示例用户"""
        with app.app_context():
            user = User(username="TestUser123")
            user.save()
            # Return the user data as dict to avoid session issues
            return {
                'id': user.id,
                'username': user.username,
                'created_at': user.created_at,
                'last_active': user.last_active
            }
    
    def test_create_user_with_auto_generated_username(self, client):
        """测试创建用户（自动生成用户名）"""
        response = client.post('/api/users', 
                             json={},
                             content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert 'data' in data
        assert 'id' in data['data']
        assert 'username' in data['data']
        assert len(data['data']['username']) > 0
        assert data['message'] == '用户创建成功'
    
    def test_create_user_with_custom_username(self, client):
        """测试创建用户（自定义用户名）"""
        username = "CustomUser123"
        response = client.post('/api/users',
                             json={'username': username},
                             content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert data['data']['username'] == username
        assert data['message'] == '用户创建成功'
    
    def test_create_user_with_duplicate_username(self, client, sample_user):
        """测试创建重复用户名的用户"""
        response = client.post('/api/users',
                             json={'username': sample_user['username']},
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        
        assert 'error' in data
        assert '已存在' in data['error']
    
    def test_create_user_with_invalid_username(self, client):
        """测试创建无效用户名的用户"""
        # 测试空用户名
        response = client.post('/api/users',
                             json={'username': ''},
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        
        # 测试过长用户名
        long_username = 'a' * 51
        response = client.post('/api/users',
                             json={'username': long_username},
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
    
    def test_create_user_with_non_json_request(self, client):
        """测试非JSON请求"""
        response = client.post('/api/users',
                             data='not json',
                             content_type='text/plain')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert 'JSON格式' in data['error']
    
    def test_create_user_with_invalid_username_type(self, client):
        """测试无效用户名类型"""
        response = client.post('/api/users',
                             json={'username': 123},
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert '字符串' in data['error']
    
    def test_get_user_by_id(self, client, sample_user):
        """测试根据ID获取用户"""
        response = client.get(f'/api/users/{sample_user["id"]}')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert data['data']['id'] == sample_user['id']
        assert data['data']['username'] == sample_user['username']
    
    def test_get_user_by_invalid_id(self, client):
        """测试获取不存在的用户"""
        invalid_id = str(uuid.uuid4())
        response = client.get(f'/api/users/{invalid_id}')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        
        assert 'error' in data
        assert '不存在' in data['error']
    
    def test_get_user_by_invalid_uuid_format(self, client):
        """测试无效UUID格式"""
        response = client.get('/api/users/invalid-uuid')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        
        assert 'error' in data
        assert '无效的用户ID格式' in data['error']
    
    def test_get_user_endpoint_methods(self, client):
        """测试用户端点只支持GET方法"""
        user_id = str(uuid.uuid4())
        
        # POST方法应该不被允许
        response = client.post(f'/api/users/{user_id}')
        assert response.status_code == 405
        
        # PUT方法应该不被允许
        response = client.put(f'/api/users/{user_id}')
        assert response.status_code == 405
        
        # DELETE方法应该不被允许
        response = client.delete(f'/api/users/{user_id}')
        assert response.status_code == 405
    
    def test_create_user_endpoint_methods(self, client):
        """测试创建用户端点只支持POST方法"""
        # GET方法应该返回HTML页面（被catch-all路由处理）
        response = client.get('/api/users')
        assert response.status_code == 200
        assert 'text/html' in response.content_type
        
        # PUT方法应该返回405（方法不允许）
        response = client.put('/api/users')
        assert response.status_code == 405
        
        # DELETE方法应该返回405（方法不允许）
        response = client.delete('/api/users')
        assert response.status_code == 405


class TestGameAPI:
    """游戏API测试类"""
    
    @pytest.fixture
    def app(self):
        """创建测试应用"""
        app = create_app()
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def client(self, app):
        """创建测试客户端"""
        return app.test_client()
    
    @pytest.fixture
    def sample_user(self, app):
        """创建示例用户"""
        with app.app_context():
            user = User(username="GameTestUser")
            user.save()
            return {
                'id': user.id,
                'username': user.username
            }
    
    def test_save_game_valid_data(self, client, sample_user):
        """测试保存有效游戏数据"""
        game_data = {
            'user_id': sample_user['id'],
            'score': 15000,
            'level': 8,
            'lines_cleared': 25,
            'game_duration': 300
        }
        
        response = client.post('/api/games',
                             json=game_data,
                             content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert 'data' in data
        assert data['data']['score'] == 15000
        assert data['data']['level'] == 8
        assert data['message'] == '游戏得分保存成功'
    
    def test_save_game_missing_fields(self, client, sample_user):
        """测试保存游戏数据时缺少必需字段"""
        incomplete_data = {
            'user_id': sample_user['id'],
            'score': 1000
            # 缺少其他必需字段
        }
        
        response = client.post('/api/games',
                             json=incomplete_data,
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert '缺少必需字段' in data['error']
    
    def test_save_game_invalid_user_id(self, client):
        """测试保存游戏数据时用户ID无效"""
        game_data = {
            'user_id': 'invalid-uuid',
            'score': 1000,
            'level': 5,
            'lines_cleared': 10,
            'game_duration': 300
        }
        
        response = client.post('/api/games',
                             json=game_data,
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert '无效的用户ID格式' in data['error']
    
    def test_save_game_invalid_data_types(self, client, sample_user):
        """测试保存游戏数据时数据类型无效"""
        invalid_data_sets = [
            {'user_id': sample_user['id'], 'score': 'not_int', 'level': 5, 'lines_cleared': 10, 'game_duration': 300},
            {'user_id': sample_user['id'], 'score': -100, 'level': 5, 'lines_cleared': 10, 'game_duration': 300},
            {'user_id': sample_user['id'], 'score': 1000, 'level': 0, 'lines_cleared': 10, 'game_duration': 300},
            {'user_id': sample_user['id'], 'score': 1000, 'level': 5, 'lines_cleared': -5, 'game_duration': 300},
        ]
        
        for invalid_data in invalid_data_sets:
            response = client.post('/api/games',
                                 json=invalid_data,
                                 content_type='application/json')
            
            assert response.status_code == 400
            data = json.loads(response.data)
            assert 'error' in data
    
    def test_get_leaderboard_empty(self, client):
        """测试获取空排行榜"""
        response = client.get('/api/leaderboard')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert data['data'] == []
        assert data['total'] == 0
    
    def test_get_leaderboard_with_data(self, client, app, sample_user):
        """测试获取有数据的排行榜"""
        with app.app_context():
            # 创建多个游戏记录
            scores = [3000, 2000, 1000]
            for score in scores:
                game_record = GameRecord(
                    user_id=sample_user['id'],
                    score=score,
                    level=5,
                    lines_cleared=20,
                    game_duration=300
                )
                game_record.save()
        
        response = client.get('/api/leaderboard')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert len(data['data']) > 0
        assert data['data'][0]['score'] == 3000  # 最高分应该在第一位
        assert data['data'][0]['rank'] == 1
    
    def test_get_leaderboard_with_limit(self, client, app, sample_user):
        """测试获取排行榜时使用limit参数"""
        with app.app_context():
            # 创建多个游戏记录
            for i in range(5):
                game_record = GameRecord(
                    user_id=sample_user['id'],
                    score=1000 + i * 100,
                    level=5,
                    lines_cleared=20,
                    game_duration=300
                )
                game_record.save()
        
        response = client.get('/api/leaderboard?limit=3')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert len(data['data']) <= 3
    
    def test_get_leaderboard_invalid_limit(self, client):
        """测试获取排行榜时使用无效limit参数"""
        response = client.get('/api/leaderboard?limit=0')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert 'limit参数必须是正整数' in data['error']
    
    def test_get_user_rank_no_games(self, client, sample_user):
        """测试获取没有游戏记录的用户排名"""
        response = client.get(f'/api/users/{sample_user["id"]}/rank')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert 'error' in data
        assert '暂无游戏记录' in data['error']
    
    def test_get_user_rank_with_games(self, client, app, sample_user):
        """测试获取有游戏记录的用户排名"""
        with app.app_context():
            # 创建游戏记录
            game_record = GameRecord(
                user_id=sample_user['id'],
                score=2500,
                level=8,
                lines_cleared=25,
                game_duration=300
            )
            game_record.save()
        
        response = client.get(f'/api/users/{sample_user["id"]}/rank')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert 'data' in data
        assert data['data']['user_id'] == sample_user['id']
        assert data['data']['best_score'] == 2500
        assert data['data']['rank'] == 1
    
    def test_get_user_rank_invalid_uuid(self, client):
        """测试获取用户排名时使用无效UUID"""
        response = client.get('/api/users/invalid-uuid/rank')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert '无效的用户ID格式' in data['error']


class TestHealthAPI:
    """健康检查API测试类"""
    
    @pytest.fixture
    def app(self):
        """创建测试应用"""
        app = create_app()
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def client(self, app):
        """创建测试客户端"""
        return app.test_client()
    
    def test_health_ping(self, client):
        """测试网络连接健康检查"""
        response = client.get('/api/health/ping')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['status'] == 'ok'
        assert 'timestamp' in data
        assert 'server_time' in data
    
    def test_health_database(self, client):
        """测试数据库健康检查"""
        response = client.get('/api/health/database')
        
        # 应该返回200或503
        assert response.status_code in [200, 503]
        data = json.loads(response.data)
        
        assert 'healthy' in data
        assert 'timestamp' in data
    
    def test_log_error_endpoint(self, client):
        """测试错误日志记录端点"""
        error_data = {
            'message': 'Test frontend error',
            'stack': 'Error stack trace',
            'url': '/test-page',
            'timestamp': '2023-01-01T00:00:00Z'
        }
        
        response = client.post('/api/errors/log',
                             json=error_data,
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert data['message'] == '错误日志已记录'
    
    def test_admin_stats(self, client):
        """测试管理员统计信息端点"""
        response = client.get('/api/admin/stats')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert 'data' in data
        assert 'game_stats' in data['data']
        assert 'server_info' in data['data']


class TestMainRoutes:
    """主要路由测试类"""
    
    @pytest.fixture
    def app(self):
        """创建测试应用"""
        app = create_app()
        app.config['TESTING'] = True
        
        with app.app_context():
            yield app
    
    @pytest.fixture
    def client(self, app):
        """创建测试客户端"""
        return app.test_client()
    
    def test_index_route(self, client):
        """测试主页路由"""
        response = client.get('/')
        
        assert response.status_code == 200
        assert 'text/html' in response.content_type
    
    def test_health_check_route(self, client):
        """测试健康检查路由"""
        response = client.get('/health')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['status'] == 'ok'
        assert 'timestamp' in data
        assert 'version' in data
    
    def test_spa_routing(self, client):
        """测试SPA路由支持"""
        # 测试未匹配的路由返回主页面
        response = client.get('/some/spa/route')
        
        assert response.status_code == 200
        assert 'text/html' in response.content_type