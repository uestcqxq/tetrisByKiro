"""
游戏记录数据模型
管理游戏得分和统计信息
"""

from .base import BaseModel, db


class GameRecord(BaseModel):
    """游戏记录模型"""
    __tablename__ = 'game_records'
    
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    score = db.Column(db.Integer, nullable=False)
    level = db.Column(db.Integer, nullable=False)
    lines_cleared = db.Column(db.Integer, nullable=False)
    game_duration = db.Column(db.Integer, nullable=False)  # 游戏时长（秒）
    
    def __repr__(self):
        return f'<GameRecord {self.score} points by user {self.user_id}>'
    
    @classmethod
    def get_leaderboard(cls, limit=10):
        """获取排行榜"""
        return cls.query.order_by(cls.score.desc()).limit(limit).all()
    
    @classmethod
    def get_user_rank(cls, user_id):
        """获取用户排名，考虑同分情况"""
        # 获取用户的最高得分
        user_record = cls.query.filter_by(user_id=user_id).order_by(cls.score.desc()).first()
        if not user_record:
            return None
        
        # 计算排名 - 简化逻辑，直接计算有多少用户得分更高
        higher_score_count = cls.query.filter(cls.score > user_record.score).count()
        
        # 排名 = 得分更高的记录数 + 1
        rank = higher_score_count + 1
        
        return rank