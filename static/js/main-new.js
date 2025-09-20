/**
 * 主应用程序入口点 - 简化版本
 * 负责初始化所有游戏组件和管理应用程序状态
 */

// 全局应用程序状态
window.gameApp = {
    // 核心组件
    game: null,
    apiClient: null,
    wsClient: null,
    uiManager: null,
    // 用户状态
    currentUser: null,
    isLoggedIn: false,
    // 游戏状态
    isGameRunning: false,
    isPaused: false,
    // 配置
    config: {
        apiBaseUrl: '/api',
        wsNamespace: '/',
        autoSave: true,
        debugMode: true
    }
};

/**
 * 应用程序初始化
 */
async function initializeApp() {
    try {
        console.log('开始初始化应用程序...');
        
        // 使用GameBootstrap进行初始化
        if (typeof GameBootstrap !== 'undefined') {
            console.log('使用GameBootstrap进行初始化...');
            await initializeWithGameBootstrap();
        } else {
            console.log('GameBootstrap不可用，使用传统初始化方式...');
            // 显示加载界面
            showLoadingScreen();
            await initializeAppLegacy();
            // 隐藏加载界面
            hideLoadingScreen();
            // 更新用户信息显示
            updateUserInfo();
        }

        // 设置事件监听器
        setupEventListeners();
        console.log('✓ 事件监听器设置完成');
        
        // 尝试自动登录
        await attemptAutoLogin();
        
        // 更新UI状态
        updateUIState();
        
        console.log('🎉 应用程序初始化完成！');
        
    } catch (error) {
        console.error('应用程序初始化失败:', error);
        
        // 尝试使用错误恢复系统
        if (window.errorRecoverySystem) {
            try {
                await window.errorRecoverySystem.handleError(error, {
                    module: 'main',
                    context: 'initialization',
                    simplifiedInit: initializeAppLegacy
                });
            } catch (recoveryError) {
                showInitializationError(recoveryError);
            }
        } else {
            showInitializationError(error);
        }
    }
}

/**
 * 使用GameBootstrap初始化
 */
async function initializeWithGameBootstrap() {
    // 创建游戏启动管理器
    const bootstrap = new GameBootstrap({
        maxStartupTime: 15000,
        enableFallbackMode: true
    });

    // 监听启动事件
    bootstrap.on('stateUpdate', (data) => {
        console.log(`启动状态: ${data.stage} (${Math.round(data.progress * 100)}%)`);
        updateLoadingProgress(data.progress * 100, data.message);
    });

    bootstrap.on('moduleLoadStart', (data) => {
        console.log(`开始加载模块: ${data.module}`);
    });

    bootstrap.on('moduleLoadSuccess', (data) => {
        console.log(`✓ ${data.module} 加载成功`);
    });

    bootstrap.on('moduleLoadFailed', (data) => {
        console.warn(`✗ ${data.module} 加载失败:`, data.error);
    });

    bootstrap.on('initializationComplete', (state) => {
        console.log('游戏初始化完成:', state);
        // 初始化应用程序特定的组件
        initializeAppComponents();
        // 隐藏加载界面
        hideLoadingScreen();
        // 更新用户信息显示
        updateUserInfo();
        // 更新排行榜显示
        if (window.gameApp.uiManager) {
            window.gameApp.uiManager.updateLeaderboard();
        }
        
        // 添加API测试按钮
        addAPITestButton();
    });

    bootstrap.on('initializationError', (data) => {
        console.error('游戏初始化失败:', data);
        throw new Error(`游戏初始化失败: ${data.error.message}`);
    });

    bootstrap.on('fallbackModeEnabled', (state) => {
        console.log('降级模式已启用:', state);
        // 在降级模式下也要初始化基本功能
        initializeAppComponents();
        // 隐藏加载界面
        hideLoadingScreen();
        // 更新用户信息显示
        updateUserInfo();
    });

    // 开始初始化
    await bootstrap.initialize();
}

/**
 * 初始化应用程序特定的组件
 */
function initializeAppComponents() {
    // 初始化API客户端
    if (typeof APIClient !== 'undefined') {
        window.gameApp.apiClient = new APIClient();
        console.log('✓ API客户端初始化完成');
    }
    
    // 初始化UI管理器
    if (typeof UIManager !== 'undefined') {
        window.gameApp.uiManager = new UIManager();
        console.log('✓ UI管理器初始化完成');
    }
    
    // 初始化游戏引擎
    if (typeof TetrisGame !== 'undefined') {
        const gameCanvas = document.getElementById('game-canvas');
        if (gameCanvas) {
            window.gameApp.game = new TetrisGame(gameCanvas);
            
            // 设置游戏结束回调
            window.gameApp.game.setCallback('gameOver', handleGameOver);
            console.log('✓ 游戏结束回调已设置');
            
            console.log('✓ 俄罗斯方块游戏初始化完成');
        } else {
            console.error('游戏Canvas元素未找到，无法初始化游戏');
        }
    }

    // 可选模块
    if (typeof OfflineStorage !== 'undefined') {
        window.offlineStorage = new OfflineStorage();
        console.log('✓ 离线存储初始化完成');
    }

    if (typeof WebSocketClient !== 'undefined') {
        window.gameApp.wsClient = new WebSocketClient();
        console.log('✓ WebSocket客户端初始化完成');
    }

    // 移动设备触摸处理器
    if (typeof MobileTouchHandler !== 'undefined' && window.deviceDetector) {
        const deviceInfo = window.deviceDetector.getDeviceSummary();
        if (deviceInfo.type === 'Mobile') {
            window.mobileTouchHandler = new MobileTouchHandler();
            console.log('✓ 移动触摸处理器初始化完成');
        }
    }
}

/**
 * 传统初始化方式（备用）
 */
async function initializeAppLegacy() {
    console.log('使用传统初始化方式...');
    
    updateLoadingProgress(10, '初始化基础模块...');
    
    // 基础模块初始化
    if (typeof ErrorHandler !== 'undefined') {
        window.errorHandler = new ErrorHandler();
        console.log('✓ 错误处理器初始化完成');
    }
    
    updateLoadingProgress(20, '检测设备信息...');
    
    if (typeof DeviceDetector !== 'undefined') {
        window.deviceDetector = new DeviceDetector();
        console.log('✓ 设备检测器初始化完成');
    }
    
    updateLoadingProgress(30, '初始化网络管理器...');
    
    if (typeof NetworkManager !== 'undefined') {
        window.networkManager = new NetworkManager();
        console.log('✓ 网络管理器初始化完成');
    }
    
    updateLoadingProgress(50, '初始化API客户端...');
    
    if (typeof APIClient !== 'undefined') {
        window.gameApp.apiClient = new APIClient();
        console.log('✓ API客户端初始化完成');
    }
    
    updateLoadingProgress(70, '初始化输入控制器...');
    
    if (typeof InputController !== 'undefined') {
        window.inputController = new InputController();
        console.log('✓ 输入控制器初始化完成');
    }
    
    updateLoadingProgress(80, '初始化UI管理器...');
    
    if (typeof UIManager !== 'undefined') {
        window.gameApp.uiManager = new UIManager();
        console.log('✓ UI管理器初始化完成');
    }
    
    updateLoadingProgress(90, '初始化游戏引擎...');
    
    if (typeof TetrisGame !== 'undefined') {
        window.gameApp.game = new TetrisGame();
        console.log('✓ 俄罗斯方块游戏初始化完成');
    }
    
    updateLoadingProgress(100, '初始化完成');
}

/**
 * 显示加载界面
 */
function showLoadingScreen() {
    // 创建加载界面
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.innerHTML = `
        <div class="loading-content">
            <h2>俄罗斯方块</h2>
            <div class="loading-spinner"></div>
            <div class="loading-progress">
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill"></div>
                </div>
                <div class="progress-text" id="progress-text">正在加载...</div>
                <div class="progress-percentage" id="progress-percentage">0%</div>
            </div>
            <div class="loading-tips">
                <p id="loading-tip">提示: 使用方向键控制方块移动</p>
            </div>
        </div>
    `;
    
    // 添加样式
    loadingScreen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        color: white;
        font-family: Arial, sans-serif;
    `;
    
    document.body.appendChild(loadingScreen);
    
    // 添加CSS样式
    const style = document.createElement('style');
    style.textContent = `
        .loading-content {
            text-align: center;
            max-width: 400px;
            padding: 40px;
        }
        
        .loading-content h2 {
            font-size: 2.5em;
            margin-bottom: 30px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .loading-spinner {
            width: 60px;
            height: 60px;
            border: 4px solid rgba(255,255,255,0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 30px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .loading-progress {
            margin-bottom: 30px;
        }
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background: rgba(255,255,255,0.3);
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
        }
        
        .progress-fill {
            height: 100%;
            background: white;
            width: 0%;
            transition: width 0.3s ease;
        }
        
        .progress-text {
            font-size: 1.1em;
            margin-bottom: 5px;
        }
        
        .progress-percentage {
            font-size: 1.2em;
            font-weight: bold;
        }
        
        .loading-tips {
            font-size: 0.9em;
            opacity: 0.8;
        }
    `;
    document.head.appendChild(style);
}

/**
 * 更新加载进度
 */
function updateLoadingProgress(progress, text) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const progressPercentage = document.getElementById('progress-percentage');
    
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
    
    if (progressText && text) {
        progressText.textContent = text;
    }
    
    if (progressPercentage) {
        progressPercentage.textContent = `${Math.round(progress)}%`;
    }
}

/**
 * 隐藏加载界面
 */
function hideLoadingScreen() {
    console.log('尝试隐藏加载屏幕...');
    
    // 方法1: 通过ID查找
    const loadingScreen = document.getElementById('loading-screen');
    console.log('通过ID找到加载屏幕元素:', loadingScreen);
    
    // 方法2: 通过类名查找
    const loadingScreenByClass = document.querySelector('.loading-screen');
    console.log('通过类名找到加载屏幕元素:', loadingScreenByClass);
    
    // 方法3: 查找所有可能的加载元素
    const allLoadingElements = document.querySelectorAll('.loading-screen, #loading-screen, [class*="loading"]');
    console.log('找到的所有加载相关元素:', allLoadingElements);
    
    // 强制隐藏所有找到的加载元素
    allLoadingElements.forEach((element, index) => {
        console.log(`隐藏加载元素 ${index}:`, element);
        element.style.display = 'none !important';
        element.style.visibility = 'hidden';
        element.style.opacity = '0';
        element.style.zIndex = '-1';
        
        // 也尝试移除元素
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
                console.log(`加载元素 ${index} 已移除`);
            }
        }, 100);
    });
    
    // 额外的强制隐藏方法：添加CSS规则
    const style = document.createElement('style');
    style.textContent = `
        .loading-screen,
        #loading-screen {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            z-index: -1 !important;
        }
    `;
    document.head.appendChild(style);
    console.log('添加了强制隐藏CSS规则');
}

/**
 * 更新用户信息显示
 */
function updateUserInfo() {
    const userInfoElement = document.getElementById('user-info');
    if (userInfoElement) {
        if (window.gameApp.isLoggedIn && window.gameApp.currentUser) {
            userInfoElement.textContent = `欢迎, ${window.gameApp.currentUser.username}`;
        } else {
            userInfoElement.textContent = '游客模式 | 点击登录 | 测试分数';
            userInfoElement.style.cursor = 'pointer';
            userInfoElement.onclick = () => {
                // 添加测试分数保存功能
                if (confirm('要测试分数保存功能吗？')) {
                    testScoreSaving();
                } else {
                    showLoginModal();
                }
            };
        }
        console.log('用户信息已更新');
    }
}

/**
 * 测试分数保存功能
 */
async function testScoreSaving() {
    console.log('🧪 开始测试分数保存功能');
    
    // 模拟游戏结束状态
    const testGameState = {
        score: 1000,
        level: 3,
        lines: 10,
        totalLines: 10,
        gameTime: 60000, // 1分钟
        currentLevel: 3
    };
    
    try {
        await handleGameOver(testGameState);
        console.log('✅ 测试分数保存完成');
    } catch (error) {
        console.error('❌ 测试分数保存失败:', error);
    }
}

/**
 * 添加API测试按钮
 */
function addAPITestButton() {
    // 检查是否已经添加了测试按钮
    if (document.getElementById('api-test-btn')) return;
    
    const testButton = document.createElement('button');
    testButton.id = 'api-test-btn';
    testButton.textContent = '测试API';
    testButton.className = 'btn btn-warning';
    testButton.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 1000;
        padding: 8px 16px;
        background: #ffc107;
        color: #000;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    
    testButton.onclick = async () => {
        console.log('🔧 开始API测试');
        
        try {
            // 测试1: 检查API客户端
            if (!window.gameApp.apiClient) {
                console.error('❌ API客户端未初始化');
                alert('API客户端未初始化');
                return;
            }
            console.log('✓ API客户端已初始化');
            
            // 测试2: 创建用户
            console.log('🔄 测试创建用户...');
            const user = await window.gameApp.apiClient.createUser('test_user_' + Date.now());
            console.log('✓ 用户创建成功:', user);
            
            // 测试3: 提交分数
            console.log('🔄 测试提交分数...');
            const gameData = {
                user_id: user.id,
                score: 1500,
                level: 5,
                lines_cleared: 15,
                game_duration: 90 // 90秒，不是90000毫秒
            };
            
            console.log('📤 提交的数据:', gameData);
            console.log('📋 数据类型检查:', {
                user_id: typeof gameData.user_id,
                score: typeof gameData.score,
                level: typeof gameData.level,
                lines_cleared: typeof gameData.lines_cleared,
                game_duration: typeof gameData.game_duration
            });
            
            // 直接使用fetch测试API
            console.log('🔄 直接测试API端点...');
            const directResponse = await fetch('/api/games', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gameData)
            });
            
            console.log('📡 直接API响应状态:', directResponse.status);
            const responseText = await directResponse.text();
            console.log('📄 直接API响应内容:', responseText);
            
            if (!directResponse.ok) {
                console.error('❌ 直接API调用失败');
                alert('直接API调用失败: ' + responseText);
                return;
            }
            
            const result = await window.gameApp.apiClient.submitGameScore(gameData);
            console.log('✅ 分数提交成功:', result);
            
            // 测试4: 获取排行榜
            console.log('🔄 测试获取排行榜...');
            const leaderboard = await window.gameApp.apiClient.getLeaderboard(10);
            console.log('✓ 排行榜获取成功:', leaderboard);
            
            // 更新排行榜显示
            if (window.gameApp.uiManager) {
                window.gameApp.uiManager.updateLeaderboardDisplay(leaderboard);
            }
            
            alert('API测试完成！查看控制台了解详情。');
            
        } catch (error) {
            console.error('❌ API测试失败:', error);
            console.error('错误详情:', {
                message: error.message,
                status: error.status,
                stack: error.stack
            });
            alert('API测试失败: ' + error.message + '\n查看控制台了解详情');
        }
    };
    
    document.body.appendChild(testButton);
    console.log('✓ API测试按钮已添加');
}

/**
 * 处理游戏结束
 */
async function handleGameOver(gameState) {
    try {
        console.log('🎮 游戏结束回调被调用');
        console.log('游戏状态:', gameState);
        
        // 更新游戏状态
        window.gameApp.isGameRunning = false;
        window.gameApp.isPaused = false;
        updateUIState();
        
        // 如果有分数且用户已登录，保存分数
        if (gameState.score > 0) {
            await saveGameScore(gameState);
        }
        
        // 更新排行榜显示
        if (window.gameApp.uiManager) {
            setTimeout(() => {
                window.gameApp.uiManager.updateLeaderboard();
            }, 1000); // 延迟1秒更新排行榜，确保分数已保存
        }
        
    } catch (error) {
        console.error('处理游戏结束失败:', error);
    }
}

/**
 * 保存游戏分数
 */
async function saveGameScore(gameState) {
    try {
        console.log('💾 开始保存游戏分数流程');
        
        // 检查是否有API客户端
        if (!window.gameApp.apiClient) {
            console.error('❌ API客户端未初始化，无法保存分数');
            return;
        }
        console.log('✓ API客户端已初始化');
        
        // 如果用户未登录，先创建匿名用户
        let userId = null;
        if (window.gameApp.isLoggedIn && window.gameApp.currentUser) {
            userId = window.gameApp.currentUser.id;
        } else {
            // 创建匿名用户
            console.log('🔄 创建匿名用户...');
            const anonymousUser = await window.gameApp.apiClient.createUser('');
            if (anonymousUser) {
                window.gameApp.currentUser = anonymousUser;
                window.gameApp.isLoggedIn = true;
                userId = anonymousUser.id;
                updateUserInfo(); // 更新用户信息显示
                console.log('✓ 创建匿名用户成功:', anonymousUser);
            } else {
                console.error('❌ 创建匿名用户失败');
                return;
            }
        }
        
        if (userId) {
            // 保存游戏分数
            const gameData = {
                user_id: userId,
                score: gameState.score || 0,
                level: gameState.level || gameState.currentLevel || 1,
                lines_cleared: gameState.lines || gameState.totalLines || 0,
                game_duration: gameState.gameTime || 0
            };
            
            console.log('🔍 游戏状态详情:', gameState);
            console.log('📋 准备提交的数据:', gameData);
            
            console.log('📤 提交游戏分数:', gameData);
            const result = await window.gameApp.apiClient.submitGameScore(gameData);
            
            if (result) {
                console.log('✅ 分数保存成功:', result);
                
                // 显示保存成功提示
                showScoreSavedNotification(gameState.score);
            } else {
                console.error('❌ 分数保存失败 - 无返回结果');
            }
        }
        
    } catch (error) {
        console.error('保存游戏分数失败:', error);
        // 即使保存失败也不影响游戏体验
    }
}

/**
 * 显示分数保存成功通知
 */
function showScoreSavedNotification(score) {
    const notification = document.createElement('div');
    notification.className = 'score-saved-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <h3>分数已保存!</h3>
            <p>得分: ${score.toLocaleString()}</p>
        </div>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
    `;
    
    // 添加动画样式
    if (!document.getElementById('score-notification-style')) {
        const style = document.createElement('style');
        style.id = 'score-notification-style';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // 3秒后自动消失
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }, 3000);
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 开始游戏按钮
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', handleStartGame);
        console.log('✓ 开始游戏按钮事件监听器已绑定');
    } else {
        console.error('✗ 未找到开始游戏按钮 (ID: start-btn)');
    }

    // 暂停/继续按钮
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', handlePauseToggle);
    }

    // 重置按钮
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', handleResetGame);
    }

    // 登录按钮
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLoginClick);
    }

    // 窗口大小变化
    window.addEventListener('resize', handleWindowResize);
    
    // 页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * 游戏事件处理器
 */
async function handleStartGame() {
    try {
        console.log('开始游戏按钮被点击');
        
        if (window.gameApp.game) {
            console.log('调用游戏开始方法');
            await window.gameApp.game.start();
            window.gameApp.isGameRunning = true;
            updateUIState();
            console.log('游戏已开始');
        } else {
            console.error('游戏实例未找到');
            alert('游戏未正确初始化，请刷新页面重试');
        }
    } catch (error) {
        console.error('开始游戏失败:', error);
        alert('游戏启动失败，请刷新页面重试');
    }
}

function handlePauseToggle() {
    try {
        if (window.gameApp.game && window.gameApp.isGameRunning) {
            if (window.gameApp.isPaused) {
                window.gameApp.game.resume();
                window.gameApp.isPaused = false;
            } else {
                window.gameApp.game.pause();
                window.gameApp.isPaused = true;
            }
            updateUIState();
        }
    } catch (error) {
        console.error('暂停/继续游戏失败:', error);
    }
}

function handleResetGame() {
    try {
        if (window.gameApp.game) {
            window.gameApp.game.reset();
            window.gameApp.isGameRunning = false;
            window.gameApp.isPaused = false;
            updateUIState();
        }
    } catch (error) {
        console.error('重置游戏失败:', error);
    }
}

function handleLoginClick() {
    showLoginModal();
}

function handleWindowResize() {
    if (window.gameApp.game && window.gameApp.game.handleResize) {
        window.gameApp.game.handleResize();
    }
}

function handleVisibilityChange() {
    if (document.hidden && window.gameApp.isGameRunning && !window.gameApp.isPaused) {
        // 页面隐藏时自动暂停游戏
        handlePauseToggle();
    }
}

/**
 * UI状态更新
 */
function updateUIState() {
    // 更新用户信息显示
    const usernameElement = document.getElementById('username');
    const loginBtn = document.getElementById('login-btn');
    
    if (window.gameApp.isLoggedIn && window.gameApp.currentUser) {
        if (usernameElement) {
            usernameElement.textContent = window.gameApp.currentUser.username;
        }
        if (loginBtn) {
            loginBtn.textContent = '已登录';
            loginBtn.disabled = true;
        }
    } else {
        if (usernameElement) {
            usernameElement.textContent = '游客';
        }
        if (loginBtn) {
            loginBtn.textContent = '登录';
            loginBtn.disabled = false;
        }
    }

    // 更新游戏控制按钮状态
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    
    if (window.gameApp.isGameRunning) {
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) {
            pauseBtn.style.display = 'block';
            pauseBtn.textContent = window.gameApp.isPaused ? '继续' : '暂停';
        }
    } else {
        if (startBtn) startBtn.style.display = 'block';
        if (pauseBtn) pauseBtn.style.display = 'none';
    }
}

/**
 * 辅助函数
 */
function showLoginModal() {
    // 简化的登录模态框
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        ">
            <div style="
                background: white;
                padding: 30px;
                border-radius: 10px;
                text-align: center;
                max-width: 400px;
            ">
                <h3>用户登录</h3>
                <input type="text" id="username-input" placeholder="输入用户名（可选）" style="
                    width: 100%;
                    padding: 10px;
                    margin: 10px 0;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                ">
                <div>
                    <button onclick="doLogin()" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        margin: 5px;
                        cursor: pointer;
                    ">登录</button>
                    <button onclick="this.closest('div').remove()" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        margin: 5px;
                        cursor: pointer;
                    ">取消</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function doLogin() {
    try {
        const usernameInput = document.getElementById('username-input');
        const username = usernameInput?.value.trim() || '';
        
        // 调用API创建或登录用户
        if (window.gameApp.apiClient) {
            const userData = await window.gameApp.apiClient.createUser(username);
            
            // 保存用户信息
            window.gameApp.currentUser = userData;
            window.gameApp.isLoggedIn = true;
            
            // 更新UI
            updateUIState();
            
            // 关闭模态框
            const modal = document.querySelector('div[style*="position: fixed"]');
            if (modal) modal.remove();
            
            console.log('用户登录成功:', userData);
        } else {
            throw new Error('API客户端未初始化');
        }
    } catch (error) {
        console.error('用户登录失败:', error);
        alert('登录失败，请重试');
    }
}

async function attemptAutoLogin() {
    try {
        if (window.offlineStorage) {
            const savedUserData = window.offlineStorage.getUserData();
            if (savedUserData && window.gameApp.apiClient) {
                const userData = await window.gameApp.apiClient.getUser(savedUserData.id);
                if (userData) {
                    window.gameApp.currentUser = userData;
                    window.gameApp.isLoggedIn = true;
                    console.log('自动登录成功:', userData);
                }
            }
        }
    } catch (error) {
        console.log('自动登录失败，需要手动登录');
    }
}

function showInitializationError(error) {
    const errorMessage = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f8d7da;
            color: #721c24;
            padding: 20px;
            border: 1px solid #f5c6cb;
            border-radius: 5px;
            z-index: 9999;
            max-width: 400px;
            text-align: center;
        ">
            <h3>应用程序初始化失败</h3>
            <p>抱歉，游戏无法正常启动。请刷新页面重试。</p>
            <p><small>错误信息: ${error.message}</small></p>
            <button onclick="location.reload()" style="
                background: #dc3545;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 3px;
                cursor: pointer;
                margin-top: 10px;
            ">刷新页面</button>
        </div>
    `;
    
    // 隐藏加载界面
    hideLoadingScreen();
    
    document.body.insertAdjacentHTML('beforeend', errorMessage);
}

/**
 * 页面加载完成后初始化应用程序
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，开始初始化应用程序...');
    
    // 延迟一点时间确保所有脚本都加载完成
    setTimeout(() => {
        initializeApp();
    }, 100);
});

// 导出全局函数供其他模块使用
window.initializeApp = initializeApp;
window.updateUIState = updateUIState;
window.doLogin = doLogin;

console.log('主应用程序模块加载完成');