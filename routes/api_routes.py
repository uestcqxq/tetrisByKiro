"""
API路由
处理RESTful API请求
"""

from flask import Blueprint, request, jsonify, current_app
from services import UserService, GameService
from functools import wraps
import uuid

api_bp = Blueprint('api', __name__)

# 初始化服务
user_service = UserService()
game_service = GameService()


def validate_json(f):
    """验证JSON请求装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not request.is_json:
            return jsonify({'error': '请求必须是JSON格式'}), 400
        return f(*args, **kwargs)
    return decorated_function


def validate_uuid(uuid_string):
    """验证UUID格式"""
    try:
        uuid.UUID(uuid_string)
        return True
    except ValueError:
        return False

@api_bp.route('/users', methods=['POST'])
def create_user():
    """创建新用户"""
    try:
        data = request.get_json() or {}
        username = data.get('username')
        
        # 验证用户名（可选参数）
        if username is not None:
            if not isinstance(username, str):
                return jsonify({'error': '用户名必须是字符串'}), 400
            if len(username.strip()) == 0:
                return jsonify({'error': '用户名不能为空'}), 400
            if len(username) > 50:
                return jsonify({'error': '用户名长度不能超过50个字符'}), 400
        
        user = user_service.create_user(username)
        current_app.logger.info(f'Created user: {user.id} - {user.username}')
        
        return jsonify({
            'success': True,
            'data': user.to_dict(),
            'message': '用户创建成功'
        }), 201
    
    except ValueError as e:
        current_app.logger.warning(f'User creation validation error: {str(e)}')
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        current_app.logger.error(f'User creation error: {str(e)}')
        return jsonify({'error': '创建用户失败'}), 500

@api_bp.route('/users/<user_id>', methods=['GET'])
def get_user(user_id):
    """获取用户信息"""
    try:
        # 验证UUID格式
        if not validate_uuid(user_id):
            return jsonify({'error': '无效的用户ID格式'}), 400
        
        user = user_service.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': '用户不存在'}), 404
        
        return jsonify({
            'success': True,
            'data': user.to_dict()
        })
    
    except Exception as e:
        current_app.logger.error(f'Get user error: {str(e)}')
        return jsonify({'error': '获取用户信息失败'}), 500

@api_bp.route('/games', methods=['POST'])
@validate_json
def save_game():
    """保存游戏得分"""
    try:
        data = request.get_json()
        
        # 验证必需字段
        required_fields = ['user_id', 'score', 'level', 'lines_cleared', 'game_duration']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'缺少必需字段: {field}'}), 400
        
        # 验证数据类型和范围
        if not validate_uuid(data['user_id']):
            return jsonify({'error': '无效的用户ID格式'}), 400
        
        if not isinstance(data['score'], int) or data['score'] < 0:
            return jsonify({'error': '得分必须是非负整数'}), 400
        
        if not isinstance(data['level'], int) or data['level'] < 1:
            return jsonify({'error': '级别必须是正整数'}), 400
        
        if not isinstance(data['lines_cleared'], int) or data['lines_cleared'] < 0:
            return jsonify({'error': '消除行数必须是非负整数'}), 400
        
        if not isinstance(data['game_duration'], int) or data['game_duration'] < 0:
            return jsonify({'error': '游戏时长必须是非负整数'}), 400
        
        game_record = game_service.save_game_score(
            user_id=data['user_id'],
            score=data['score'],
            level=data['level'],
            lines_cleared=data['lines_cleared'],
            game_duration=data['game_duration']
        )
        
        current_app.logger.info(f'Saved game score: {data["user_id"]} - {data["score"]}')
        
        # 通知WebSocket客户端排行榜更新
        try:
            from app import socketio
            socketio.emit('leaderboard_updated')
        except Exception as e:
            current_app.logger.warning(f'WebSocket emit error: {str(e)}')
        
        return jsonify({
            'success': True,
            'data': game_record.to_dict(),
            'message': '游戏得分保存成功'
        }), 201
    
    except ValueError as e:
        current_app.logger.warning(f'Game save validation error: {str(e)}')
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        current_app.logger.error(f'Game save error: {str(e)}')
        return jsonify({'error': '保存游戏得分失败'}), 500

@api_bp.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    """获取排行榜"""
    try:
        # 验证limit参数
        limit = request.args.get('limit', 10, type=int)
        if limit < 1:
            return jsonify({'error': 'limit参数必须是正整数'}), 400
        if limit > 100:  # 限制最大返回数量
            limit = 100
        
        leaderboard = game_service.get_leaderboard(limit)
        
        # The game service already returns formatted dictionaries with rank and username
        result = leaderboard
        
        return jsonify({
            'success': True,
            'data': result,
            'total': len(result)
        })
    
    except Exception as e:
        current_app.logger.error(f'Get leaderboard error: {str(e)}')
        return jsonify({'error': '获取排行榜失败'}), 500

@api_bp.route('/users/<user_id>/rank', methods=['GET'])
def get_user_rank(user_id):
    """获取用户排名"""
    try:
        # 验证UUID格式
        if not validate_uuid(user_id):
            return jsonify({'error': '无效的用户ID格式'}), 400
        
        rank_info = game_service.get_user_rank(user_id)
        if rank_info is None:
            return jsonify({'error': '用户暂无游戏记录'}), 404
        
        return jsonify({
            'success': True,
            'data': rank_info
        })
    
    except Exception as e:
        current_app.logger.error(f'Get user rank error: {str(e)}')
        return jsonify({'error': '获取用户排名失败'}), 500


# ==================== 健康检查和监控端点 ====================

@api_bp.route('/health/ping', methods=['GET'])
def health_ping():
    """网络连接健康检查端点"""
    try:
        # 简单的ping响应
        return jsonify({
            'status': 'ok',
            'timestamp': current_app.config.get('STARTUP_TIME'),
            'server_time': str(uuid.uuid4())[:8]  # 简单的响应标识
        }), 200
    
    except Exception as e:
        current_app.logger.error(f'Health ping error: {str(e)}')
        return jsonify({'status': 'error', 'message': str(e)}), 500


@api_bp.route('/health/database', methods=['GET'])
def health_database():
    """数据库健康检查端点"""
    try:
        from services.database_manager import connection_manager
        
        # 检查数据库连接
        is_healthy = connection_manager.check_connection_health(force_check=True)
        stats = connection_manager.get_connection_stats()
        
        return jsonify({
            'healthy': is_healthy,
            'stats': stats,
            'timestamp': str(uuid.uuid4())[:8]
        }), 200 if is_healthy else 503
    
    except Exception as e:
        current_app.logger.error(f'Database health check error: {str(e)}')
        return jsonify({
            'healthy': False,
            'error': str(e),
            'timestamp': str(uuid.uuid4())[:8]
        }), 503


@api_bp.route('/errors/log', methods=['POST'])
@validate_json
def log_error():
    """接收前端错误日志"""
    try:
        data = request.get_json()
        
        # 记录错误日志
        current_app.logger.error(f'Frontend error: {data}')
        
        # 这里可以添加更复杂的错误处理逻辑
        # 比如发送到错误监控服务、存储到数据库等
        
        return jsonify({
            'success': True,
            'message': '错误日志已记录'
        }), 200
    
    except Exception as e:
        current_app.logger.error(f'Error logging failed: {str(e)}')
        return jsonify({'error': '记录错误日志失败'}), 500


@api_bp.route('/admin/stats', methods=['GET'])
def get_admin_stats():
    """获取管理员统计信息"""
    try:
        # 获取游戏统计
        game_stats = game_service.get_global_statistics()
        
        # 获取数据库统计
        try:
            from services.database_manager import connection_manager
            db_stats = connection_manager.get_connection_stats()
        except Exception:
            db_stats = {'error': '无法获取数据库统计'}
        
        return jsonify({
            'success': True,
            'data': {
                'game_stats': game_stats,
                'database_stats': db_stats,
                'server_info': {
                    'startup_time': current_app.config.get('STARTUP_TIME'),
                    'debug_mode': current_app.debug
                }
            }
        })
    
    except Exception as e:
        current_app.logger.error(f'Get admin stats error: {str(e)}')
        return jsonify({'error': '获取统计信息失败'}), 500