"""
游戏服务
处理游戏相关的业务逻辑
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy import func, desc, and_
from models.game_record import GameRecord
from models.user import User
from .base_service import BaseService, ValidationError, DatabaseError


class GameService(BaseService):
    """游戏服务类"""
    
    # 游戏数据验证常量
    MIN_SCORE = 0
    MAX_SCORE = 999999999  # 最大得分限制
    MIN_LEVEL = 1
    MAX_LEVEL = 99  # 最大级别限制
    MIN_LINES = 0
    MAX_LINES = 9999  # 最大消除行数限制
    MIN_DURATION = 1  # 最小游戏时长（秒）
    MAX_DURATION = 7200  # 最大游戏时长（2小时）
    
    def save_game_score(self, user_id: str, score: int, level: int, 
                       lines_cleared: int, game_duration: int) -> GameRecord:
        """
        保存游戏得分
        
        Args:
            user_id: 用户ID
            score: 游戏得分
            level: 达到的级别
            lines_cleared: 消除的行数
            game_duration: 游戏时长（秒）
            
        Returns:
            GameRecord: 保存的游戏记录
            
        Raises:
            ValidationError: 如果用户不存在或数据无效
            DatabaseError: 如果数据库操作失败
        """
        operation_context = {
            'operation': 'save_game_score',
            'user_id': user_id,
            'score': score,
            'level': level,
            'lines_cleared': lines_cleared,
            'game_duration': game_duration
        }
        
        try:
            with self.database_transaction():
                # 验证必需字段
                self.validate_required_fields({
                    'user_id': user_id,
                    'score': score,
                    'level': level,
                    'lines_cleared': lines_cleared,
                    'game_duration': game_duration
                }, ['user_id', 'score', 'level', 'lines_cleared', 'game_duration'])
                
                # 验证用户存在
                user = User.get_by_id(user_id)
                if not user:
                    raise ValidationError(f"用户 {user_id} 不存在", field='user_id', value=user_id)
                
                # 验证数据有效性
                self._validate_game_data(score, level, lines_cleared, game_duration)
                
                # 检查用户游戏记录数量限制
                from flask import current_app
                max_records = current_app.config.get('MAX_GAME_RECORDS_PER_USER', 1000)
                user_record_count = GameRecord.query.filter_by(user_id=user_id).count()
                
                if user_record_count >= max_records:
                    # 删除最旧的记录
                    oldest_record = GameRecord.query.filter_by(user_id=user_id).order_by(
                        GameRecord.created_at.asc()
                    ).first()
                    if oldest_record:
                        self.db.session.delete(oldest_record)
                        self.logger.info(f"删除用户 {user_id} 的最旧游戏记录以保持限制")
                
                # 创建游戏记录
                game_record = GameRecord(
                    user_id=user_id,
                    score=score,
                    level=level,
                    lines_cleared=lines_cleared,
                    game_duration=game_duration
                )
                
                game_record.save()
                
                # 更新用户活跃时间
                user.update_last_active()
                
                self.log_operation('save_game_score', {
                    'game_id': game_record.id,
                    'user_id': user_id,
                    'score': score
                })
                
                return game_record
                
        except ValidationError as e:
            self.log_operation('save_game_score_validation_failed', operation_context, level='warning')
            raise e
        except Exception as e:
            self.handle_database_error(e, 'save_game_score', operation_context)
            raise DatabaseError(f"保存游戏得分失败: {str(e)}", original_error=e)
    
    def _validate_game_data(self, score: int, level: int, 
                           lines_cleared: int, game_duration: int) -> None:
        """
        验证游戏数据的有效性
        
        Args:
            score: 游戏得分
            level: 达到的级别
            lines_cleared: 消除的行数
            game_duration: 游戏时长
            
        Raises:
            ValidationError: 如果数据无效
        """
        # 验证得分
        self.validate_field_type(score, int, 'score')
        self.validate_field_range(score, self.MIN_SCORE, self.MAX_SCORE, 'score')
        
        # 验证级别
        self.validate_field_type(level, int, 'level')
        self.validate_field_range(level, self.MIN_LEVEL, self.MAX_LEVEL, 'level')
        
        # 验证消除行数
        self.validate_field_type(lines_cleared, int, 'lines_cleared')
        self.validate_field_range(lines_cleared, self.MIN_LINES, self.MAX_LINES, 'lines_cleared')
        
        # 验证游戏时长
        self.validate_field_type(game_duration, int, 'game_duration')
        self.validate_field_range(game_duration, self.MIN_DURATION, self.MAX_DURATION, 'game_duration')
        
        # 逻辑验证：得分应该与级别和消除行数相关
        if score > 0 and lines_cleared == 0:
            raise ValidationError("有得分但没有消除行数，数据不合理", field='lines_cleared', value=lines_cleared)
        
        # 放宽级别与消除行数的验证，允许更灵活的游戏进度
        # 只检查极端不合理的情况：高级别但消除行数过少
        if level > 10 and lines_cleared < 10:
            raise ValidationError("级别与消除行数不匹配", field='level', value=level)
    
    def get_leaderboard(self, limit: int = 10, offset: int = 0) -> List[Dict]:
        """
        获取排行榜
        
        Args:
            limit: 返回记录数量限制
            offset: 偏移量，用于分页
            
        Returns:
            List[Dict]: 排行榜数据，包含用户信息
        """
        try:
            # 获取每个用户的最高得分记录
            subquery = self.db.session.query(
                GameRecord.user_id,
                func.max(GameRecord.score).label('max_score')
            ).group_by(GameRecord.user_id).subquery()
            
            # 获取完整的游戏记录信息
            records = self.db.session.query(
                GameRecord, User
            ).join(
                subquery, 
                and_(
                    GameRecord.user_id == subquery.c.user_id,
                    GameRecord.score == subquery.c.max_score
                )
            ).join(
                User, GameRecord.user_id == User.id
            ).order_by(
                desc(GameRecord.score)
            ).offset(offset).limit(limit).all()
            
            # 构建排行榜数据
            leaderboard = []
            for i, (record, user) in enumerate(records, start=offset + 1):
                leaderboard.append({
                    'rank': i,
                    'user_id': user.id,
                    'username': user.username,
                    'score': record.score,
                    'level': record.level,
                    'lines_cleared': record.lines_cleared,
                    'game_duration': record.game_duration,
                    'achieved_at': record.created_at.isoformat()
                })
            
            return leaderboard
            
        except Exception as e:
            print(f"获取排行榜失败: {str(e)}")
            return []
    
    def get_user_rank(self, user_id: str) -> Optional[Dict]:
        """
        获取用户排名信息
        
        Args:
            user_id: 用户ID
            
        Returns:
            Optional[Dict]: 用户排名信息，如果用户没有游戏记录则返回None
        """
        try:
            # 获取用户最高得分
            user_best = self.db.session.query(
                func.max(GameRecord.score)
            ).filter_by(user_id=user_id).scalar()
            
            if user_best is None:
                return None
            
            # 计算排名（比用户得分高的用户数量 + 1）
            better_scores_count = self.db.session.query(
                func.count(func.distinct(GameRecord.user_id))
            ).filter(
                GameRecord.score > user_best
            ).scalar()
            
            rank = better_scores_count + 1
            
            # 获取总用户数（有游戏记录的用户）
            total_users = self.db.session.query(
                func.count(func.distinct(GameRecord.user_id))
            ).scalar()
            
            # 获取用户信息
            user = User.get_by_id(user_id)
            
            return {
                'user_id': user_id,
                'username': user.username if user else 'Unknown',
                'rank': rank,
                'total_users': total_users,
                'best_score': user_best,
                'percentile': round((total_users - rank + 1) / total_users * 100, 1) if total_users > 0 else 0
            }
            
        except Exception as e:
            print(f"获取用户排名失败 (ID: {user_id}): {str(e)}")
            return None
    
    def get_user_best_score(self, user_id: str) -> int:
        """
        获取用户最高得分
        
        Args:
            user_id: 用户ID
            
        Returns:
            int: 用户最高得分，如果没有记录则返回0
        """
        try:
            best_score = self.db.session.query(
                func.max(GameRecord.score)
            ).filter_by(user_id=user_id).scalar()
            
            return best_score or 0
            
        except Exception as e:
            print(f"获取用户最高得分失败 (ID: {user_id}): {str(e)}")
            return 0
    
    def get_user_game_history(self, user_id: str, limit: int = 10, 
                             offset: int = 0) -> List[GameRecord]:
        """
        获取用户游戏历史
        
        Args:
            user_id: 用户ID
            limit: 返回记录数量限制
            offset: 偏移量，用于分页
            
        Returns:
            List[GameRecord]: 用户游戏记录列表
        """
        try:
            return GameRecord.query.filter_by(
                user_id=user_id
            ).order_by(
                GameRecord.created_at.desc()
            ).offset(offset).limit(limit).all()
            
        except Exception as e:
            print(f"获取用户游戏历史失败 (ID: {user_id}): {str(e)}")
            return []
    
    def get_user_statistics(self, user_id: str) -> Dict:
        """
        获取用户游戏统计信息
        
        Args:
            user_id: 用户ID
            
        Returns:
            Dict: 用户统计信息
        """
        try:
            # 基础统计查询
            stats_query = self.db.session.query(
                func.count(GameRecord.id).label('total_games'),
                func.max(GameRecord.score).label('best_score'),
                func.avg(GameRecord.score).label('avg_score'),
                func.sum(GameRecord.lines_cleared).label('total_lines'),
                func.sum(GameRecord.game_duration).label('total_time'),
                func.max(GameRecord.level).label('max_level')
            ).filter_by(user_id=user_id).first()
            
            if not stats_query or stats_query.total_games == 0:
                return {
                    'user_id': user_id,
                    'total_games': 0,
                    'best_score': 0,
                    'average_score': 0,
                    'total_lines_cleared': 0,
                    'total_play_time': 0,
                    'max_level_reached': 0,
                    'average_game_duration': 0,
                    'games_this_week': 0,
                    'improvement_trend': 'no_data'
                }
            
            # 计算本周游戏数量
            week_ago = datetime.now(timezone.utc) - timedelta(days=7)
            games_this_week = GameRecord.query.filter(
                and_(
                    GameRecord.user_id == user_id,
                    GameRecord.created_at >= week_ago
                )
            ).count()
            
            # 计算进步趋势（比较最近5局和之前5局的平均得分）
            recent_games = GameRecord.query.filter_by(
                user_id=user_id
            ).order_by(
                GameRecord.created_at.desc()
            ).limit(5).all()
            
            previous_games = GameRecord.query.filter_by(
                user_id=user_id
            ).order_by(
                GameRecord.created_at.desc()
            ).offset(5).limit(5).all()
            
            improvement_trend = 'stable'
            if len(recent_games) >= 3 and len(previous_games) >= 3:
                recent_avg = sum(g.score for g in recent_games) / len(recent_games)
                previous_avg = sum(g.score for g in previous_games) / len(previous_games)
                
                if recent_avg > previous_avg * 1.1:
                    improvement_trend = 'improving'
                elif recent_avg < previous_avg * 0.9:
                    improvement_trend = 'declining'
            
            return {
                'user_id': user_id,
                'total_games': stats_query.total_games,
                'best_score': stats_query.best_score or 0,
                'average_score': round(float(stats_query.avg_score or 0), 1),
                'total_lines_cleared': stats_query.total_lines or 0,
                'total_play_time': stats_query.total_time or 0,
                'max_level_reached': stats_query.max_level or 0,
                'average_game_duration': round(
                    (stats_query.total_time or 0) / stats_query.total_games, 1
                ),
                'games_this_week': games_this_week,
                'improvement_trend': improvement_trend
            }
            
        except Exception as e:
            print(f"获取用户统计信息失败 (ID: {user_id}): {str(e)}")
            return {}
    
    def get_global_statistics(self) -> Dict:
        """
        获取全局游戏统计信息
        
        Returns:
            Dict: 全局统计信息
        """
        try:
            # 基础统计
            basic_stats = self.db.session.query(
                func.count(GameRecord.id).label('total_games'),
                func.count(func.distinct(GameRecord.user_id)).label('total_players'),
                func.max(GameRecord.score).label('highest_score'),
                func.avg(GameRecord.score).label('avg_score'),
                func.sum(GameRecord.lines_cleared).label('total_lines'),
                func.sum(GameRecord.game_duration).label('total_time')
            ).first()
            
            # 今日统计
            today = datetime.now(timezone.utc).date()
            today_stats = self.db.session.query(
                func.count(GameRecord.id).label('games_today'),
                func.count(func.distinct(GameRecord.user_id)).label('active_players_today')
            ).filter(
                func.date(GameRecord.created_at) == today
            ).first()
            
            # 本周统计
            week_ago = datetime.now(timezone.utc) - timedelta(days=7)
            week_stats = self.db.session.query(
                func.count(GameRecord.id).label('games_this_week'),
                func.count(func.distinct(GameRecord.user_id)).label('active_players_week')
            ).filter(
                GameRecord.created_at >= week_ago
            ).first()
            
            return {
                'total_games': basic_stats.total_games or 0,
                'total_players': basic_stats.total_players or 0,
                'highest_score': basic_stats.highest_score or 0,
                'average_score': round(float(basic_stats.avg_score or 0), 1),
                'total_lines_cleared': basic_stats.total_lines or 0,
                'total_play_time_hours': round((basic_stats.total_time or 0) / 3600, 1),
                'games_today': today_stats.games_today or 0,
                'active_players_today': today_stats.active_players_today or 0,
                'games_this_week': week_stats.games_this_week or 0,
                'active_players_this_week': week_stats.active_players_week or 0
            }
            
        except Exception as e:
            print(f"获取全局统计信息失败: {str(e)}")
            return {}
    
    def get_level_distribution(self) -> Dict[int, int]:
        """
        获取级别分布统计
        
        Returns:
            Dict[int, int]: 级别到达次数的分布
        """
        try:
            distribution = {}
            
            # 获取每个级别的达到次数
            level_counts = self.db.session.query(
                GameRecord.level,
                func.count(GameRecord.id).label('count')
            ).group_by(GameRecord.level).all()
            
            for level, count in level_counts:
                distribution[level] = count
            
            return distribution
            
        except Exception as e:
            print(f"获取级别分布失败: {str(e)}")
            return {}
    
    def delete_user_games(self, user_id: str) -> bool:
        """
        删除用户的所有游戏记录
        
        Args:
            user_id: 用户ID
            
        Returns:
            bool: 删除是否成功
        """
        try:
            deleted_count = GameRecord.query.filter_by(user_id=user_id).delete()
            self.commit_transaction()
            
            print(f"删除了用户 {user_id} 的 {deleted_count} 条游戏记录")
            return True
            
        except Exception as e:
            print(f"删除用户游戏记录失败 (ID: {user_id}): {str(e)}")
            self.rollback_transaction()
            return False