"""
数据库初始化和管理脚本
提供数据库创建、迁移和管理功能
"""

import os
import sqlite3
from flask import Flask
from models import db, User, GameRecord
from config import config


def create_app(config_name=None):
    """创建Flask应用实例"""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # 初始化数据库
    db.init_app(app)
    
    return app


def init_database(app=None):
    """初始化数据库，创建所有表"""
    if app is None:
        app = create_app()
    
    with app.app_context():
        # 创建所有表
        db.create_all()
        print("数据库表创建成功！")
        
        # 创建索引
        create_indexes()
        print("数据库索引创建成功！")


def create_indexes():
    """创建数据库索引以优化查询性能"""
    try:
        from sqlalchemy import text
        
        # 为game_records表创建索引
        with db.engine.connect() as conn:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_game_records_score 
                ON game_records(score DESC)
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_game_records_user_id 
                ON game_records(user_id)
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_game_records_created_at 
                ON game_records(created_at DESC)
            """))
            
            # 为users表创建索引
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_users_username 
                ON users(username)
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_users_last_active 
                ON users(last_active DESC)
            """))
            
            conn.commit()
        
    except Exception as e:
        print(f"创建索引时出错: {e}")


def drop_database(app=None):
    """删除所有数据库表"""
    if app is None:
        app = create_app()
    
    with app.app_context():
        db.drop_all()
        print("数据库表删除成功！")


def reset_database(app=None):
    """重置数据库（删除后重新创建）"""
    if app is None:
        app = create_app()
    
    print("正在重置数据库...")
    drop_database(app)
    init_database(app)
    print("数据库重置完成！")


def create_sample_data(app=None):
    """创建示例数据用于测试"""
    if app is None:
        app = create_app()
    
    with app.app_context():
        # 创建示例用户
        sample_users = [
            User(username="player1"),
            User(username="player2"),
            User(username="player3"),
        ]
        
        for user in sample_users:
            db.session.add(user)
        
        db.session.commit()
        
        # 创建示例游戏记录
        sample_records = [
            GameRecord(
                user_id=sample_users[0].id,
                score=15000,
                level=8,
                lines_cleared=25,
                game_duration=300
            ),
            GameRecord(
                user_id=sample_users[1].id,
                score=12000,
                level=6,
                lines_cleared=20,
                game_duration=250
            ),
            GameRecord(
                user_id=sample_users[2].id,
                score=8000,
                level=4,
                lines_cleared=15,
                game_duration=200
            ),
            GameRecord(
                user_id=sample_users[0].id,
                score=18000,
                level=10,
                lines_cleared=30,
                game_duration=400
            ),
        ]
        
        for record in sample_records:
            db.session.add(record)
        
        db.session.commit()
        print("示例数据创建成功！")


def check_database_connection(app=None):
    """检查数据库连接状态"""
    if app is None:
        app = create_app()
    
    try:
        with app.app_context():
            from sqlalchemy import text
            # 尝试执行简单查询
            with db.engine.connect() as conn:
                result = conn.execute(text("SELECT 1")).fetchone()
                if result:
                    print("数据库连接正常！")
                    return True
    except Exception as e:
        print(f"数据库连接失败: {e}")
        return False


def get_database_info(app=None):
    """获取数据库信息"""
    if app is None:
        app = create_app()
    
    with app.app_context():
        try:
            # 获取用户数量
            user_count = User.query.count()
            
            # 获取游戏记录数量
            game_count = GameRecord.query.count()
            
            # 获取最高分
            from sqlalchemy import func
            highest_score = db.session.query(func.max(GameRecord.score)).scalar() or 0
            
            print(f"数据库信息:")
            print(f"- 用户数量: {user_count}")
            print(f"- 游戏记录数量: {game_count}")
            print(f"- 最高分: {highest_score}")
            
            return {
                'user_count': user_count,
                'game_count': game_count,
                'highest_score': highest_score
            }
            
        except Exception as e:
            print(f"获取数据库信息失败: {e}")
            return None


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python database.py [init|drop|reset|sample|check|info]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'init':
        init_database()
    elif command == 'drop':
        drop_database()
    elif command == 'reset':
        reset_database()
    elif command == 'sample':
        create_sample_data()
    elif command == 'check':
        check_database_connection()
    elif command == 'info':
        get_database_info()
    else:
        print(f"未知命令: {command}")
        print("可用命令: init, drop, reset, sample, check, info")