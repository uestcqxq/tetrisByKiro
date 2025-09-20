"""
用户管理服务
处理用户相关的业务逻辑
"""

import random
import string
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from models.user import User
from .base_service import BaseService, ValidationError, DatabaseError


class UserService(BaseService):
    """用户服务类"""
    
    # 用户名生成配置
    USERNAME_PREFIXES = [
        "Player", "Gamer", "Tetris", "Block", "Master", "Pro", "Star", "Hero"
    ]
    USERNAME_ADJECTIVES = [
        "Swift", "Smart", "Cool", "Fast", "Epic", "Super", "Mega", "Ultra"
    ]
    
    def generate_unique_username(self, max_attempts: int = 100) -> str:
        """
        生成唯一的随机用户名
        
        Args:
            max_attempts: 最大尝试次数，防止无限循环
            
        Returns:
            str: 唯一的用户名
            
        Raises:
            RuntimeError: 如果无法在指定次数内生成唯一用户名
        """
        for attempt in range(max_attempts):
            username = self._generate_random_username()
            
            # 检查用户名是否已存在
            if not User.query.filter_by(username=username).first():
                return username
        
        # 如果常规方法失败，使用UUID后缀确保唯一性
        base_name = random.choice(self.USERNAME_PREFIXES)
        unique_suffix = str(uuid.uuid4())[:8]
        return f"{base_name}_{unique_suffix}"
    
    def _generate_random_username(self) -> str:
        """生成随机用户名（不保证唯一性）"""
        generation_method = random.choice([1, 2, 3])
        
        if generation_method == 1:
            # 方法1：前缀 + 4位随机字符
            prefix = random.choice(self.USERNAME_PREFIXES)
            suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
            return f"{prefix}_{suffix}"
        
        elif generation_method == 2:
            # 方法2：形容词 + 前缀 + 数字
            adjective = random.choice(self.USERNAME_ADJECTIVES)
            prefix = random.choice(self.USERNAME_PREFIXES)
            number = random.randint(10, 999)
            return f"{adjective}{prefix}{number}"
        
        else:
            # 方法3：前缀 + 随机数字
            prefix = random.choice(self.USERNAME_PREFIXES)
            number = random.randint(1000, 9999)
            return f"{prefix}{number}"
    
    def create_user(self, username: Optional[str] = None) -> User:
        """
        创建新用户
        
        Args:
            username: 可选的用户名，如果不提供则自动生成
            
        Returns:
            User: 创建的用户对象
            
        Raises:
            ValidationError: 如果用户名格式无效
            DatabaseError: 如果数据库操作失败
        """
        operation_context = {'operation': 'create_user', 'username': username}
        
        try:
            with self.database_transaction():
                if username is None:
                    username = self.generate_unique_username()
                else:
                    # 先验证用户名格式
                    if not self._validate_username(username):
                        raise ValidationError(f"用户名格式无效: {username}", field='username', value=username)
                    
                    # 清理用户名
                    username = self.sanitize_string(username, max_length=50)
                    
                    # 检查用户名是否已存在
                    existing_user = User.query.filter_by(username=username).first()
                    if existing_user:
                        raise ValidationError(f"用户名 {username} 已存在", field='username', value=username)
                
                # 创建用户
                user = User(username=username)
                user.save()
                
                self.log_operation('create_user', {'user_id': user.id, 'username': username})
                return user
                
        except ValidationError as e:
            self.log_operation('create_user_validation_failed', operation_context, level='warning')
            raise e
        except Exception as e:
            self.handle_database_error(e, 'create_user', operation_context)
            raise DatabaseError(f"创建用户失败: {str(e)}", original_error=e)
    
    def _validate_username(self, username: str) -> bool:
        """
        验证用户名格式
        
        Args:
            username: 要验证的用户名
            
        Returns:
            bool: 用户名是否有效
        """
        if not username or len(username.strip()) == 0:
            return False
        
        # 长度检查
        if len(username) < 3 or len(username) > 50:
            return False
        
        # 字符检查：只允许字母、数字、下划线
        allowed_chars = string.ascii_letters + string.digits + '_'
        if not all(c in allowed_chars for c in username):
            return False
        
        # 不能以数字开头
        if username[0].isdigit():
            return False
        
        return True
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """
        根据ID获取用户
        
        Args:
            user_id: 用户ID
            
        Returns:
            Optional[User]: 用户对象，如果不存在则返回None
        """
        if not user_id:
            return None
        
        try:
            return User.get_by_id(user_id)
        except Exception as e:
            print(f"获取用户失败 (ID: {user_id}): {str(e)}")
            return None
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        """
        根据用户名获取用户
        
        Args:
            username: 用户名
            
        Returns:
            Optional[User]: 用户对象，如果不存在则返回None
        """
        if not username:
            return None
        
        try:
            return User.query.filter_by(username=username).first()
        except Exception as e:
            print(f"获取用户失败 (用户名: {username}): {str(e)}")
            return None
    
    def update_user_activity(self, user_id: str) -> Optional[User]:
        """
        更新用户活跃时间
        
        Args:
            user_id: 用户ID
            
        Returns:
            Optional[User]: 更新后的用户对象
        """
        try:
            user = self.get_user_by_id(user_id)
            if user:
                user.update_last_active()
                return user
            return None
        except Exception as e:
            print(f"更新用户活跃时间失败 (ID: {user_id}): {str(e)}")
            self.rollback_transaction()
            return None
    
    def get_all_users(self, limit: int = 100) -> List[User]:
        """
        获取所有用户列表
        
        Args:
            limit: 返回用户数量限制
            
        Returns:
            List[User]: 用户列表
        """
        try:
            return User.query.order_by(User.created_at.desc()).limit(limit).all()
        except Exception as e:
            print(f"获取用户列表失败: {str(e)}")
            return []
    
    def get_active_users(self, days: int = 7, limit: int = 50) -> List[User]:
        """
        获取活跃用户列表
        
        Args:
            days: 活跃天数范围
            limit: 返回用户数量限制
            
        Returns:
            List[User]: 活跃用户列表
        """
        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
            
            return User.query.filter(
                User.last_active >= cutoff_date
            ).order_by(
                User.last_active.desc()
            ).limit(limit).all()
            
        except Exception as e:
            print(f"获取活跃用户失败: {str(e)}")
            return []
    
    def delete_user(self, user_id: str) -> bool:
        """
        删除用户（软删除，保留游戏记录）
        
        Args:
            user_id: 用户ID
            
        Returns:
            bool: 删除是否成功
        """
        try:
            user = self.get_user_by_id(user_id)
            if not user:
                return False
            
            # 注意：这里不直接删除用户，而是标记为已删除
            # 保留游戏记录的完整性
            user.username = f"deleted_user_{user.id[:8]}"
            user.save()
            
            return True
            
        except Exception as e:
            print(f"删除用户失败 (ID: {user_id}): {str(e)}")
            self.rollback_transaction()
            return False
    
    def get_user_statistics(self, user_id: str) -> dict:
        """
        获取用户统计信息
        
        Args:
            user_id: 用户ID
            
        Returns:
            dict: 用户统计信息
        """
        try:
            user = self.get_user_by_id(user_id)
            if not user:
                return {}
            
            return {
                'user_id': user.id,
                'username': user.username,
                'created_at': user.created_at.isoformat(),
                'last_active': user.last_active.isoformat(),
                'total_games': user.get_total_games(),
                'best_score': user.get_best_score()
            }
            
        except Exception as e:
            print(f"获取用户统计失败 (ID: {user_id}): {str(e)}")
            return {}