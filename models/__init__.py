"""
数据模型包
包含所有数据模型类和数据库相关功能
"""

from .base import db
from .user import User
from .game_record import GameRecord

__all__ = ['db', 'User', 'GameRecord']