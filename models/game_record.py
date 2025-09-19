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
        """获取用户排名"""
        user_best_score = cls.query.filter_by(user_id=user_id).order_by(cls.score.desc()).first()
        if not user_best_score:
            return None
        
        better_scores = cls.query.filter(cls.score > user_best_score.score).count()
        return better_scores + 1