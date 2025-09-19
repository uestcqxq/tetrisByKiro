#!/usr/bin/env node
/**
 * 前端测试运行器
 * 运行所有前端JavaScript单元测试
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 检查Jest是否安装
function checkJestInstallation() {
  try {
    execSync('npx jest --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error('❌ Jest未安装或不可用');
    console.log('请安装Jest: npm install --save-dev jest @babel/core @babel/preset-env babel-jest jsdom');
    return false;
  }
}

// 检查测试文件
function checkTestFiles() {
  const testDir = __dirname;
  const testFiles = fs.readdirSync(testDir).filter(file => 
    file.endsWith('.test.js') || file.endsWith('.spec.js')
  );
  
  console.log(`📁 找到 ${testFiles.length} 个测试文件:`);
  testFiles.forEach(file => {
    console.log(`   ✓ ${file}`);
  });
  
  return testFiles.length > 0;
}

// 创建临时的package.json（如果不存在）
function ensurePackageJson() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    const packageJson = {
      name: 'tetris-game-frontend-tests',
      version: '1.0.0',
      description: 'Frontend tests for Tetris game',
      scripts: {
        test: 'jest --config tests/frontend/jest.config.js'
      },
      devDependencies: {
        jest: '^29.0.0',
        '@babel/core': '^7.0.0',
        '@babel/preset-env': '^7.0.0',
        'babel-jest': '^29.0.0',
        'jsdom': '^20.0.0'
      }
    };
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('📦 创建了临时的package.json文件');
  }
}

// 创建Babel配置
function ensureBabelConfig() {
  const babelConfigPath = path.join(process.cwd(), '.babelrc');
  
  if (!fs.existsSync(babelConfigPath)) {
    const babelConfig = {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current'
          }
        }]
      ]
    };
    
    fs.writeFileSync(babelConfigPath, JSON.stringify(babelConfig, null, 2));
    console.log('🔧 创建了Babel配置文件');
  }
}

// 运行测试
function runTests() {
  console.log('\n🚀 开始运行前端测试...\n');
  
  try {
    const jestConfigPath = path.join(__dirname, 'jest.config.js');
    const command = `npx jest --config "${jestConfigPath}" --verbose --coverage`;
    
    execSync(command, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log('\n✅ 所有前端测试通过!');
    return true;
    
  } catch (error) {
    console.error('\n❌ 前端测试失败');
    console.error('错误详情:', error.message);
    return false;
  }
}

// 生成测试报告
function generateTestReport() {
  const coverageDir = path.join(__dirname, 'coverage');
  
  if (fs.existsSync(coverageDir)) {
    console.log('\n📊 测试覆盖率报告:');
    console.log(`   HTML报告: ${path.join(coverageDir, 'lcov-report', 'index.html')}`);
    console.log(`   LCOV文件: ${path.join(coverageDir, 'lcov.info')}`);
  }
}

// 清理临时文件
function cleanup() {
  const tempFiles = [
    path.join(process.cwd(), 'package.json'),
    path.join(process.cwd(), '.babelrc')
  ];
  
  // 只清理我们创建的临时文件
  // 在实际项目中，这些文件可能已经存在，不应该删除
  console.log('\n🧹 清理完成');
}

// 主函数
function main() {
  console.log('🎮 俄罗斯方块游戏 - 前端测试套件');
  console.log('=' .repeat(50));
  
  // 检查环境
  if (!checkJestInstallation()) {
    process.exit(1);
  }
  
  if (!checkTestFiles()) {
    console.error('❌ 没有找到测试文件');
    process.exit(1);
  }
  
  // 准备环境
  ensurePackageJson();
  ensureBabelConfig();
  
  // 运行测试
  const success = runTests();
  
  // 生成报告
  generateTestReport();
  
  // 退出
  process.exit(success ? 0 : 1);
}

// 处理命令行参数
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
用法: node run-frontend-tests.js [选项]

选项:
  --help, -h     显示帮助信息
  --watch        监视模式运行测试
  --coverage     生成覆盖率报告（默认启用）
  --verbose      详细输出

示例:
  node run-frontend-tests.js
  node run-frontend-tests.js --watch
  `);
  process.exit(0);
}

// 处理监视模式
if (process.argv.includes('--watch')) {
  console.log('👀 监视模式暂不支持，请使用: npx jest --watch');
  process.exit(0);
}

// 运行主程序
if (require.main === module) {
  main();
}

module.exports = {
  checkJestInstallation,
  checkTestFiles,
  runTests,
  generateTestReport
};