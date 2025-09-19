/**
 * Jest配置文件 - 前端JavaScript测试
 */
module.exports = {
  // 测试环境
  testEnvironment: 'jsdom',
  
  // 测试文件匹配模式
  testMatch: [
    '**/tests/frontend/**/*.test.js',
    '**/tests/frontend/**/*.spec.js'
  ],
  
  // 模块文件扩展名
  moduleFileExtensions: ['js', 'json'],
  
  // 模块路径映射
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/static/js/$1'
  },
  
  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/frontend/setup.js'],
  
  // 覆盖率收集
  collectCoverage: true,
  collectCoverageFrom: [
    'static/js/**/*.js',
    '!static/js/**/*.min.js',
    '!**/node_modules/**'
  ],
  
  // 覆盖率报告
  coverageDirectory: 'tests/frontend/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // 转换配置
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // 忽略转换的模块
  transformIgnorePatterns: [
    'node_modules/(?!(some-es6-module)/)'
  ],
  
  // 模拟模块
  moduleNameMapping: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  
  // 全局变量
  globals: {
    'window': {},
    'document': {},
    'navigator': {},
    'HTMLCanvasElement': {}
  },
  
  // 测试超时
  testTimeout: 10000,
  
  // 详细输出
  verbose: true
};