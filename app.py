"""
Flask应用主模块
主要职责：
- 应用初始化和配置
- 路由注册
- 数据库连接管理
- WebSocket事件处理
"""

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
from models.base import db
from services.database_manager import init_database_manager
import os
import logging
from datetime import datetime

# 初始化扩展
socketio = SocketIO()
cors = CORS()

def create_app(config_name=None):
    """应用工厂函数"""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    
    # 从配置类加载配置
    from config import config
    app.config.from_object(config[config_name])
    
    # 初始化扩展
    db.init_app(app)
    cors.init_app(app, resources={
        r"/api/*": {"origins": "*"},
        r"/socket.io/*": {"origins": "*"}
    })
    socketio.init_app(app, cors_allowed_origins="*")
    
    # 配置日志
    if not app.debug and not app.testing:
        logging.basicConfig(level=logging.INFO)
    
    # 导入模型以确保它们被注册
    from models import User, GameRecord
    
    # 注册中间件
    register_middleware(app)
    
    # 注册路由
    register_routes(app)
    
    # 注册WebSocket事件
    register_socketio_events(app)
    
    # 初始化数据库管理器
    init_database_manager(app)
    
    return app


def register_middleware(app):
    """注册中间件"""
    
    @app.before_request
    def before_request():
        """请求前处理"""
        # 记录请求信息
        if app.debug:
            app.logger.info(f'{request.method} {request.path} - {request.remote_addr}')
    
    @app.after_request
    def after_request(response):
        """请求后处理"""
        # 添加安全头
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # 记录响应信息
        if app.debug:
            app.logger.info(f'Response: {response.status_code}')
        
        return response
    
    @app.errorhandler(404)
    def not_found(error):
        """404错误处理"""
        if request.path.startswith('/api/'):
            return jsonify({'error': '接口不存在'}), 404
        return render_template('index.html')  # SPA路由处理
    
    @app.errorhandler(500)
    def internal_error(error):
        """500错误处理"""
        db.session.rollback()
        if request.path.startswith('/api/'):
            return jsonify({'error': '服务器内部错误'}), 500
        return render_template('index.html')


def register_routes(app):
    """注册路由"""
    try:
        from routes import main_bp, api_bp
        from routes.health_routes import health_bp
        
        app.register_blueprint(main_bp)
        app.register_blueprint(api_bp, url_prefix='/api')
        app.register_blueprint(health_bp, url_prefix='/health')
        
        # 延迟启动健康监控 - 在第一次请求后启动
        from services.health_check_service import health_service
        
        def start_health_monitoring():
            if not hasattr(app, '_health_monitoring_started'):
                health_service.start_monitoring()
                app._health_monitoring_started = True
        
        # 使用 before_request 来延迟启动
        @app.before_request
        def ensure_health_monitoring():
            start_health_monitoring()
        
    except ImportError:
        # 如果路由模块不存在，创建基本路由
        @app.route('/')
        def index():
            return render_template('index.html')


def register_socketio_events(app):
    """注册WebSocket事件"""
    
    # 存储连接的客户端信息
    connected_clients = {}
    
    # 存储订阅排行榜更新的客户端
    leaderboard_subscribers = set()
    
    def broadcast_leaderboard_update(trigger_user_id=None, new_score=None):
        """广播排行榜更新给所有订阅的客户端"""
        try:
            from services import GameService
            game_service = GameService()
            
            # 获取最新排行榜
            leaderboard = game_service.get_leaderboard(10)
            
            # 构建更新消息
            update_data = {
                'leaderboard': leaderboard,
                'timestamp': datetime.now().isoformat(),
                'trigger_user': trigger_user_id,
                'new_score': new_score
            }
            
            # 发送给所有订阅的客户端
            for client_sid in leaderboard_subscribers.copy():  # 使用copy避免迭代时修改
                try:
                    socketio.emit('leaderboard_updated', update_data, room=client_sid)
                except Exception as e:
                    app.logger.error(f'Error sending leaderboard update to {client_sid}: {str(e)}')
                    # 移除无效的客户端
                    leaderboard_subscribers.discard(client_sid)
            
            app.logger.info(f'Broadcasted leaderboard update to {len(leaderboard_subscribers)} subscribers')
            
        except Exception as e:
            app.logger.error(f'Error broadcasting leaderboard update: {str(e)}')
    
    def notify_rank_change(user_id, old_rank=None, new_rank=None, score=None):
        """通知特定用户的排名变化"""
        try:
            # 查找用户的连接
            user_clients = [sid for sid, info in connected_clients.items() 
                          if info.get('user_id') == user_id]
            
            if user_clients:
                rank_change_data = {
                    'user_id': user_id,
                    'old_rank': old_rank,
                    'new_rank': new_rank,
                    'score': score,
                    'timestamp': datetime.now().isoformat()
                }
                
                for client_sid in user_clients:
                    try:
                        socketio.emit('rank_changed', rank_change_data, room=client_sid)
                    except Exception as e:
                        app.logger.error(f'Error sending rank change to {client_sid}: {str(e)}')
                
                app.logger.info(f'Notified user {user_id} of rank change: {old_rank} -> {new_rank}')
        
        except Exception as e:
            app.logger.error(f'Error notifying rank change for user {user_id}: {str(e)}')
    
    @socketio.on('connect')
    def handle_connect(auth=None):
        """客户端连接事件"""
        try:
            # 记录客户端连接信息
            client_info = {
                'sid': request.sid,
                'connected_at': datetime.now(),
                'user_id': None,
                'last_activity': datetime.now()
            }
            
            # 如果提供了认证信息，记录用户ID
            if auth and isinstance(auth, dict) and 'user_id' in auth:
                client_info['user_id'] = auth['user_id']
            
            connected_clients[request.sid] = client_info
            
            app.logger.info(f'Client connected: {request.sid}, User: {client_info.get("user_id", "Anonymous")}')
            
            # 发送连接确认
            socketio.emit('connection_confirmed', {
                'sid': request.sid,
                'server_time': datetime.now().isoformat(),
                'message': '连接成功'
            }, room=request.sid)
            
            # 发送当前在线用户数
            online_count = len(connected_clients)
            socketio.emit('online_users_count', {'count': online_count})
            
        except Exception as e:
            app.logger.error(f'Error handling connect: {str(e)}')
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """客户端断开连接事件"""
        try:
            client_info = connected_clients.pop(request.sid, None)
            
            # 清理排行榜订阅
            leaderboard_subscribers.discard(request.sid)
            
            if client_info:
                user_id = client_info.get('user_id', 'Anonymous')
                app.logger.info(f'Client disconnected: {request.sid}, User: {user_id}')
            else:
                app.logger.info(f'Unknown client disconnected: {request.sid}')
            
            # 发送当前在线用户数
            online_count = len(connected_clients)
            socketio.emit('online_users_count', {'count': online_count})
            
        except Exception as e:
            app.logger.error(f'Error handling disconnect: {str(e)}')
    
    @socketio.on('user_login')
    def handle_user_login(data):
        """用户登录事件"""
        try:
            user_id = data.get('user_id')
            if not user_id:
                socketio.emit('error', {'message': '用户ID不能为空'}, room=request.sid)
                return
            
            # 更新客户端信息
            if request.sid in connected_clients:
                connected_clients[request.sid]['user_id'] = user_id
                connected_clients[request.sid]['last_activity'] = datetime.now()
            
            app.logger.info(f'User logged in: {user_id} (SID: {request.sid})')
            
            # 发送登录确认
            socketio.emit('login_confirmed', {
                'user_id': user_id,
                'message': '登录成功'
            }, room=request.sid)
            
        except Exception as e:
            app.logger.error(f'Error handling user_login: {str(e)}')
            socketio.emit('error', {'message': '登录处理失败'}, room=request.sid)
    
    @socketio.on('game_started')
    def handle_game_started(data):
        """游戏开始事件"""
        try:
            user_id = data.get('user_id')
            
            # 更新客户端活动时间
            if request.sid in connected_clients:
                connected_clients[request.sid]['last_activity'] = datetime.now()
            
            app.logger.info(f'Game started for user: {user_id} (SID: {request.sid})')
            
            # 可以在这里添加游戏开始的统计逻辑
            
        except Exception as e:
            app.logger.error(f'Error handling game_started: {str(e)}')
    
    @socketio.on('game_finished')
    def handle_game_finished(data):
        """游戏结束事件"""
        try:
            user_id = data.get('user_id')
            score = data.get('score', 0)
            level = data.get('level', 1)
            lines_cleared = data.get('lines_cleared', 0)
            game_duration = data.get('game_duration', 0)
            
            # 更新客户端活动时间
            if request.sid in connected_clients:
                connected_clients[request.sid]['last_activity'] = datetime.now()
            
            app.logger.info(f'Game finished for user: {user_id}, Score: {score} (SID: {request.sid})')
            
            # 保存游戏得分（如果提供了完整数据）
            if user_id and score > 0:
                try:
                    from services import GameService
                    game_service = GameService()
                    
                    # 获取用户当前排名（保存前）
                    old_rank_info = game_service.get_user_rank(user_id)
                    old_rank = old_rank_info['rank'] if old_rank_info else None
                    
                    # 保存游戏得分
                    game_record = game_service.save_game_score(
                        user_id=user_id,
                        score=score,
                        level=level,
                        lines_cleared=lines_cleared,
                        game_duration=game_duration
                    )
                    
                    # 获取用户新排名
                    new_rank_info = game_service.get_user_rank(user_id)
                    new_rank = new_rank_info['rank'] if new_rank_info else None
                    
                    # 发送游戏结束确认给当前用户
                    socketio.emit('game_saved', {
                        'game_id': game_record.id,
                        'score': score,
                        'rank_info': new_rank_info,
                        'message': '游戏得分已保存'
                    }, room=request.sid)
                    
                    # 广播排行榜更新
                    broadcast_leaderboard_update(trigger_user_id=user_id, new_score=score)
                    
                    # 如果排名发生变化，通知用户
                    if old_rank != new_rank:
                        notify_rank_change(user_id, old_rank, new_rank, score)
                    
                except Exception as save_error:
                    app.logger.error(f'Error saving game score: {str(save_error)}')
                    socketio.emit('error', {
                        'message': '保存游戏得分失败',
                        'details': str(save_error)
                    }, room=request.sid)
            
        except Exception as e:
            app.logger.error(f'Error handling game_finished: {str(e)}')
            socketio.emit('error', {'message': '游戏结束处理失败'}, room=request.sid)
    
    @socketio.on('request_leaderboard')
    def handle_request_leaderboard(data=None):
        """请求排行榜事件"""
        try:
            limit = 10
            if data and isinstance(data, dict):
                limit = min(data.get('limit', 10), 50)  # 最多50条记录
            
            # 更新客户端活动时间
            if request.sid in connected_clients:
                connected_clients[request.sid]['last_activity'] = datetime.now()
            
            from services import GameService
            game_service = GameService()
            leaderboard = game_service.get_leaderboard(limit)
            
            # 发送排行榜数据给请求的客户端
            socketio.emit('leaderboard_data', {
                'leaderboard': leaderboard,
                'timestamp': datetime.now().isoformat(),
                'total_records': len(leaderboard)
            }, room=request.sid)
            
            app.logger.info(f'Leaderboard requested by SID: {request.sid}, Records: {len(leaderboard)}')
            
        except Exception as e:
            app.logger.error(f'Error handling request_leaderboard: {str(e)}')
            socketio.emit('error', {'message': '获取排行榜失败'}, room=request.sid)
    
    @socketio.on('request_user_rank')
    def handle_request_user_rank(data):
        """请求用户排名事件"""
        try:
            user_id = data.get('user_id')
            if not user_id:
                socketio.emit('error', {'message': '用户ID不能为空'}, room=request.sid)
                return
            
            # 更新客户端活动时间
            if request.sid in connected_clients:
                connected_clients[request.sid]['last_activity'] = datetime.now()
            
            from services import GameService
            game_service = GameService()
            rank_info = game_service.get_user_rank(user_id)
            
            if rank_info:
                socketio.emit('user_rank_data', {
                    'rank_info': rank_info,
                    'timestamp': datetime.now().isoformat()
                }, room=request.sid)
            else:
                socketio.emit('user_rank_data', {
                    'rank_info': None,
                    'message': '用户暂无游戏记录',
                    'timestamp': datetime.now().isoformat()
                }, room=request.sid)
            
            app.logger.info(f'User rank requested for: {user_id} (SID: {request.sid})')
            
        except Exception as e:
            app.logger.error(f'Error handling request_user_rank: {str(e)}')
            socketio.emit('error', {'message': '获取用户排名失败'}, room=request.sid)
    
    @socketio.on('ping')
    def handle_ping(data=None):
        """心跳检测事件"""
        try:
            # 更新客户端活动时间
            if request.sid in connected_clients:
                connected_clients[request.sid]['last_activity'] = datetime.now()
            
            # 发送pong响应
            socketio.emit('pong', {
                'timestamp': datetime.now().isoformat(),
                'server_time': datetime.now().isoformat()
            }, room=request.sid)
            
        except Exception as e:
            app.logger.error(f'Error handling ping: {str(e)}')
    
    @socketio.on('get_online_count')
    def handle_get_online_count():
        """获取在线用户数事件"""
        try:
            online_count = len(connected_clients)
            socketio.emit('online_users_count', {'count': online_count}, room=request.sid)
            
        except Exception as e:
            app.logger.error(f'Error handling get_online_count: {str(e)}')
    
    @socketio.on('subscribe_leaderboard')
    def handle_subscribe_leaderboard():
        """订阅排行榜更新事件"""
        try:
            leaderboard_subscribers.add(request.sid)
            
            # 更新客户端活动时间
            if request.sid in connected_clients:
                connected_clients[request.sid]['last_activity'] = datetime.now()
            
            # 发送订阅确认
            socketio.emit('leaderboard_subscription_confirmed', {
                'subscribed': True,
                'timestamp': datetime.now().isoformat(),
                'message': '已订阅排行榜更新'
            }, room=request.sid)
            
            # 立即发送当前排行榜
            from services import GameService
            game_service = GameService()
            leaderboard = game_service.get_leaderboard(10)
            
            socketio.emit('leaderboard_data', {
                'leaderboard': leaderboard,
                'timestamp': datetime.now().isoformat(),
                'total_records': len(leaderboard)
            }, room=request.sid)
            
            app.logger.info(f'Client {request.sid} subscribed to leaderboard updates')
            
        except Exception as e:
            app.logger.error(f'Error handling subscribe_leaderboard: {str(e)}')
            socketio.emit('error', {'message': '订阅排行榜更新失败'}, room=request.sid)
    
    @socketio.on('unsubscribe_leaderboard')
    def handle_unsubscribe_leaderboard():
        """取消订阅排行榜更新事件"""
        try:
            leaderboard_subscribers.discard(request.sid)
            
            # 更新客户端活动时间
            if request.sid in connected_clients:
                connected_clients[request.sid]['last_activity'] = datetime.now()
            
            # 发送取消订阅确认
            socketio.emit('leaderboard_subscription_confirmed', {
                'subscribed': False,
                'timestamp': datetime.now().isoformat(),
                'message': '已取消订阅排行榜更新'
            }, room=request.sid)
            
            app.logger.info(f'Client {request.sid} unsubscribed from leaderboard updates')
            
        except Exception as e:
            app.logger.error(f'Error handling unsubscribe_leaderboard: {str(e)}')
    
    @socketio.on('get_leaderboard_stats')
    def handle_get_leaderboard_stats():
        """获取排行榜统计信息事件"""
        try:
            # 更新客户端活动时间
            if request.sid in connected_clients:
                connected_clients[request.sid]['last_activity'] = datetime.now()
            
            from services import GameService
            game_service = GameService()
            
            # 获取全局统计信息
            global_stats = game_service.get_global_statistics()
            
            # 获取级别分布
            level_distribution = game_service.get_level_distribution()
            
            socketio.emit('leaderboard_stats', {
                'global_stats': global_stats,
                'level_distribution': level_distribution,
                'subscribers_count': len(leaderboard_subscribers),
                'online_users': len(connected_clients),
                'timestamp': datetime.now().isoformat()
            }, room=request.sid)
            
            app.logger.info(f'Sent leaderboard stats to client {request.sid}')
            
        except Exception as e:
            app.logger.error(f'Error handling get_leaderboard_stats: {str(e)}')
            socketio.emit('error', {'message': '获取排行榜统计失败'}, room=request.sid)
    
    # 添加错误处理
    @socketio.on_error_default
    def default_error_handler(e):
        """默认错误处理器"""
        app.logger.error(f'SocketIO error: {str(e)}')
        socketio.emit('error', {
            'message': '服务器内部错误',
            'timestamp': datetime.now().isoformat()
        }, room=request.sid)

if __name__ == '__main__':
    app = create_app()
    
    # 在应用上下文中初始化数据库
    with app.app_context():
        try:
            db.create_all()
            print("数据库表创建成功")
        except Exception as e:
            print(f"数据库初始化失败: {e}")
    
    print("启动Flask应用...")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)