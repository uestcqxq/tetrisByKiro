"""
主要页面路由
处理页面渲染和静态文件服务
"""

from flask import Blueprint, render_template, send_from_directory, current_app, jsonify
import os

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    """主游戏页面"""
    return render_template('index.html')

@main_bp.route('/health')
def health_check():
    """健康检查端点"""
    return jsonify({
        'status': 'ok',
        'timestamp': current_app.config.get('STARTUP_TIME', 'unknown'),
        'version': '1.0.0'
    })

@main_bp.route('/favicon.ico')
def favicon():
    """网站图标"""
    return send_from_directory(
        os.path.join(current_app.root_path, 'static'),
        'favicon.ico',
        mimetype='image/vnd.microsoft.icon'
    )

# SPA路由支持 - 所有未匹配的路由都返回主页面
@main_bp.route('/<path:path>')
def catch_all(path):
    """捕获所有路由，支持SPA前端路由"""
    # 如果是静态文件请求，尝试返回文件
    if '.' in path:
        # 检查文件扩展名，确保是静态资源
        allowed_extensions = {'.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.wav', '.ogg'}
        file_ext = os.path.splitext(path)[1].lower()
        
        if file_ext in allowed_extensions:
            try:
                return send_from_directory(current_app.static_folder, path)
            except FileNotFoundError:
                # 如果静态文件不存在，返回404而不是HTML页面
                from flask import abort
                abort(404)
    
    # 否则返回主页面，让前端路由处理
    return render_template('index.html')