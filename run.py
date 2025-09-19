"""
应用启动脚本
用于开发环境启动Flask应用
"""

import os
from app import create_app, db, socketio

# 创建应用实例
app = create_app()

if __name__ == '__main__':
    # 创建数据库表
    with app.app_context():
        db.create_all()
    
    # 开发环境启动
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)