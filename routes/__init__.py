"""
路由包
包含所有Flask路由定义
"""

from .main_routes import main_bp
from .api_routes import api_bp

__all__ = ['main_bp', 'api_bp']