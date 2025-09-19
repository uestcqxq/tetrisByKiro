"""
测试积分和难度系统
"""
import pytest
import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_scoring_system_integration():
    """测试积分系统集成"""
    # 这是一个占位符测试，因为我们的积分系统是JavaScript实现的
    # 在实际项目中，我们可以使用Node.js或浏览器自动化工具来测试JavaScript代码
    
    # 验证文件存在
    scoring_system_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'js', 'scoring-system.js')
    difficulty_manager_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'js', 'difficulty-manager.js')
    ui_manager_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'js', 'ui-manager.js')
    
    assert os.path.exists(scoring_system_file), "ScoringSystem文件不存在"
    assert os.path.exists(difficulty_manager_file), "DifficultyManager文件不存在"
    assert os.path.exists(ui_manager_file), "UIManager文件不存在"
    
    # 验证文件内容包含关键类定义
    with open(scoring_system_file, 'r', encoding='utf-8') as f:
        scoring_content = f.read()
        assert 'class ScoringSystem' in scoring_content
        assert 'processLineClears' in scoring_content
        assert 'calculateLineScore' in scoring_content
    
    with open(difficulty_manager_file, 'r', encoding='utf-8') as f:
        difficulty_content = f.read()
        assert 'class DifficultyManager' in difficulty_content
        assert 'processLinesCleared' in difficulty_content
        assert 'updateDropSpeed' in difficulty_content
    
    with open(ui_manager_file, 'r', encoding='utf-8') as f:
        ui_content = f.read()
        assert 'class UIManager' in ui_content
        assert 'showScoreAnimation' in ui_content
        assert 'updateDifficultyIndicator' in ui_content

def test_css_animations_exist():
    """测试CSS动画样式存在"""
    css_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'css', 'style.css')
    
    assert os.path.exists(css_file), "CSS文件不存在"
    
    with open(css_file, 'r', encoding='utf-8') as f:
        css_content = f.read()
        
        # 验证积分动画相关样式
        assert 'score-animation' in css_content
        assert 'scoreFloat' in css_content
        assert 'level-up-notification' in css_content
        assert 'levelUpPulse' in css_content
        
        # 验证难度指示器样式
        assert 'difficulty-indicator' in css_content
        assert 'speed-indicator' in css_content
        assert 'level-up-details' in css_content

def test_html_template_includes_scripts():
    """测试HTML模板包含必要的脚本"""
    template_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates', 'index.html')
    
    assert os.path.exists(template_file), "HTML模板文件不存在"
    
    with open(template_file, 'r', encoding='utf-8') as f:
        template_content = f.read()
        
        # 验证包含所有必要的脚本
        assert 'scoring-system.js' in template_content
        assert 'difficulty-manager.js' in template_content
        assert 'ui-manager.js' in template_content
        assert 'tetris-game.js' in template_content

def test_game_integration_files():
    """测试游戏集成文件更新"""
    tetris_game_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'js', 'tetris-game.js')
    board_manager_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'js', 'board-manager.js')
    
    # 验证TetrisGame类已更新
    with open(tetris_game_file, 'r', encoding='utf-8') as f:
        tetris_content = f.read()
        assert 'this.scoringSystem = new ScoringSystem()' in tetris_content
        assert 'this.uiManager = new UIManager()' in tetris_content
        assert 'setupScoringCallbacks' in tetris_content
    
    # 验证BoardManager类包含isEmpty方法
    with open(board_manager_file, 'r', encoding='utf-8') as f:
        board_content = f.read()
        assert 'isEmpty()' in board_content

if __name__ == '__main__':
    pytest.main([__file__, '-v'])