#!/usr/bin/env python3
"""
测试运行器
运行所有后端单元测试和集成测试
"""

import sys
import os
import unittest
import pytest
from io import StringIO

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def run_unittest_suite():
    """运行unittest测试套件"""
    print("=" * 60)
    print("运行 unittest 测试套件")
    print("=" * 60)
    
    # 发现并运行所有unittest测试
    loader = unittest.TestLoader()
    start_dir = os.path.dirname(__file__)
    
    # 加载所有测试模块
    test_modules = [
        'test_base_service',
        'test_user_service', 
        'test_game_service',
        'test_models',
        'test_database_manager',
        'test_data_cleanup_service'
    ]
    
    suite = unittest.TestSuite()
    
    for module_name in test_modules:
        try:
            module_suite = loader.loadTestsFromName(module_name)
            suite.addTest(module_suite)
            print(f"✓ 加载测试模块: {module_name}")
        except Exception as e:
            print(f"✗ 加载测试模块失败: {module_name} - {str(e)}")
    
    # 运行测试
    runner = unittest.TextTestRunner(verbosity=2, stream=sys.stdout)
    result = runner.run(suite)
    
    return result.wasSuccessful()

def run_pytest_suite():
    """运行pytest测试套件"""
    print("\n" + "=" * 60)
    print("运行 pytest 测试套件")
    print("=" * 60)
    
    # pytest测试文件
    pytest_files = [
        'test_api_routes.py',
        'test_socketio.py',
        'test_socketio_leaderboard.py',
        'test_scoring_difficulty.py'
    ]
    
    # 检查文件存在性
    existing_files = []
    for file_name in pytest_files:
        file_path = os.path.join(os.path.dirname(__file__), file_name)
        if os.path.exists(file_path):
            existing_files.append(file_path)
            print(f"✓ 找到测试文件: {file_name}")
        else:
            print(f"✗ 测试文件不存在: {file_name}")
    
    if not existing_files:
        print("没有找到pytest测试文件")
        return True
    
    # 运行pytest
    try:
        exit_code = pytest.main(['-v'] + existing_files)
        return exit_code == 0
    except Exception as e:
        print(f"运行pytest时出错: {str(e)}")
        return False

def run_coverage_analysis():
    """运行代码覆盖率分析"""
    print("\n" + "=" * 60)
    print("运行代码覆盖率分析")
    print("=" * 60)
    
    try:
        import coverage
        
        # 创建覆盖率对象
        cov = coverage.Coverage(source=['services', 'models', 'routes'])
        cov.start()
        
        # 运行测试
        unittest_success = run_unittest_suite()
        pytest_success = run_pytest_suite()
        
        # 停止覆盖率收集
        cov.stop()
        cov.save()
        
        # 生成报告
        print("\n代码覆盖率报告:")
        cov.report()
        
        # 生成HTML报告
        try:
            cov.html_report(directory='tests/coverage_html')
            print(f"\nHTML覆盖率报告已生成: tests/coverage_html/index.html")
        except Exception as e:
            print(f"生成HTML报告失败: {str(e)}")
        
        return unittest_success and pytest_success
        
    except ImportError:
        print("coverage包未安装，跳过覆盖率分析")
        print("安装命令: pip install coverage")
        return run_unittest_suite() and run_pytest_suite()

def check_test_environment():
    """检查测试环境"""
    print("检查测试环境...")
    
    required_packages = [
        'flask',
        'flask_sqlalchemy', 
        'flask_socketio',
        'pytest'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"✓ {package}")
        except ImportError:
            missing_packages.append(package)
            print(f"✗ {package} (缺失)")
    
    if missing_packages:
        print(f"\n缺少必需的包: {', '.join(missing_packages)}")
        print("请安装缺失的包后重新运行测试")
        return False
    
    return True

def generate_test_report(unittest_success, pytest_success):
    """生成测试报告"""
    print("\n" + "=" * 60)
    print("测试报告")
    print("=" * 60)
    
    total_tests = 0
    passed_tests = 0
    
    if unittest_success:
        print("✓ unittest 测试套件: 通过")
        passed_tests += 1
    else:
        print("✗ unittest 测试套件: 失败")
    
    total_tests += 1
    
    if pytest_success:
        print("✓ pytest 测试套件: 通过")
        passed_tests += 1
    else:
        print("✗ pytest 测试套件: 失败")
    
    total_tests += 1
    
    print(f"\n总计: {passed_tests}/{total_tests} 测试套件通过")
    
    if passed_tests == total_tests:
        print("🎉 所有测试通过!")
        return True
    else:
        print("❌ 部分测试失败")
        return False

def main():
    """主函数"""
    print("俄罗斯方块游戏 - 后端测试套件")
    print("=" * 60)
    
    # 检查测试环境
    if not check_test_environment():
        sys.exit(1)
    
    # 设置测试环境变量
    os.environ['FLASK_ENV'] = 'testing'
    
    try:
        # 运行测试
        if '--coverage' in sys.argv:
            success = run_coverage_analysis()
        else:
            unittest_success = run_unittest_suite()
            pytest_success = run_pytest_suite()
            success = generate_test_report(unittest_success, pytest_success)
        
        # 退出码
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print("\n测试被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n运行测试时发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()