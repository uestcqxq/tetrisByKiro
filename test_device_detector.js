/**
 * Node.js测试脚本 - 验证设备检测器逻辑
 */

// 模拟浏览器环境
global.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    performance: {
        now: () => Date.now()
    }
};

global.navigator = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    deviceMemory: 8,
    maxTouchPoints: 0,
    msMaxTouchPoints: 0,
    hardwareConcurrency: 8,
    platform: 'Win32',
    language: 'zh-CN'
};

global.document = {
    createElement: (tag) => {
        if (tag === 'canvas') {
            return {
                width: 0,
                height: 0,
                getContext: (type) => {
                    if (type === '2d') {
                        return {
                            fillStyle: '',
                            fillRect: () => {},
                            clearRect: () => {}
                        };
                    }
                    return null;
                }
            };
        }
        return {};
    }
};

// 加载设备检测器代码
const fs = require('fs');
const path = require('path');

const deviceDetectorCode = fs.readFileSync(path.join(__dirname, 'static/js/device-detector.js'), 'utf8');
eval(deviceDetectorCode);

// 测试函数
async function runTests() {
    console.log('开始设备检测器测试...\n');

    try {
        // 测试1: 基础初始化
        console.log('测试1: 基础初始化');
        const detector = new DeviceDetector();
        console.log('✓ DeviceDetector实例创建成功');

        // 测试2: 设备检测
        console.log('\n测试2: 设备检测');
        const result = await detector.initialize();
        
        console.log('检测结果:');
        console.log(`  性能等级: ${result.performanceLevel}`);
        console.log(`  检测时间: ${Math.round(result.results.detectionTime)}ms`);
        console.log(`  置信度: ${Math.round(result.results.confidence * 100)}%`);
        console.log(`  是否使用回退: ${result.results.fallbackUsed}`);

        // 测试3: 设备信息
        console.log('\n测试3: 设备信息');
        const deviceInfo = result.deviceInfo;
        console.log(`  设备类型: ${deviceInfo.isMobile ? '移动' : deviceInfo.isTablet ? '平板' : '桌面'}`);
        console.log(`  屏幕尺寸: ${deviceInfo.screenSize}`);
        console.log(`  内存等级: ${deviceInfo.memoryLevel}`);
        console.log(`  CPU等级: ${deviceInfo.cpuLevel}`);
        console.log(`  GPU等级: ${deviceInfo.gpuLevel}`);
        console.log(`  触摸支持: ${deviceInfo.hasTouch}`);

        // 测试4: 性能配置
        console.log('\n测试4: 性能配置');
        const config = result.config;
        console.log(`  启用动画: ${config.enableAnimations}`);
        console.log(`  最大动画数: ${config.maxAnimations}`);
        console.log(`  目标FPS: ${config.targetFPS}`);
        console.log(`  渲染质量: ${config.renderQuality}`);
        console.log(`  启用渐变: ${config.enableGradients}`);

        // 测试5: 回退配置
        console.log('\n测试5: 回退配置测试');
        const fallbackResult = detector.getFallbackConfiguration();
        console.log(`  回退性能等级: ${fallbackResult.performanceLevel}`);
        console.log(`  回退标记: ${fallbackResult.results.fallbackUsed}`);

        // 测试6: 设备摘要
        console.log('\n测试6: 设备摘要');
        const summary = detector.getDeviceSummary();
        console.log('设备摘要:', summary);

        console.log('\n✅ 所有测试通过！');

    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        console.error(error.stack);
    }
}

// 运行测试
runTests();