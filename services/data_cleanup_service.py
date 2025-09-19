"""
数据清理服务
处理数据库数据的清理和维护任务
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import func, and_, or_, text
from models.user import User
from models.game_record import GameRecord
from .base_service import BaseService, DatabaseError


logger = logging.getLogger(__name__)


class DataCleanupService(BaseService):
    """数据清理服务类"""
    
    def __init__(self):
        super().__init__()
        self.cleanup_stats = {
            'last_cleanup': None,
            'total_cleanups': 0,
            'records_cleaned': 0,
            'users_cleaned': 0,
            'errors': 0
        }
    
    def cleanup_old_game_records(self, retention_days: int = 365) -> Dict[str, Any]:
        """
        清理过期的游戏记录
        
        Args:
            retention_days: 数据保留天数
            
        Returns:
            Dict[str, Any]: 清理结果统计
        """
        operation_context = {
            'operation': 'cleanup_old_game_records',
            'retention_days': retention_days
        }
        
        try:
            with self.database_transaction():
                # 计算截止日期
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
                
                # 查找要删除的记录
                old_records = GameRecord.query.filter(
                    GameRecord.created_at < cutoff_date
                ).all()
                
                deleted_count = 0
                user_record_counts = {}
                
                for record in old_records:
                    # 统计每个用户的记录数
                    if record.user_id not in user_record_counts:
                        user_record_counts[record.user_id] = GameRecord.query.filter_by(
                            user_id=record.user_id
                        ).count()
                    
                    # 只有当用户有足够多的记录时才删除旧记录
                    # 确保每个用户至少保留一些记录
                    if user_record_counts[record.user_id] > 10:
                        self.db.session.delete(record)
                        deleted_count += 1
                        user_record_counts[record.user_id] -= 1
                
                # 更新统计信息
                self.cleanup_stats['records_cleaned'] += deleted_count
                self.cleanup_stats['last_cleanup'] = datetime.now(timezone.utc)
                
                result = {
                    'deleted_records': deleted_count,
                    'cutoff_date': cutoff_date.isoformat(),
                    'retention_days': retention_days,
                    'affected_users': len([uid for uid, count in user_record_counts.items() if count < GameRecord.query.filter_by(user_id=uid).count()])
                }
                
                self.log_operation('cleanup_old_game_records', result)
                return result
                
        except Exception as e:
            self.cleanup_stats['errors'] += 1
            self.handle_database_error(e, 'cleanup_old_game_records', operation_context)
            raise DatabaseError(f"清理旧游戏记录失败: {str(e)}", original_error=e)
    
    def cleanup_inactive_users(self, inactive_days: int = 180) -> Dict[str, Any]:
        """
        清理长期不活跃的用户
        
        Args:
            inactive_days: 不活跃天数阈值
            
        Returns:
            Dict[str, Any]: 清理结果统计
        """
        operation_context = {
            'operation': 'cleanup_inactive_users',
            'inactive_days': inactive_days
        }
        
        try:
            with self.database_transaction():
                # 计算截止日期
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=inactive_days)
                
                # 查找长期不活跃且没有游戏记录的用户
                inactive_users = User.query.filter(
                    and_(
                        User.last_active < cutoff_date,
                        ~User.id.in_(
                            self.db.session.query(GameRecord.user_id).distinct()
                        )
                    )
                ).all()
                
                deleted_count = 0
                for user in inactive_users:
                    # 确认用户确实没有游戏记录
                    game_count = GameRecord.query.filter_by(user_id=user.id).count()
                    if game_count == 0:
                        self.db.session.delete(user)
                        deleted_count += 1
                
                # 更新统计信息
                self.cleanup_stats['users_cleaned'] += deleted_count
                self.cleanup_stats['last_cleanup'] = datetime.now(timezone.utc)
                
                result = {
                    'deleted_users': deleted_count,
                    'cutoff_date': cutoff_date.isoformat(),
                    'inactive_days': inactive_days
                }
                
                self.log_operation('cleanup_inactive_users', result)
                return result
                
        except Exception as e:
            self.cleanup_stats['errors'] += 1
            self.handle_database_error(e, 'cleanup_inactive_users', operation_context)
            raise DatabaseError(f"清理不活跃用户失败: {str(e)}", original_error=e)
    
    def cleanup_duplicate_records(self) -> Dict[str, Any]:
        """
        清理重复的游戏记录
        
        Returns:
            Dict[str, Any]: 清理结果统计
        """
        operation_context = {'operation': 'cleanup_duplicate_records'}
        
        try:
            with self.database_transaction():
                # 查找可能的重复记录（同一用户在短时间内的相同得分）
                duplicate_query = self.db.session.query(
                    GameRecord.user_id,
                    GameRecord.score,
                    func.date(GameRecord.created_at).label('date'),
                    func.count(GameRecord.id).label('count')
                ).group_by(
                    GameRecord.user_id,
                    GameRecord.score,
                    func.date(GameRecord.created_at)
                ).having(func.count(GameRecord.id) > 1)
                
                duplicates = duplicate_query.all()
                deleted_count = 0
                
                for dup in duplicates:
                    # 获取该组的所有记录
                    records = GameRecord.query.filter(
                        and_(
                            GameRecord.user_id == dup.user_id,
                            GameRecord.score == dup.score,
                            func.date(GameRecord.created_at) == dup.date
                        )
                    ).order_by(GameRecord.created_at.desc()).all()
                    
                    # 保留最新的记录，删除其他的
                    if len(records) > 1:
                        for record in records[1:]:  # 跳过第一个（最新的）
                            self.db.session.delete(record)
                            deleted_count += 1
                
                # 更新统计信息
                self.cleanup_stats['records_cleaned'] += deleted_count
                self.cleanup_stats['last_cleanup'] = datetime.now(timezone.utc)
                
                result = {
                    'deleted_duplicates': deleted_count,
                    'duplicate_groups': len(duplicates)
                }
                
                self.log_operation('cleanup_duplicate_records', result)
                return result
                
        except Exception as e:
            self.cleanup_stats['errors'] += 1
            self.handle_database_error(e, 'cleanup_duplicate_records', operation_context)
            raise DatabaseError(f"清理重复记录失败: {str(e)}", original_error=e)
    
    def optimize_database(self) -> Dict[str, Any]:
        """
        优化数据库性能
        
        Returns:
            Dict[str, Any]: 优化结果统计
        """
        operation_context = {'operation': 'optimize_database'}
        
        try:
            with self.database_transaction():
                # 更新表统计信息
                optimization_results = {}
                
                # SQLite优化
                if 'sqlite' in str(self.db.engine.url):
                    # 执行VACUUM清理
                    self.db.session.execute(text("VACUUM"))
                    optimization_results['vacuum'] = 'completed'
                    
                    # 分析表以更新统计信息
                    self.db.session.execute(text("ANALYZE"))
                    optimization_results['analyze'] = 'completed'
                    
                    # 重建索引
                    self.db.session.execute(text("REINDEX"))
                    optimization_results['reindex'] = 'completed'
                
                # PostgreSQL优化（如果使用）
                elif 'postgresql' in str(self.db.engine.url):
                    # 更新表统计信息
                    self.db.session.execute(text("ANALYZE"))
                    optimization_results['analyze'] = 'completed'
                
                result = {
                    'optimization_results': optimization_results,
                    'database_type': str(self.db.engine.url).split('://')[0],
                    'completed_at': datetime.now(timezone.utc).isoformat()
                }
                
                self.log_operation('optimize_database', result)
                return result
                
        except Exception as e:
            self.cleanup_stats['errors'] += 1
            self.handle_database_error(e, 'optimize_database', operation_context)
            raise DatabaseError(f"数据库优化失败: {str(e)}", original_error=e)
    
    def get_database_size_info(self) -> Dict[str, Any]:
        """
        获取数据库大小信息
        
        Returns:
            Dict[str, Any]: 数据库大小统计
        """
        try:
            # 获取表记录数
            user_count = User.query.count()
            game_record_count = GameRecord.query.count()
            
            # 获取数据库文件大小（SQLite）
            size_info = {
                'user_count': user_count,
                'game_record_count': game_record_count,
                'total_records': user_count + game_record_count
            }
            
            # 尝试获取数据库文件大小
            try:
                import os
                if 'sqlite' in str(self.db.engine.url):
                    db_path = str(self.db.engine.url).replace('sqlite:///', '')
                    if os.path.exists(db_path):
                        size_info['database_file_size_bytes'] = os.path.getsize(db_path)
                        size_info['database_file_size_mb'] = round(size_info['database_file_size_bytes'] / (1024 * 1024), 2)
            except Exception as e:
                size_info['size_error'] = str(e)
            
            # 获取最旧和最新的记录时间
            try:
                oldest_record = GameRecord.query.order_by(GameRecord.created_at.asc()).first()
                newest_record = GameRecord.query.order_by(GameRecord.created_at.desc()).first()
                
                if oldest_record:
                    size_info['oldest_record'] = oldest_record.created_at.isoformat()
                if newest_record:
                    size_info['newest_record'] = newest_record.created_at.isoformat()
                    
                if oldest_record and newest_record:
                    time_span = newest_record.created_at - oldest_record.created_at
                    size_info['data_time_span_days'] = time_span.days
                    
            except Exception as e:
                size_info['time_span_error'] = str(e)
            
            return size_info
            
        except Exception as e:
            self.logger.error(f"获取数据库大小信息失败: {str(e)}")
            return {'error': str(e)}
    
    def run_full_cleanup(self, retention_days: int = 365, inactive_days: int = 180) -> Dict[str, Any]:
        """
        运行完整的数据清理流程
        
        Args:
            retention_days: 游戏记录保留天数
            inactive_days: 用户不活跃天数阈值
            
        Returns:
            Dict[str, Any]: 完整清理结果
        """
        cleanup_start = datetime.now(timezone.utc)
        results = {
            'start_time': cleanup_start.isoformat(),
            'operations': {}
        }
        
        try:
            # 1. 清理旧游戏记录
            try:
                old_records_result = self.cleanup_old_game_records(retention_days)
                results['operations']['old_records'] = old_records_result
            except Exception as e:
                results['operations']['old_records'] = {'error': str(e)}
            
            # 2. 清理重复记录
            try:
                duplicates_result = self.cleanup_duplicate_records()
                results['operations']['duplicates'] = duplicates_result
            except Exception as e:
                results['operations']['duplicates'] = {'error': str(e)}
            
            # 3. 清理不活跃用户
            try:
                inactive_users_result = self.cleanup_inactive_users(inactive_days)
                results['operations']['inactive_users'] = inactive_users_result
            except Exception as e:
                results['operations']['inactive_users'] = {'error': str(e)}
            
            # 4. 优化数据库
            try:
                optimize_result = self.optimize_database()
                results['operations']['optimization'] = optimize_result
            except Exception as e:
                results['operations']['optimization'] = {'error': str(e)}
            
            # 5. 获取清理后的数据库信息
            try:
                size_info = self.get_database_size_info()
                results['final_database_info'] = size_info
            except Exception as e:
                results['final_database_info'] = {'error': str(e)}
            
            # 更新统计信息
            self.cleanup_stats['total_cleanups'] += 1
            self.cleanup_stats['last_cleanup'] = cleanup_start
            
            cleanup_end = datetime.now(timezone.utc)
            results['end_time'] = cleanup_end.isoformat()
            results['duration_seconds'] = (cleanup_end - cleanup_start).total_seconds()
            results['cleanup_stats'] = self.cleanup_stats.copy()
            
            self.log_operation('run_full_cleanup', {
                'duration_seconds': results['duration_seconds'],
                'operations_count': len(results['operations'])
            })
            
            return results
            
        except Exception as e:
            self.cleanup_stats['errors'] += 1
            self.logger.error(f"完整清理流程失败: {str(e)}")
            results['error'] = str(e)
            results['end_time'] = datetime.now(timezone.utc).isoformat()
            return results
    
    def get_cleanup_stats(self) -> Dict[str, Any]:
        """
        获取清理统计信息
        
        Returns:
            Dict[str, Any]: 清理统计信息
        """
        stats = self.cleanup_stats.copy()
        
        # 添加格式化的时间信息
        if stats['last_cleanup']:
            stats['last_cleanup_formatted'] = stats['last_cleanup'].isoformat()
            stats['time_since_last_cleanup_hours'] = (
                datetime.now(timezone.utc) - stats['last_cleanup']
            ).total_seconds() / 3600
        
        return stats