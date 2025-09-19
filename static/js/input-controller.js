/**
 * InputController - 用户输入和控制系统
 * 处理键盘和触摸输入，支持按键重复、防抖动和自定义配置
 */
class InputController {
    constructor(gameInstance) {
        this.game = gameInstance;
        
        // 键盘控制配置
        this.keyConfig = {
            // 移动控制
            moveLeft: ['ArrowLeft', 'KeyA'],
            moveRight: ['ArrowRight', 'KeyD'],
            moveDown: ['ArrowDown', 'KeyS'],
            
            // 旋转控制
            rotateClockwise: ['ArrowUp', 'KeyX', 'KeyW'],
            rotateCounterclockwise: ['KeyZ'],
            
            // 特殊操作
            hardDrop: ['Space'],
            pause: ['KeyP', 'Escape'],
            hold: ['KeyC', 'Shift']
        };
        
        // 按键状态管理
        this.keyState = new Map();
        this.keyTimers = new Map();
        this.keyRepeatConfig = {
            initialDelay: 170,    // 首次重复延迟 (ms)
            repeatInterval: 50,   // 重复间隔 (ms)
            fastRepeatKeys: ['ArrowLeft', 'ArrowRight', 'ArrowDown'], // 支持快速重复的按键
            slowRepeatKeys: ['KeyA', 'KeyD', 'KeyS'] // 较慢重复的按键
        };
        
        // 防抖动配置
        this.debounceConfig = {
            rotateDelay: 100,     // 旋转防抖延迟
            pauseDelay: 200,      // 暂停防抖延迟
            hardDropDelay: 150    // 硬降落防抖延迟
        };
        
        // 防抖动状态
        this.debounceTimers = new Map();
        
        // 触摸控制状态
        this.touchState = {
            isEnabled: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            isDragging: false,
            swipeThreshold: 50,   // 滑动阈值
            tapThreshold: 10,     // 点击阈值
            touchStartTime: 0,
            maxTapDuration: 200   // 最大点击持续时间
        };
        
        // 手势识别配置
        this.gestureConfig = {
            swipeMinDistance: 30,
            swipeMaxTime: 300,
            tapMaxDistance: 15,
            tapMaxTime: 200,
            longPressTime: 500
        };
        
        // 虚拟按钮状态
        this.virtualButtons = new Map();
        
        // 移动触摸处理器
        this.mobileTouchHandler = null;
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化输入控制系统
     */
    init() {
        this.setupKeyboardControls();
        this.setupTouchControls();
        this.detectMobileDevice();
        this.setupVirtualButtons();
        this.initializeMobileTouchHandler();
        
        console.log('输入控制系统初始化完成');
    }
    
    /**
     * 设置键盘控制
     */
    setupKeyboardControls() {
        // 键盘按下事件
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        }, { passive: false });
        
        // 键盘释放事件
        document.addEventListener('keyup', (e) => {
            this.handleKeyUp(e);
        }, { passive: false });
        
        // 防止页面滚动等默认行为
        document.addEventListener('keydown', (e) => {
            if (this.isGameKey(e.code)) {
                e.preventDefault();
            }
        });
        
        // 窗口失焦时清除所有按键状态
        window.addEventListener('blur', () => {
            this.clearAllKeyStates();
        });
    }
    
    /**
     * 处理键盘按下事件
     */
    handleKeyDown(event) {
        const keyCode = event.code;
        
        // 检查游戏状态
        if (!this.game || this.game.gameState.isGameOver) {
            return;
        }
        
        // 防止重复触发
        if (this.keyState.get(keyCode)) {
            return;
        }
        
        // 设置按键状态
        this.keyState.set(keyCode, true);
        
        // 立即处理按键
        this.processKeyInput(keyCode, false);
        
        // 设置按键重复
        this.setupKeyRepeat(keyCode);
    }
    
    /**
     * 处理键盘释放事件
     */
    handleKeyUp(event) {
        const keyCode = event.code;
        
        // 清除按键状态
        this.keyState.set(keyCode, false);
        
        // 清除重复定时器
        this.clearKeyRepeat(keyCode);
    }
    
    /**
     * 设置按键重复
     */
    setupKeyRepeat(keyCode) {
        // 只有特定按键支持重复
        if (!this.shouldRepeatKey(keyCode)) {
            return;
        }
        
        // 获取重复配置
        const config = this.getKeyRepeatConfig(keyCode);
        
        // 设置初始延迟
        const initialTimer = setTimeout(() => {
            // 开始重复
            const repeatTimer = setInterval(() => {
                if (this.keyState.get(keyCode) && 
                    !this.game.gameState.isGameOver && 
                    !this.game.gameState.isPaused) {
                    this.processKeyInput(keyCode, true);
                } else {
                    this.clearKeyRepeat(keyCode);
                }
            }, config.interval);
            
            this.keyTimers.set(keyCode, repeatTimer);
        }, config.delay);
        
        this.keyTimers.set(keyCode, initialTimer);
    }
    
    /**
     * 清除按键重复
     */
    clearKeyRepeat(keyCode) {
        const timer = this.keyTimers.get(keyCode);
        if (timer) {
            clearTimeout(timer);
            clearInterval(timer);
            this.keyTimers.delete(keyCode);
        }
    }
    
    /**
     * 处理按键输入
     */
    processKeyInput(keyCode, isRepeat = false) {
        // 查找按键对应的动作
        const action = this.getKeyAction(keyCode);
        if (!action) return;
        
        // 检查防抖动
        if (!isRepeat && this.isDebounced(action)) {
            return;
        }
        
        // 执行动作
        this.executeAction(action, keyCode, isRepeat);
        
        // 设置防抖动
        if (!isRepeat) {
            this.setDebounce(action);
        }
    }
    
    /**
     * 执行游戏动作
     */
    executeAction(action, keyCode, isRepeat) {
        if (!this.game || this.game.gameState.isGameOver) {
            return;
        }
        
        switch (action) {
            case 'moveLeft':
                this.game.moveTetromino(-1, 0);
                break;
                
            case 'moveRight':
                this.game.moveTetromino(1, 0);
                break;
                
            case 'moveDown':
                this.game.moveTetromino(0, 1);
                break;
                
            case 'rotateClockwise':
                if (!isRepeat) { // 旋转不支持重复
                    this.game.rotateTetromino('clockwise');
                }
                break;
                
            case 'rotateCounterclockwise':
                if (!isRepeat) {
                    this.game.rotateTetromino('counterclockwise');
                }
                break;
                
            case 'hardDrop':
                if (!isRepeat) {
                    this.game.hardDrop();
                }
                break;
                
            case 'pause':
                if (!isRepeat) {
                    this.game.togglePause();
                }
                break;
                
            case 'hold':
                if (!isRepeat) {
                    this.game.holdTetromino && this.game.holdTetromino();
                }
                break;
        }
    }
    
    /**
     * 设置触摸控制
     */
    setupTouchControls() {
        const canvas = this.game.canvas;
        
        // 触摸开始
        canvas.addEventListener('touchstart', (e) => {
            this.handleTouchStart(e);
        }, { passive: false });
        
        // 触摸移动
        canvas.addEventListener('touchmove', (e) => {
            this.handleTouchMove(e);
        }, { passive: false });
        
        // 触摸结束
        canvas.addEventListener('touchend', (e) => {
            this.handleTouchEnd(e);
        }, { passive: false });
        
        // 触摸取消
        canvas.addEventListener('touchcancel', (e) => {
            this.handleTouchCancel(e);
        }, { passive: false });
        
        // 防止默认的触摸行为
        canvas.addEventListener('touchstart', (e) => e.preventDefault());
        canvas.addEventListener('touchmove', (e) => e.preventDefault());
    }
    
    /**
     * 处理触摸开始
     */
    handleTouchStart(event) {
        if (!this.touchState.isEnabled || event.touches.length !== 1) {
            return;
        }
        
        const touch = event.touches[0];
        const rect = this.game.canvas.getBoundingClientRect();
        
        this.touchState.startX = touch.clientX - rect.left;
        this.touchState.startY = touch.clientY - rect.top;
        this.touchState.currentX = this.touchState.startX;
        this.touchState.currentY = this.touchState.startY;
        this.touchState.isDragging = false;
        this.touchState.touchStartTime = Date.now();
    }
    
    /**
     * 处理触摸移动
     */
    handleTouchMove(event) {
        if (!this.touchState.isEnabled || event.touches.length !== 1) {
            return;
        }
        
        const touch = event.touches[0];
        const rect = this.game.canvas.getBoundingClientRect();
        
        this.touchState.currentX = touch.clientX - rect.left;
        this.touchState.currentY = touch.clientY - rect.top;
        
        const deltaX = this.touchState.currentX - this.touchState.startX;
        const deltaY = this.touchState.currentY - this.touchState.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > this.touchState.swipeThreshold) {
            this.touchState.isDragging = true;
        }
    }
    
    /**
     * 处理触摸结束
     */
    handleTouchEnd(event) {
        if (!this.touchState.isEnabled) {
            return;
        }
        
        const touchDuration = Date.now() - this.touchState.touchStartTime;
        const deltaX = this.touchState.currentX - this.touchState.startX;
        const deltaY = this.touchState.currentY - this.touchState.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (this.touchState.isDragging) {
            // 处理滑动手势
            this.handleSwipeGesture(deltaX, deltaY, touchDuration);
        } else if (distance < this.gestureConfig.tapMaxDistance && 
                   touchDuration < this.gestureConfig.tapMaxTime) {
            // 处理点击手势
            this.handleTapGesture(this.touchState.startX, this.touchState.startY);
        } else if (touchDuration >= this.gestureConfig.longPressTime) {
            // 处理长按手势
            this.handleLongPressGesture(this.touchState.startX, this.touchState.startY);
        }
        
        // 重置触摸状态
        this.resetTouchState();
    }
    
    /**
     * 处理触摸取消
     */
    handleTouchCancel(event) {
        this.resetTouchState();
    }
    
    /**
     * 处理滑动手势
     */
    handleSwipeGesture(deltaX, deltaY, duration) {
        if (duration > this.gestureConfig.swipeMaxTime) {
            return;
        }
        
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        
        if (absX > absY && absX > this.gestureConfig.swipeMinDistance) {
            // 水平滑动
            if (deltaX > 0) {
                this.executeAction('moveRight', 'touch', false);
            } else {
                this.executeAction('moveLeft', 'touch', false);
            }
        } else if (absY > absX && absY > this.gestureConfig.swipeMinDistance) {
            // 垂直滑动
            if (deltaY > 0) {
                this.executeAction('hardDrop', 'touch', false);
            } else {
                this.executeAction('rotateClockwise', 'touch', false);
            }
        }
    }
    
    /**
     * 处理点击手势
     */
    handleTapGesture(x, y) {
        const canvasWidth = this.game.canvas.width;
        const canvasHeight = this.game.canvas.height;
        
        // 根据点击位置确定动作
        if (x < canvasWidth / 3) {
            // 左侧点击 - 向左移动
            this.executeAction('moveLeft', 'touch', false);
        } else if (x > canvasWidth * 2 / 3) {
            // 右侧点击 - 向右移动
            this.executeAction('moveRight', 'touch', false);
        } else {
            // 中间点击 - 旋转
            this.executeAction('rotateClockwise', 'touch', false);
        }
    }
    
    /**
     * 处理长按手势
     */
    handleLongPressGesture(x, y) {
        // 长按暂停游戏
        this.executeAction('pause', 'touch', false);
    }
    
    /**
     * 设置虚拟按钮
     */
    setupVirtualButtons() {
        const buttons = [
            { id: 'left-btn', action: 'moveLeft' },
            { id: 'right-btn', action: 'moveRight' },
            { id: 'down-btn', action: 'moveDown' },
            { id: 'rotate-btn', action: 'rotateClockwise' },
            { id: 'drop-btn', action: 'hardDrop' }
        ];
        
        buttons.forEach(button => {
            const element = document.getElementById(button.id);
            if (element) {
                this.setupVirtualButton(element, button.action);
            }
        });
    }
    
    /**
     * 设置单个虚拟按钮
     */
    setupVirtualButton(element, action) {
        let isPressed = false;
        let repeatTimer = null;
        
        // 按钮按下
        const handleStart = (e) => {
            e.preventDefault();
            if (isPressed) return;
            
            isPressed = true;
            element.classList.add('pressed');
            
            // 立即执行动作
            this.executeAction(action, 'virtual', false);
            
            // 设置重复（仅限移动动作）
            if (['moveLeft', 'moveRight', 'moveDown'].includes(action)) {
                repeatTimer = setTimeout(() => {
                    repeatTimer = setInterval(() => {
                        if (isPressed) {
                            this.executeAction(action, 'virtual', true);
                        }
                    }, this.keyRepeatConfig.repeatInterval);
                }, this.keyRepeatConfig.initialDelay);
            }
        };
        
        // 按钮释放
        const handleEnd = (e) => {
            e.preventDefault();
            if (!isPressed) return;
            
            isPressed = false;
            element.classList.remove('pressed');
            
            // 清除重复定时器
            if (repeatTimer) {
                clearTimeout(repeatTimer);
                clearInterval(repeatTimer);
                repeatTimer = null;
            }
        };
        
        // 鼠标事件
        element.addEventListener('mousedown', handleStart);
        element.addEventListener('mouseup', handleEnd);
        element.addEventListener('mouseleave', handleEnd);
        
        // 触摸事件
        element.addEventListener('touchstart', handleStart, { passive: false });
        element.addEventListener('touchend', handleEnd, { passive: false });
        element.addEventListener('touchcancel', handleEnd, { passive: false });
        
        this.virtualButtons.set(element.id, { element, action, isPressed: false });
    }
    
    /**
     * 检测移动设备
     */
    detectMobileDevice() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                        window.innerWidth <= 768;
        
        this.touchState.isEnabled = isMobile;
        
        // 显示/隐藏移动控制
        const mobileControls = document.querySelector('.mobile-controls');
        if (mobileControls) {
            mobileControls.style.display = isMobile ? 'block' : 'none';
        }
        
        console.log('移动设备检测:', isMobile ? '是' : '否');
    }
    
    /**
     * 工具方法
     */
    
    isGameKey(keyCode) {
        return Object.values(this.keyConfig).some(keys => keys.includes(keyCode));
    }
    
    getKeyAction(keyCode) {
        for (const [action, keys] of Object.entries(this.keyConfig)) {
            if (keys.includes(keyCode)) {
                return action;
            }
        }
        return null;
    }
    
    shouldRepeatKey(keyCode) {
        return this.keyRepeatConfig.fastRepeatKeys.includes(keyCode) ||
               this.keyRepeatConfig.slowRepeatKeys.includes(keyCode);
    }
    
    getKeyRepeatConfig(keyCode) {
        if (this.keyRepeatConfig.fastRepeatKeys.includes(keyCode)) {
            return {
                delay: this.keyRepeatConfig.initialDelay,
                interval: this.keyRepeatConfig.repeatInterval
            };
        } else if (this.keyRepeatConfig.slowRepeatKeys.includes(keyCode)) {
            return {
                delay: this.keyRepeatConfig.initialDelay * 1.5,
                interval: this.keyRepeatConfig.repeatInterval * 2
            };
        }
        return null;
    }
    
    isDebounced(action) {
        const timer = this.debounceTimers.get(action);
        return timer && Date.now() - timer < this.getDebounceDelay(action);
    }
    
    setDebounce(action) {
        this.debounceTimers.set(action, Date.now());
    }
    
    getDebounceDelay(action) {
        switch (action) {
            case 'rotateClockwise':
            case 'rotateCounterclockwise':
                return this.debounceConfig.rotateDelay;
            case 'pause':
                return this.debounceConfig.pauseDelay;
            case 'hardDrop':
                return this.debounceConfig.hardDropDelay;
            default:
                return 0;
        }
    }
    
    resetTouchState() {
        this.touchState.isDragging = false;
        this.touchState.startX = 0;
        this.touchState.startY = 0;
        this.touchState.currentX = 0;
        this.touchState.currentY = 0;
        this.touchState.touchStartTime = 0;
    }
    
    clearAllKeyStates() {
        this.keyState.clear();
        this.keyTimers.forEach(timer => {
            clearTimeout(timer);
            clearInterval(timer);
        });
        this.keyTimers.clear();
    }
    
    /**
     * 配置管理
     */
    
    updateKeyConfig(newConfig) {
        this.keyConfig = { ...this.keyConfig, ...newConfig };
        console.log('键盘配置已更新:', this.keyConfig);
    }
    
    updateRepeatConfig(newConfig) {
        this.keyRepeatConfig = { ...this.keyRepeatConfig, ...newConfig };
        console.log('按键重复配置已更新:', this.keyRepeatConfig);
    }
    
    updateGestureConfig(newConfig) {
        this.gestureConfig = { ...this.gestureConfig, ...newConfig };
        console.log('手势配置已更新:', this.gestureConfig);
    }
    
    /**
     * 启用/禁用控制
     */
    
    enableTouchControls() {
        this.touchState.isEnabled = true;
        console.log('触摸控制已启用');
    }
    
    disableTouchControls() {
        this.touchState.isEnabled = false;
        this.resetTouchState();
        console.log('触摸控制已禁用');
    }
    
    /**
     * 初始化移动触摸处理器
     */
    initializeMobileTouchHandler() {
        if (this.touchState.isEnabled && typeof MobileTouchHandler !== 'undefined') {
            this.mobileTouchHandler = new MobileTouchHandler(this);
            console.log('移动触摸处理器已初始化');
        }
    }

    /**
     * 销毁控制器
     */
    destroy() {
        // 清除所有定时器
        this.clearAllKeyStates();
        this.debounceTimers.clear();
        
        // 清除虚拟按钮状态
        this.virtualButtons.forEach(button => {
            button.element.classList.remove('pressed');
        });
        
        // 销毁移动触摸处理器
        if (this.mobileTouchHandler) {
            this.mobileTouchHandler.destroy();
            this.mobileTouchHandler = null;
        }
        
        console.log('输入控制器已销毁');
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputController;
}