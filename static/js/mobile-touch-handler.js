/**
 * MobileTouchHandler - 移动设备触摸控制专用处理器
 * 提供更精确的触摸手势识别和移动设备兼容性
 */
class MobileTouchHandler {
    constructor(inputController) {
        this.inputController = inputController;
        this.game = inputController.game;
        
        // 设备检测
        this.deviceInfo = this.detectDevice();
        
        // 触摸配置
        this.touchConfig = {
            // 基础手势阈值
            swipeMinDistance: 30,
            swipeMaxTime: 300,
            tapMaxDistance: 15,
            tapMaxTime: 200,
            longPressTime: 500,
            
            // 设备特定调整
            ...this.getDeviceSpecificConfig()
        };
        
        // 多点触控状态
        this.multiTouchState = {
            touches: new Map(),
            gestureStartTime: 0,
            initialDistance: 0,
            initialAngle: 0
        };
        
        // 手势历史记录
        this.gestureHistory = [];
        this.maxHistoryLength = 10;
        
        // 振动反馈支持
        this.vibrationSupported = 'vibrate' in navigator;
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化移动触摸处理器
     */
    init() {
        this.setupAdvancedTouchEvents();
        this.setupOrientationHandling();
        this.setupVisualFeedback();
        
        console.log('移动触摸处理器初始化完成', this.deviceInfo);
    }
    
    /**
     * 检测设备信息
     */
    detectDevice() {
        const userAgent = navigator.userAgent;
        const platform = navigator.platform;
        
        const device = {
            isAndroid: /Android/i.test(userAgent),
            isIOS: /iPad|iPhone|iPod/.test(userAgent),
            isTablet: /iPad/.test(userAgent) || (window.innerWidth > 768 && /Android/i.test(userAgent)),
            isPhone: window.innerWidth <= 768,
            hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            screenSize: {
                width: window.screen.width,
                height: window.screen.height,
                ratio: window.devicePixelRatio || 1
            },
            orientation: window.orientation || 0
        };
        
        // 检测特定设备型号
        if (device.isIOS) {
            device.model = this.detectIOSModel(userAgent);
        } else if (device.isAndroid) {
            device.model = this.detectAndroidModel(userAgent);
        }
        
        return device;
    }
    
    /**
     * 检测iOS设备型号
     */
    detectIOSModel(userAgent) {
        if (/iPad/.test(userAgent)) return 'iPad';
        if (/iPhone/.test(userAgent)) {
            // 根据屏幕尺寸推测iPhone型号
            const { width, height } = this.deviceInfo?.screenSize || window.screen;
            const maxDimension = Math.max(width, height);
            
            if (maxDimension >= 926) return 'iPhone Pro Max';
            if (maxDimension >= 844) return 'iPhone Pro';
            if (maxDimension >= 812) return 'iPhone X/11/12/13';
            if (maxDimension >= 736) return 'iPhone Plus';
            return 'iPhone';
        }
        return 'iOS Device';
    }
    
    /**
     * 检测Android设备型号
     */
    detectAndroidModel(userAgent) {
        // 简单的Android设备检测
        if (/Samsung/i.test(userAgent)) return 'Samsung';
        if (/Huawei/i.test(userAgent)) return 'Huawei';
        if (/Xiaomi/i.test(userAgent)) return 'Xiaomi';
        if (/OnePlus/i.test(userAgent)) return 'OnePlus';
        return 'Android Device';
    }
    
    /**
     * 获取设备特定配置
     */
    getDeviceSpecificConfig() {
        const config = {};
        
        // iOS设备调整
        if (this.deviceInfo.isIOS) {
            config.swipeMinDistance = 25; // iOS触摸更敏感
            config.tapMaxTime = 150;
        }
        
        // Android设备调整
        if (this.deviceInfo.isAndroid) {
            config.swipeMinDistance = 35; // Android需要更大的滑动距离
            config.longPressTime = 600;
        }
        
        // 平板设备调整
        if (this.deviceInfo.isTablet) {
            config.swipeMinDistance *= 1.5;
            config.tapMaxDistance *= 1.5;
        }
        
        return config;
    }
    
    /**
     * 设置高级触摸事件
     */
    setupAdvancedTouchEvents() {
        const canvas = this.game.canvas;
        
        // 使用被动监听器提高性能
        const options = { passive: false };
        
        canvas.addEventListener('touchstart', (e) => this.handleAdvancedTouchStart(e), options);
        canvas.addEventListener('touchmove', (e) => this.handleAdvancedTouchMove(e), options);
        canvas.addEventListener('touchend', (e) => this.handleAdvancedTouchEnd(e), options);
        canvas.addEventListener('touchcancel', (e) => this.handleAdvancedTouchCancel(e), options);
        
        // 防止默认的触摸行为
        canvas.addEventListener('touchstart', (e) => e.preventDefault());
        canvas.addEventListener('touchmove', (e) => e.preventDefault());
        canvas.addEventListener('touchend', (e) => e.preventDefault());
        
        // 处理指针事件（更现代的API）
        if ('PointerEvent' in window) {
            this.setupPointerEvents(canvas);
        }
    }
    
    /**
     * 设置指针事件（支持触摸笔等）
     */
    setupPointerEvents(canvas) {
        canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') {
                this.handlePointerDown(e);
            }
        });
        
        canvas.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'touch') {
                this.handlePointerMove(e);
            }
        });
        
        canvas.addEventListener('pointerup', (e) => {
            if (e.pointerType === 'touch') {
                this.handlePointerUp(e);
            }
        });
    }
    
    /**
     * 处理高级触摸开始
     */
    handleAdvancedTouchStart(event) {
        const touches = Array.from(event.touches);
        const timestamp = Date.now();
        
        // 记录所有触摸点
        touches.forEach((touch, index) => {
            const touchData = this.createTouchData(touch, timestamp);
            this.multiTouchState.touches.set(touch.identifier, touchData);
        });
        
        // 处理单点触摸
        if (touches.length === 1) {
            this.handleSingleTouchStart(touches[0], timestamp);
        }
        // 处理多点触摸
        else if (touches.length === 2) {
            this.handleMultiTouchStart(touches, timestamp);
        }
        
        this.addGestureToHistory('touchstart', { touchCount: touches.length, timestamp });
    }
    
    /**
     * 处理高级触摸移动
     */
    handleAdvancedTouchMove(event) {
        const touches = Array.from(event.touches);
        const timestamp = Date.now();
        
        // 更新触摸点数据
        touches.forEach(touch => {
            const existingTouch = this.multiTouchState.touches.get(touch.identifier);
            if (existingTouch) {
                this.updateTouchData(existingTouch, touch, timestamp);
            }
        });
        
        // 处理单点滑动
        if (touches.length === 1) {
            this.handleSingleTouchMove(touches[0], timestamp);
        }
        // 处理多点手势
        else if (touches.length === 2) {
            this.handleMultiTouchMove(touches, timestamp);
        }
    }
    
    /**
     * 处理高级触摸结束
     */
    handleAdvancedTouchEnd(event) {
        const timestamp = Date.now();
        const remainingTouches = Array.from(event.touches);
        
        // 找出结束的触摸点
        const endedTouches = [];
        this.multiTouchState.touches.forEach((touchData, id) => {
            if (!remainingTouches.find(t => t.identifier === id)) {
                endedTouches.push(touchData);
                this.multiTouchState.touches.delete(id);
            }
        });
        
        // 处理手势识别
        endedTouches.forEach(touchData => {
            this.recognizeGesture(touchData, timestamp);
        });
        
        // 清理多点触摸状态
        if (remainingTouches.length === 0) {
            this.resetMultiTouchState();
        }
        
        this.addGestureToHistory('touchend', { 
            endedCount: endedTouches.length, 
            remainingCount: remainingTouches.length,
            timestamp 
        });
    }
    
    /**
     * 处理触摸取消
     */
    handleAdvancedTouchCancel(event) {
        this.multiTouchState.touches.clear();
        this.resetMultiTouchState();
        this.addGestureToHistory('touchcancel', { timestamp: Date.now() });
    }
    
    /**
     * 创建触摸数据对象
     */
    createTouchData(touch, timestamp) {
        const rect = this.game.canvas.getBoundingClientRect();
        
        return {
            id: touch.identifier,
            startX: touch.clientX - rect.left,
            startY: touch.clientY - rect.top,
            currentX: touch.clientX - rect.left,
            currentY: touch.clientY - rect.top,
            startTime: timestamp,
            lastMoveTime: timestamp,
            totalDistance: 0,
            velocity: { x: 0, y: 0 },
            path: [{ x: touch.clientX - rect.left, y: touch.clientY - rect.top, time: timestamp }]
        };
    }
    
    /**
     * 更新触摸数据
     */
    updateTouchData(touchData, touch, timestamp) {
        const rect = this.game.canvas.getBoundingClientRect();
        const newX = touch.clientX - rect.left;
        const newY = touch.clientY - rect.top;
        
        // 计算速度
        const deltaTime = timestamp - touchData.lastMoveTime;
        if (deltaTime > 0) {
            touchData.velocity.x = (newX - touchData.currentX) / deltaTime;
            touchData.velocity.y = (newY - touchData.currentY) / deltaTime;
        }
        
        // 计算总距离
        const deltaX = newX - touchData.currentX;
        const deltaY = newY - touchData.currentY;
        touchData.totalDistance += Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // 更新位置
        touchData.currentX = newX;
        touchData.currentY = newY;
        touchData.lastMoveTime = timestamp;
        
        // 记录路径
        touchData.path.push({ x: newX, y: newY, time: timestamp });
        
        // 限制路径长度
        if (touchData.path.length > 50) {
            touchData.path.shift();
        }
    }
    
    /**
     * 处理单点触摸开始
     */
    handleSingleTouchStart(touch, timestamp) {
        // 显示触摸反馈
        this.showTouchFeedback(touch.clientX, touch.clientY);
    }
    
    /**
     * 处理单点触摸移动
     */
    handleSingleTouchMove(touch, timestamp) {
        const touchData = this.multiTouchState.touches.get(touch.identifier);
        if (!touchData) return;
        
        // 实时滑动检测
        const deltaX = touchData.currentX - touchData.startX;
        const deltaY = touchData.currentY - touchData.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > this.touchConfig.swipeMinDistance) {
            this.handleRealtimeSwipe(deltaX, deltaY, touchData);
        }
    }
    
    /**
     * 处理多点触摸开始
     */
    handleMultiTouchStart(touches, timestamp) {
        this.multiTouchState.gestureStartTime = timestamp;
        
        // 计算初始距离和角度
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        this.multiTouchState.initialDistance = this.calculateDistance(touch1, touch2);
        this.multiTouchState.initialAngle = this.calculateAngle(touch1, touch2);
        
        // 提供触觉反馈
        this.provideTactileFeedback('multitouch');
    }
    
    /**
     * 处理多点触摸移动
     */
    handleMultiTouchMove(touches, timestamp) {
        if (touches.length !== 2) return;
        
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        const currentDistance = this.calculateDistance(touch1, touch2);
        const currentAngle = this.calculateAngle(touch1, touch2);
        
        // 检测缩放手势
        const scaleRatio = currentDistance / this.multiTouchState.initialDistance;
        if (Math.abs(scaleRatio - 1) > 0.1) {
            this.handlePinchGesture(scaleRatio);
        }
        
        // 检测旋转手势
        const angleDiff = currentAngle - this.multiTouchState.initialAngle;
        if (Math.abs(angleDiff) > 15) { // 15度阈值
            this.handleRotationGesture(angleDiff);
        }
    }
    
    /**
     * 识别手势
     */
    recognizeGesture(touchData, endTime) {
        const duration = endTime - touchData.startTime;
        const deltaX = touchData.currentX - touchData.startX;
        const deltaY = touchData.currentY - touchData.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // 长按手势
        if (duration >= this.touchConfig.longPressTime && distance < this.touchConfig.tapMaxDistance) {
            this.handleLongPress(touchData);
            return;
        }
        
        // 点击手势
        if (duration < this.touchConfig.tapMaxTime && distance < this.touchConfig.tapMaxDistance) {
            this.handleTap(touchData);
            return;
        }
        
        // 滑动手势
        if (duration < this.touchConfig.swipeMaxTime && distance >= this.touchConfig.swipeMinDistance) {
            this.handleSwipe(deltaX, deltaY, touchData);
            return;
        }
        
        // 复杂手势分析
        this.analyzeComplexGesture(touchData);
    }
    
    /**
     * 处理实时滑动
     */
    handleRealtimeSwipe(deltaX, deltaY, touchData) {
        // 防止重复触发
        const now = Date.now();
        if (now - touchData.lastSwipeTime < 100) return;
        touchData.lastSwipeTime = now;
        
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        
        if (absX > absY) {
            // 水平滑动
            if (deltaX > 0) {
                this.inputController.executeAction('moveRight', 'swipe', false);
            } else {
                this.inputController.executeAction('moveLeft', 'swipe', false);
            }
        }
    }
    
    /**
     * 处理点击
     */
    handleTap(touchData) {
        const canvasWidth = this.game.canvas.width;
        const x = touchData.startX;
        
        // 根据点击位置确定动作
        if (x < canvasWidth / 3) {
            this.inputController.executeAction('moveLeft', 'tap', false);
        } else if (x > canvasWidth * 2 / 3) {
            this.inputController.executeAction('moveRight', 'tap', false);
        } else {
            this.inputController.executeAction('rotateClockwise', 'tap', false);
        }
        
        this.provideTactileFeedback('tap');
        this.showTapFeedback(touchData.startX, touchData.startY);
    }
    
    /**
     * 处理滑动
     */
    handleSwipe(deltaX, deltaY, touchData) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        
        if (absX > absY && absX > this.touchConfig.swipeMinDistance) {
            // 水平滑动
            if (deltaX > 0) {
                this.inputController.executeAction('moveRight', 'swipe', false);
            } else {
                this.inputController.executeAction('moveLeft', 'swipe', false);
            }
        } else if (absY > absX && absY > this.touchConfig.swipeMinDistance) {
            // 垂直滑动
            if (deltaY > 0) {
                this.inputController.executeAction('hardDrop', 'swipe', false);
            } else {
                this.inputController.executeAction('rotateClockwise', 'swipe', false);
            }
        }
        
        this.provideTactileFeedback('swipe');
        this.showSwipeFeedback(touchData.startX, touchData.startY, deltaX, deltaY);
    }
    
    /**
     * 处理长按
     */
    handleLongPress(touchData) {
        this.inputController.executeAction('pause', 'longpress', false);
        this.provideTactileFeedback('longpress');
        this.showLongPressFeedback(touchData.startX, touchData.startY);
    }
    
    /**
     * 处理缩放手势
     */
    handlePinchGesture(scaleRatio) {
        // 可以用于调整游戏速度或其他功能
        console.log('缩放手势:', scaleRatio);
    }
    
    /**
     * 处理旋转手势
     */
    handleRotationGesture(angleDiff) {
        if (angleDiff > 0) {
            this.inputController.executeAction('rotateClockwise', 'rotation', false);
        } else {
            this.inputController.executeAction('rotateCounterclockwise', 'rotation', false);
        }
        
        this.provideTactileFeedback('rotation');
    }
    
    /**
     * 分析复杂手势
     */
    analyzeComplexGesture(touchData) {
        // 分析触摸路径，识别特殊手势
        const path = touchData.path;
        if (path.length < 3) return;
        
        // 检测圆形手势
        if (this.isCircularGesture(path)) {
            this.inputController.executeAction('rotateClockwise', 'circle', false);
            return;
        }
        
        // 检测Z字形手势
        if (this.isZigzagGesture(path)) {
            this.inputController.executeAction('hardDrop', 'zigzag', false);
            return;
        }
    }
    
    /**
     * 检测圆形手势
     */
    isCircularGesture(path) {
        if (path.length < 8) return false;
        
        // 简单的圆形检测算法
        const center = this.calculatePathCenter(path);
        const avgRadius = this.calculateAverageRadius(path, center);
        
        let angleSum = 0;
        for (let i = 1; i < path.length - 1; i++) {
            const angle1 = Math.atan2(path[i-1].y - center.y, path[i-1].x - center.x);
            const angle2 = Math.atan2(path[i].y - center.y, path[i].x - center.x);
            angleSum += this.normalizeAngle(angle2 - angle1);
        }
        
        return Math.abs(angleSum) > Math.PI * 1.5; // 至少3/4圆
    }
    
    /**
     * 检测Z字形手势
     */
    isZigzagGesture(path) {
        if (path.length < 6) return false;
        
        let directionChanges = 0;
        let lastDirection = null;
        
        for (let i = 1; i < path.length; i++) {
            const deltaX = path[i].x - path[i-1].x;
            const deltaY = path[i].y - path[i-1].y;
            
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                const currentDirection = deltaX > 0 ? 'right' : 'left';
                if (lastDirection && lastDirection !== currentDirection) {
                    directionChanges++;
                }
                lastDirection = currentDirection;
            }
        }
        
        return directionChanges >= 2;
    }
    
    /**
     * 设置屏幕方向处理
     */
    setupOrientationHandling() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });
        
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    /**
     * 处理屏幕方向改变
     */
    handleOrientationChange() {
        const newOrientation = window.orientation || 0;
        console.log('屏幕方向改变:', newOrientation);
        
        // 更新设备信息
        this.deviceInfo.orientation = newOrientation;
        
        // 调整触摸配置
        this.adjustConfigForOrientation(newOrientation);
        
        // 重新布局虚拟控件
        this.adjustVirtualControls();
    }
    
    /**
     * 处理窗口大小改变
     */
    handleResize() {
        // 更新设备信息
        this.deviceInfo.screenSize.width = window.screen.width;
        this.deviceInfo.screenSize.height = window.screen.height;
        
        // 重新检测设备类型
        this.deviceInfo.isPhone = window.innerWidth <= 768;
        this.deviceInfo.isTablet = window.innerWidth > 768 && this.deviceInfo.isTablet;
    }
    
    /**
     * 根据方向调整配置
     */
    adjustConfigForOrientation(orientation) {
        if (Math.abs(orientation) === 90) {
            // 横屏模式
            this.touchConfig.swipeMinDistance *= 1.2;
        } else {
            // 竖屏模式
            this.touchConfig.swipeMinDistance = this.getDeviceSpecificConfig().swipeMinDistance || 30;
        }
    }
    
    /**
     * 调整虚拟控件
     */
    adjustVirtualControls() {
        const mobileControls = document.querySelector('.mobile-controls');
        if (mobileControls) {
            const isLandscape = Math.abs(window.orientation) === 90;
            mobileControls.style.flexDirection = isLandscape ? 'row' : 'column';
        }
    }
    
    /**
     * 设置视觉反馈
     */
    setupVisualFeedback() {
        // 创建反馈元素容器
        this.feedbackContainer = document.createElement('div');
        this.feedbackContainer.className = 'touch-feedback-container';
        this.feedbackContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
        `;
        document.body.appendChild(this.feedbackContainer);
    }
    
    /**
     * 显示触摸反馈
     */
    showTouchFeedback(x, y) {
        const feedback = document.createElement('div');
        feedback.className = 'touch-ripple';
        feedback.style.cssText = `
            position: absolute;
            left: ${x - 20}px;
            top: ${y - 20}px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(76, 175, 80, 0.3);
            border: 2px solid rgba(76, 175, 80, 0.6);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
        `;
        
        this.feedbackContainer.appendChild(feedback);
        
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 600);
    }
    
    /**
     * 显示点击反馈
     */
    showTapFeedback(x, y) {
        this.showTouchFeedback(x, y);
    }
    
    /**
     * 显示滑动反馈
     */
    showSwipeFeedback(startX, startY, deltaX, deltaY) {
        const feedback = document.createElement('div');
        feedback.className = 'swipe-trail';
        
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        
        feedback.style.cssText = `
            position: absolute;
            left: ${startX}px;
            top: ${startY}px;
            width: ${length}px;
            height: 3px;
            background: linear-gradient(90deg, rgba(76, 175, 80, 0.8), rgba(76, 175, 80, 0.2));
            transform: rotate(${angle}deg);
            transform-origin: 0 50%;
            animation: fadeOut 0.5s ease-out;
            pointer-events: none;
        `;
        
        this.feedbackContainer.appendChild(feedback);
        
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 500);
    }
    
    /**
     * 显示长按反馈
     */
    showLongPressFeedback(x, y) {
        const feedback = document.createElement('div');
        feedback.className = 'longpress-feedback';
        feedback.style.cssText = `
            position: absolute;
            left: ${x - 30}px;
            top: ${y - 30}px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            border: 3px solid rgba(255, 193, 7, 0.8);
            background: rgba(255, 193, 7, 0.2);
            animation: pulse 0.8s ease-out;
            pointer-events: none;
        `;
        
        this.feedbackContainer.appendChild(feedback);
        
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 800);
    }
    
    /**
     * 提供触觉反馈
     */
    provideTactileFeedback(type) {
        if (!this.vibrationSupported) return;
        
        const patterns = {
            tap: [10],
            swipe: [15],
            longpress: [50, 50, 50],
            multitouch: [20, 20, 20],
            rotation: [30]
        };
        
        const pattern = patterns[type] || [10];
        navigator.vibrate(pattern);
    }
    
    /**
     * 工具方法
     */
    
    calculateDistance(touch1, touch2) {
        const deltaX = touch2.clientX - touch1.clientX;
        const deltaY = touch2.clientY - touch1.clientY;
        return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }
    
    calculateAngle(touch1, touch2) {
        return Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX) * 180 / Math.PI;
    }
    
    calculatePathCenter(path) {
        const sumX = path.reduce((sum, point) => sum + point.x, 0);
        const sumY = path.reduce((sum, point) => sum + point.y, 0);
        return { x: sumX / path.length, y: sumY / path.length };
    }
    
    calculateAverageRadius(path, center) {
        const distances = path.map(point => {
            const deltaX = point.x - center.x;
            const deltaY = point.y - center.y;
            return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        });
        return distances.reduce((sum, dist) => sum + dist, 0) / distances.length;
    }
    
    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }
    
    resetMultiTouchState() {
        this.multiTouchState.gestureStartTime = 0;
        this.multiTouchState.initialDistance = 0;
        this.multiTouchState.initialAngle = 0;
    }
    
    addGestureToHistory(type, data) {
        this.gestureHistory.push({ type, data, timestamp: Date.now() });
        
        if (this.gestureHistory.length > this.maxHistoryLength) {
            this.gestureHistory.shift();
        }
    }
    
    /**
     * 获取手势历史
     */
    getGestureHistory() {
        return [...this.gestureHistory];
    }
    
    /**
     * 获取设备信息
     */
    getDeviceInfo() {
        return { ...this.deviceInfo };
    }
    
    /**
     * 销毁处理器
     */
    destroy() {
        // 移除反馈容器
        if (this.feedbackContainer && this.feedbackContainer.parentNode) {
            this.feedbackContainer.parentNode.removeChild(this.feedbackContainer);
        }
        
        // 清除状态
        this.multiTouchState.touches.clear();
        this.gestureHistory = [];
        
        console.log('移动触摸处理器已销毁');
    }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        0% {
            transform: scale(0);
            opacity: 1;
        }
        100% {
            transform: scale(2);
            opacity: 0;
        }
    }
    
    @keyframes fadeOut {
        0% { opacity: 1; }
        100% { opacity: 0; }
    }
    
    @keyframes pulse {
        0% {
            transform: scale(1);
            opacity: 1;
        }
        50% {
            transform: scale(1.2);
            opacity: 0.7;
        }
        100% {
            transform: scale(1);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileTouchHandler;
}