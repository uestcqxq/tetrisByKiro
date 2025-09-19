"""
数据库迁移脚本
处理数据库架构变更和数据迁移
"""

import os
import sqlite3
from datetime import datetime
from flask import Flask
from models import db, User, GameRecord


class DatabaseMigration:
    """数据库迁移管理器"""
    
    def __init__(self, app=None):
        self.app = app
        self.migrations = []
        self._register_migrations()
    
    def _register_migrations(self):
        """注册所有迁移"""
        self.migrations = [
            {
                'version': '001',
                'name': 'create_initial_tables',
                'description': '创建初始用户和游戏记录表',
                'up': self._migration_001_up,
                'down': self._migration_001_down
            },
            {
                'version': '002',
                'name': 'add_indexes',
                'description': '添加性能优化索引',
                'up': self._migration_002_up,
                'down': self._migration_002_down
            }
        ]
    
    def _migration_001_up(self):
        """迁移001：创建初始表"""
        from sqlalchemy import text
        
        with db.engine.connect() as conn:
            # 创建用户表
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(36) PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            # 创建游戏记录表
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS game_records (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    score INTEGER NOT NULL,
                    level INTEGER NOT NULL,
                    lines_cleared INTEGER NOT NULL,
                    game_duration INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """))
            
            conn.commit()
        
        print("✓ 创建了用户表和游戏记录表")
    
    def _migration_001_down(self):
        """回滚迁移001"""
        from sqlalchemy import text
        
        with db.engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS game_records"))
            conn.execute(text("DROP TABLE IF EXISTS users"))
            conn.commit()
        
        print("✓ 删除了用户表和游戏记录表")
    
    def _migration_002_up(self):
        """迁移002：添加索引"""
        from sqlalchemy import text
        
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_game_records_score ON game_records(score DESC)",
            "CREATE INDEX IF NOT EXISTS idx_game_records_user_id ON game_records(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_game_records_created_at ON game_records(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
            "CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active DESC)"
        ]
        
        with db.engine.connect() as conn:
            for index_sql in indexes:
                conn.execute(text(index_sql))
            conn.commit()
        
        print("✓ 创建了性能优化索引")
    
    def _migration_002_down(self):
        """回滚迁移002"""
        from sqlalchemy import text
        
        indexes = [
            "DROP INDEX IF EXISTS idx_game_records_score",
            "DROP INDEX IF EXISTS idx_game_records_user_id", 
            "DROP INDEX IF EXISTS idx_game_records_created_at",
            "DROP INDEX IF EXISTS idx_users_username",
            "DROP INDEX IF EXISTS idx_users_last_active"
        ]
        
        with db.engine.connect() as conn:
            for index_sql in indexes:
                conn.execute(text(index_sql))
            conn.commit()
        
        print("✓ 删除了性能优化索引")
    
    def create_migration_table(self):
        """创建迁移记录表"""
        from sqlalchemy import text
        
        with db.engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(10) PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
    
    def get_applied_migrations(self):
        """获取已应用的迁移"""
        from sqlalchemy import text
        
        try:
            with db.engine.connect() as conn:
                result = conn.execute(
                    text("SELECT version FROM schema_migrations ORDER BY version")
                ).fetchall()
                return [row[0] for row in result]
        except:
            return []
    
    def mark_migration_applied(self, migration):
        """标记迁移为已应用"""
        from sqlalchemy import text
        
        with db.engine.connect() as conn:
            conn.execute(
                text("INSERT INTO schema_migrations (version, name) VALUES (:version, :name)"),
                {"version": migration['version'], "name": migration['name']}
            )
            conn.commit()
    
    def mark_migration_reverted(self, migration):
        """标记迁移为已回滚"""
        from sqlalchemy import text
        
        with db.engine.connect() as conn:
            conn.execute(
                text("DELETE FROM schema_migrations WHERE version = :version"),
                {"version": migration['version']}
            )
            conn.commit()
    
    def migrate_up(self, target_version=None):
        """执行向上迁移"""
        if not self.app:
            raise ValueError("需要Flask应用实例")
        
        with self.app.app_context():
            self.create_migration_table()
            applied = self.get_applied_migrations()
            
            for migration in self.migrations:
                if migration['version'] in applied:
                    continue
                
                if target_version and migration['version'] > target_version:
                    break
                
                print(f"应用迁移 {migration['version']}: {migration['description']}")
                migration['up']()
                self.mark_migration_applied(migration)
                print(f"✓ 迁移 {migration['version']} 应用成功")
    
    def migrate_down(self, target_version):
        """执行向下迁移（回滚）"""
        if not self.app:
            raise ValueError("需要Flask应用实例")
        
        with self.app.app_context():
            applied = self.get_applied_migrations()
            
            # 按版本倒序回滚
            for migration in reversed(self.migrations):
                if migration['version'] not in applied:
                    continue
                
                if migration['version'] <= target_version:
                    break
                
                print(f"回滚迁移 {migration['version']}: {migration['description']}")
                migration['down']()
                self.mark_migration_reverted(migration)
                print(f"✓ 迁移 {migration['version']} 回滚成功")
    
    def get_migration_status(self):
        """获取迁移状态"""
        if not self.app:
            raise ValueError("需要Flask应用实例")
        
        with self.app.app_context():
            self.create_migration_table()
            applied = self.get_applied_migrations()
            
            print("迁移状态:")
            print("-" * 50)
            
            for migration in self.migrations:
                status = "✓ 已应用" if migration['version'] in applied else "✗ 未应用"
                print(f"{migration['version']}: {migration['name']} - {status}")
            
            return applied


def create_app_for_migration():
    """为迁移创建应用实例"""
    from app import create_app
    return create_app()


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python migrations.py [up|down|status] [version]")
        print("命令:")
        print("  up [version]    - 执行向上迁移到指定版本（默认最新）")
        print("  down <version>  - 回滚到指定版本")
        print("  status          - 显示迁移状态")
        sys.exit(1)
    
    command = sys.argv[1]
    app = create_app_for_migration()
    migrator = DatabaseMigration(app)
    
    if command == 'up':
        target_version = sys.argv[2] if len(sys.argv) > 2 else None
        migrator.migrate_up(target_version)
    elif command == 'down':
        if len(sys.argv) < 3:
            print("回滚命令需要指定目标版本")
            sys.exit(1)
        target_version = sys.argv[2]
        migrator.migrate_down(target_version)
    elif command == 'status':
        migrator.get_migration_status()
    else:
        print(f"未知命令: {command}")