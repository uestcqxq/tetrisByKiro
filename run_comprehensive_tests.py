#!/usr/bin/env python3
"""
综合测试运行器
运行所有测试并生成详细报告
"""

import os
import sys
import subprocess
import time
import json
from pathlib import Path
from datetime import datetime


class TestRunner:
    """测试运行器"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.test_results = {
            'start_time': datetime.now().isoformat(),
            'end_time': None,
            'total_duration': 0,
            'tests': {},
            'summary': {
                'total_tests': 0,
                'passed': 0,
                'failed': 0,
                'skipped': 0,
                'errors': 0
            },
            'coverage': {},
            'performance': {}
        }
    
    def run_all_tests(self):
        """运行所有测试"""
        print("🧪 开始运行综合测试套件...")
        start_time = time.time()
        
        try:
            # 1. 运行单元测试
            self.run_unit_tests()
            
            # 2. 运行集成测试
            self.run_integration_tests()
            
            # 3. 运行端到端测试
            self.run_e2e_tests()
            
            # 4. 运行前端测试
            self.run_frontend_tests()
            
            # 5. 运行性能测试
            self.run_performance_tests()
            
            # 6. 运行安全测试
            self.run_security_tests()
            
            # 7. 生成覆盖率报告
            self.generate_coverage_report()
            
            # 8. 生成测试报告
            self.generate_test_report()
            
        except KeyboardInterrupt:
            print("\n⚠️  测试被用户中断")
            return False
        except Exception as e:
            print(f"\n❌ 测试运行失败: {e}")
            return False
        finally:
            end_time = time.time()
            self.test_results['end_time'] = datetime.now().isoformat()
            self.test_results['total_duration'] = end_time - start_time
        
        return self.test_results['summary']['failed'] == 0
    
    def run_unit_tests(self):
        """运行单元测试"""
        print("\n📋 运行单元测试...")
        
        test_files = [
            'tests/test_models.py',
            'tests/test_user_service.py',
            'tests/test_game_service.py',
            'tests/test_database_manager.py',
            'tests/test_base_service.py',
            'tests/test_data_cleanup_service.py'
        ]
        
        for test_file in test_files:
            if (self.project_root / test_file).exists():
                self.run_pytest(test_file, 'unit')
    
    def run_integration_tests(self):
        """运行集成测试"""
        print("\n🔗 运行集成测试...")
        
        test_files = [
            'tests/test_api_routes.py',
            'tests/test_socketio.py',
            'tests/test_socketio_leaderboard.py'
        ]
        
        for test_file in test_files:
            if (self.project_root / test_file).exists():
                self.run_pytest(test_file, 'integration')
    
    def run_e2e_tests(self):
        """运行端到端测试"""
        print("\n🎯 运行端到端测试...")
        
        test_files = [
            'tests/test_e2e_integration.py'
        ]
        
        for test_file in test_files:
            if (self.project_root / test_file).exists():
                self.run_pytest(test_file, 'e2e')
    
    def run_frontend_tests(self):
        """运行前端测试"""
        print("\n🎨 运行前端测试...")
        
        frontend_test_dir = self.project_root / 'tests' / 'frontend'
        
        if frontend_test_dir.exists():
            try:
                # 检查是否有Node.js和npm
                subprocess.run(['node', '--version'], check=True, capture_output=True)
                subprocess.run(['npm', '--version'], check=True, capture_output=True)
                
                # 运行前端测试
                result = subprocess.run([
                    'npm', 'test'
                ], cwd=frontend_test_dir, capture_output=True, text=True, timeout=300)
                
                self.test_results['tests']['frontend'] = {
                    'status': 'passed' if result.returncode == 0 else 'failed',
                    'output': result.stdout,
                    'error': result.stderr,
                    'duration': 0  # npm test doesn't provide duration easily
                }
                
                if result.returncode == 0:
                    print("  ✅ 前端测试通过")
                    self.test_results['summary']['passed'] += 1
                else:
                    print("  ❌ 前端测试失败")
                    print(f"     错误: {result.stderr}")
                    self.test_results['summary']['failed'] += 1
                
            except (subprocess.CalledProcessError, FileNotFoundError):
                print("  ⚠️  跳过前端测试 (Node.js/npm未安装)")
                self.test_results['tests']['frontend'] = {
                    'status': 'skipped',
                    'reason': 'Node.js/npm not available'
                }
                self.test_results['summary']['skipped'] += 1
        else:
            print("  ⚠️  跳过前端测试 (测试目录不存在)")
    
    def run_performance_tests(self):
        """运行性能测试"""
        print("\n⚡ 运行性能测试...")
        
        try:
            # 运行性能基准测试
            result = subprocess.run([
                sys.executable, '-m', 'pytest', 
                'tests/test_scoring_difficulty.py',
                '-v', '--tb=short', '--benchmark-only'
            ], capture_output=True, text=True, timeout=300)
            
            self.test_results['tests']['performance'] = {
                'status': 'passed' if result.returncode == 0 else 'failed',
                'output': result.stdout,
                'error': result.stderr
            }
            
            if result.returncode == 0:
                print("  ✅ 性能测试通过")
                self.test_results['summary']['passed'] += 1
            else:
                print("  ❌ 性能测试失败")
                self.test_results['summary']['failed'] += 1
                
        except subprocess.TimeoutExpired:
            print("  ⚠️  性能测试超时")
            self.test_results['tests']['performance'] = {
                'status': 'timeout',
                'reason': 'Test execution timeout'
            }
            self.test_results['summary']['errors'] += 1
        except Exception as e:
            print(f"  ❌ 性能测试错误: {e}")
            self.test_results['tests']['performance'] = {
                'status': 'error',
                'error': str(e)
            }
            self.test_results['summary']['errors'] += 1
    
    def run_security_tests(self):
        """运行安全测试"""
        print("\n🔒 运行安全测试...")
        
        try:
            # 检查是否安装了bandit
            subprocess.run(['bandit', '--version'], check=True, capture_output=True)
            
            # 运行bandit安全扫描
            result = subprocess.run([
                'bandit', '-r', '.', 
                '-f', 'json',
                '-x', './tests,./venv,./env,./.venv'
            ], capture_output=True, text=True)
            
            if result.stdout:
                try:
                    security_report = json.loads(result.stdout)
                    issues = security_report.get('results', [])
                    
                    self.test_results['tests']['security'] = {
                        'status': 'passed' if len(issues) == 0 else 'warning',
                        'issues_found': len(issues),
                        'report': security_report
                    }
                    
                    if len(issues) == 0:
                        print("  ✅ 安全扫描通过，未发现问题")
                        self.test_results['summary']['passed'] += 1
                    else:
                        print(f"  ⚠️  安全扫描发现 {len(issues)} 个潜在问题")
                        for issue in issues[:3]:  # 显示前3个问题
                            print(f"     - {issue.get('test_name', 'Unknown')}: {issue.get('issue_text', 'No description')}")
                        if len(issues) > 3:
                            print(f"     ... 还有 {len(issues) - 3} 个问题")
                        self.test_results['summary']['passed'] += 1  # 警告不算失败
                except json.JSONDecodeError:
                    print("  ❌ 安全扫描报告解析失败")
                    self.test_results['summary']['errors'] += 1
            else:
                print("  ✅ 安全扫描完成")
                self.test_results['summary']['passed'] += 1
                
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("  ⚠️  跳过安全测试 (bandit未安装)")
            self.test_results['tests']['security'] = {
                'status': 'skipped',
                'reason': 'bandit not available'
            }
            self.test_results['summary']['skipped'] += 1
    
    def run_pytest(self, test_file, category):
        """运行pytest测试"""
        test_name = Path(test_file).stem
        
        try:
            start_time = time.time()
            
            result = subprocess.run([
                sys.executable, '-m', 'pytest', 
                test_file, '-v', '--tb=short', '--json-report', 
                f'--json-report-file=test_report_{test_name}.json'
            ], capture_output=True, text=True, timeout=300)
            
            duration = time.time() - start_time
            
            # 尝试读取JSON报告
            json_report_file = f'test_report_{test_name}.json'
            test_details = {}
            
            if os.path.exists(json_report_file):
                try:
                    with open(json_report_file, 'r') as f:
                        json_report = json.load(f)
                        test_details = {
                            'total': json_report.get('summary', {}).get('total', 0),
                            'passed': json_report.get('summary', {}).get('passed', 0),
                            'failed': json_report.get('summary', {}).get('failed', 0),
                            'skipped': json_report.get('summary', {}).get('skipped', 0),
                            'error': json_report.get('summary', {}).get('error', 0)
                        }
                    os.remove(json_report_file)  # 清理临时文件
                except (json.JSONDecodeError, KeyError):
                    pass
            
            self.test_results['tests'][test_name] = {
                'category': category,
                'status': 'passed' if result.returncode == 0 else 'failed',
                'duration': duration,
                'output': result.stdout,
                'error': result.stderr,
                'details': test_details
            }
            
            if result.returncode == 0:
                print(f"  ✅ {test_name} 通过 ({duration:.2f}s)")
                self.test_results['summary']['passed'] += 1
            else:
                print(f"  ❌ {test_name} 失败 ({duration:.2f}s)")
                print(f"     错误: {result.stderr.split(chr(10))[0] if result.stderr else '未知错误'}")
                self.test_results['summary']['failed'] += 1
            
            # 更新总计数
            if test_details:
                self.test_results['summary']['total_tests'] += test_details.get('total', 1)
            else:
                self.test_results['summary']['total_tests'] += 1
                
        except subprocess.TimeoutExpired:
            print(f"  ⚠️  {test_name} 超时")
            self.test_results['tests'][test_name] = {
                'category': category,
                'status': 'timeout',
                'reason': 'Test execution timeout'
            }
            self.test_results['summary']['errors'] += 1
        except Exception as e:
            print(f"  ❌ {test_name} 错误: {e}")
            self.test_results['tests'][test_name] = {
                'category': category,
                'status': 'error',
                'error': str(e)
            }
            self.test_results['summary']['errors'] += 1
    
    def generate_coverage_report(self):
        """生成覆盖率报告"""
        print("\n📊 生成代码覆盖率报告...")
        
        try:
            # 检查是否安装了coverage
            subprocess.run(['coverage', '--version'], check=True, capture_output=True)
            
            # 运行覆盖率测试
            subprocess.run([
                'coverage', 'run', '--source=.', '-m', 'pytest', 
                'tests/', '--tb=short'
            ], capture_output=True, timeout=600)
            
            # 生成覆盖率报告
            result = subprocess.run([
                'coverage', 'report', '--format=json'
            ], capture_output=True, text=True)
            
            if result.stdout:
                try:
                    coverage_data = json.loads(result.stdout)
                    self.test_results['coverage'] = {
                        'total_coverage': coverage_data.get('totals', {}).get('percent_covered', 0),
                        'files': coverage_data.get('files', {}),
                        'summary': coverage_data.get('totals', {})
                    }
                    
                    total_coverage = self.test_results['coverage']['total_coverage']
                    print(f"  📈 总体代码覆盖率: {total_coverage:.1f}%")
                    
                    if total_coverage >= 80:
                        print("  ✅ 覆盖率良好")
                    elif total_coverage >= 60:
                        print("  ⚠️  覆盖率一般，建议增加测试")
                    else:
                        print("  ❌ 覆盖率较低，需要更多测试")
                        
                except json.JSONDecodeError:
                    print("  ❌ 覆盖率报告解析失败")
            
            # 生成HTML报告
            subprocess.run([
                'coverage', 'html', '-d', 'htmlcov'
            ], capture_output=True)
            
            print("  📄 HTML覆盖率报告已生成: htmlcov/index.html")
            
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("  ⚠️  跳过覆盖率报告 (coverage未安装)")
        except subprocess.TimeoutExpired:
            print("  ⚠️  覆盖率测试超时")
    
    def generate_test_report(self):
        """生成测试报告"""
        print("\n📋 生成测试报告...")
        
        # 创建报告目录
        report_dir = self.project_root / 'test_reports'
        report_dir.mkdir(exist_ok=True)
        
        # 生成JSON报告
        json_report_file = report_dir / f'test_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        with open(json_report_file, 'w', encoding='utf-8') as f:
            json.dump(self.test_results, f, indent=2, ensure_ascii=False)
        
        # 生成HTML报告
        html_report = self.generate_html_report()
        html_report_file = report_dir / f'test_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.html'
        with open(html_report_file, 'w', encoding='utf-8') as f:
            f.write(html_report)
        
        print(f"  📄 JSON报告: {json_report_file}")
        print(f"  📄 HTML报告: {html_report_file}")
        
        # 打印摘要
        self.print_summary()
    
    def generate_html_report(self):
        """生成HTML测试报告"""
        summary = self.test_results['summary']
        
        html = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>俄罗斯方块游戏 - 测试报告</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1, h2 {{ color: #333; }}
        .summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }}
        .stat-card {{ background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }}
        .stat-card.passed {{ border-left-color: #28a745; }}
        .stat-card.failed {{ border-left-color: #dc3545; }}
        .stat-card.skipped {{ border-left-color: #ffc107; }}
        .stat-card.errors {{ border-left-color: #fd7e14; }}
        .stat-number {{ font-size: 2em; font-weight: bold; margin-bottom: 5px; }}
        .stat-label {{ color: #666; }}
        .test-results {{ margin: 20px 0; }}
        .test-item {{ background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; }}
        .test-item.passed {{ border-left-color: #28a745; }}
        .test-item.failed {{ border-left-color: #dc3545; }}
        .test-item.skipped {{ border-left-color: #ffc107; }}
        .test-item.error {{ border-left-color: #fd7e14; }}
        .test-name {{ font-weight: bold; margin-bottom: 5px; }}
        .test-details {{ color: #666; font-size: 0.9em; }}
        .coverage-bar {{ background: #e9ecef; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }}
        .coverage-fill {{ background: linear-gradient(90deg, #dc3545, #ffc107, #28a745); height: 100%; transition: width 0.3s ease; }}
        .timestamp {{ color: #666; font-size: 0.9em; }}
        pre {{ background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 0.8em; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🎮 俄罗斯方块游戏 - 测试报告</h1>
        <p class="timestamp">生成时间: {self.test_results['end_time']}</p>
        <p class="timestamp">测试耗时: {self.test_results['total_duration']:.2f} 秒</p>
        
        <h2>📊 测试摘要</h2>
        <div class="summary">
            <div class="stat-card">
                <div class="stat-number">{summary['total_tests']}</div>
                <div class="stat-label">总测试数</div>
            </div>
            <div class="stat-card passed">
                <div class="stat-number">{summary['passed']}</div>
                <div class="stat-label">通过</div>
            </div>
            <div class="stat-card failed">
                <div class="stat-number">{summary['failed']}</div>
                <div class="stat-label">失败</div>
            </div>
            <div class="stat-card skipped">
                <div class="stat-number">{summary['skipped']}</div>
                <div class="stat-label">跳过</div>
            </div>
            <div class="stat-card errors">
                <div class="stat-number">{summary['errors']}</div>
                <div class="stat-label">错误</div>
            </div>
        </div>
        """
        
        # 添加覆盖率信息
        if self.test_results.get('coverage'):
            coverage = self.test_results['coverage']['total_coverage']
            html += f"""
        <h2>📈 代码覆盖率</h2>
        <div class="coverage-bar">
            <div class="coverage-fill" style="width: {coverage}%"></div>
        </div>
        <p>总体覆盖率: {coverage:.1f}%</p>
        """
        
        # 添加测试详情
        html += """
        <h2>🧪 测试详情</h2>
        <div class="test-results">
        """
        
        for test_name, test_data in self.test_results['tests'].items():
            status_class = test_data.get('status', 'unknown')
            duration = test_data.get('duration', 0)
            category = test_data.get('category', 'unknown')
            
            html += f"""
            <div class="test-item {status_class}">
                <div class="test-name">{test_name}</div>
                <div class="test-details">
                    分类: {category} | 状态: {status_class} | 耗时: {duration:.2f}s
                </div>
            """
            
            if test_data.get('error'):
                html += f"<pre>{test_data['error'][:500]}...</pre>"
            
            html += "</div>"
        
        html += """
        </div>
    </div>
</body>
</html>
        """
        
        return html
    
    def print_summary(self):
        """打印测试摘要"""
        summary = self.test_results['summary']
        
        print("\n" + "="*60)
        print("🎯 测试摘要")
        print("="*60)
        print(f"总测试数: {summary['total_tests']}")
        print(f"✅ 通过: {summary['passed']}")
        print(f"❌ 失败: {summary['failed']}")
        print(f"⚠️  跳过: {summary['skipped']}")
        print(f"💥 错误: {summary['errors']}")
        print(f"⏱️  总耗时: {self.test_results['total_duration']:.2f} 秒")
        
        if self.test_results.get('coverage'):
            coverage = self.test_results['coverage']['total_coverage']
            print(f"📈 代码覆盖率: {coverage:.1f}%")
        
        success_rate = (summary['passed'] / max(summary['total_tests'], 1)) * 100
        print(f"🎯 成功率: {success_rate:.1f}%")
        
        if summary['failed'] == 0 and summary['errors'] == 0:
            print("\n🎉 所有测试通过！")
        else:
            print(f"\n⚠️  有 {summary['failed'] + summary['errors']} 个测试未通过")
        
        print("="*60)


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='俄罗斯方块游戏综合测试')
    parser.add_argument('--quick', action='store_true', help='快速测试（跳过性能和安全测试）')
    parser.add_argument('--coverage', action='store_true', help='只生成覆盖率报告')
    parser.add_argument('--category', choices=['unit', 'integration', 'e2e', 'frontend', 'performance', 'security'], 
                       help='只运行指定类别的测试')
    
    args = parser.parse_args()
    
    runner = TestRunner()
    
    if args.coverage:
        runner.generate_coverage_report()
        return
    
    if args.category:
        print(f"🎯 运行 {args.category} 测试...")
        if args.category == 'unit':
            runner.run_unit_tests()
        elif args.category == 'integration':
            runner.run_integration_tests()
        elif args.category == 'e2e':
            runner.run_e2e_tests()
        elif args.category == 'frontend':
            runner.run_frontend_tests()
        elif args.category == 'performance':
            runner.run_performance_tests()
        elif args.category == 'security':
            runner.run_security_tests()
        
        runner.test_results['end_time'] = datetime.now().isoformat()
        runner.generate_test_report()
        return
    
    # 运行完整测试套件
    success = runner.run_all_tests()
    
    # 设置退出码
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()