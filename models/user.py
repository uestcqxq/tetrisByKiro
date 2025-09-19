"""
用户数据模型
管理用户信息和相关操作
"""

from datetime import datetime, timezone
from .base import BaseModel, db


class User(BaseModel):
    """用户模型"""
    __tablename__ = 'users'
    
    username = db.Column(db.String(50), unique=True, nullable=False)
    last_active = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # 关系
    game_records = db.relationship('GameRecord', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.username}>'
    
    def update_last_active(self):
        """更新最后活跃时间"""
        self.last_active = datetime.now(timezone.utc)
        db.session.commit()
    
    def get_best_score(self):
        """获取用户最高得分"""
        if not self.game_records:
            return 0
        return max(record.score for record in self.game_records)
    
    def get_total_games(self):
        """获取用户总游戏次数"""
        return len(self.game_records)