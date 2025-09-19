/**
 * Jest测试环境设置文件
 * 配置全局测试环境和模拟对象
 */

// 模拟Canvas API
global.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  clearRect: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  rotate: jest.fn(),
  scale: jest.fn(),
  drawImage: jest.fn(),
  createImageData: jest.fn(),
  getImageData: jest.fn(),
  putImageData: jest.fn()
}));

// 模拟requestAnimationFrame
global.requestAnimationFrame = jest.fn((callback) => {
  return setTimeout(callback, 16); // 模拟60fps
});

global.cancelAnimationFrame = jest.fn((id) => {
  clearTimeout(id);
});

// 模拟performance API
global.performance = {
  now: jest.fn(() => Date.now())
};

// 模拟localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};
global.localStorage = localStorageMock;

// 模拟sessionStorage
global.sessionStorage = localStorageMock;

// 模拟WebSocket
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

// 模拟fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    headers: new Map()
  })
);

// 模拟URL API
global.URL = {
  createObjectURL: jest.fn(() => 'mock-url'),
  revokeObjectURL: jest.fn()
};

// 模拟navigator
global.navigator = {
  userAgent: 'Mozilla/5.0 (Test Environment)',
  platform: 'Test',
  language: 'en-US',
  languages: ['en-US', 'en'],
  onLine: true,
  cookieEnabled: true,
  geolocation: {
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn()
  }
};

// 模拟window对象的方法
global.window = {
  ...global.window,
  alert: jest.fn(),
  confirm: jest.fn(() => true),
  prompt: jest.fn(() => 'test'),
  open: jest.fn(),
  close: jest.fn(),
  focus: jest.fn(),
  blur: jest.fn(),
  getComputedStyle: jest.fn(() => ({})),
  matchMedia: jest.fn(() => ({
    matches: false,
    addListener: jest.fn(),
    removeListener: jest.fn()
  })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  location: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    reload: jest.fn(),
    assign: jest.fn(),
    replace: jest.fn()
  },
  history: {
    length: 1,
    state: null,
    back: jest.fn(),
    forward: jest.fn(),
    go: jest.fn(),
    pushState: jest.fn(),
    replaceState: jest.fn()
  }
};

// 模拟document对象的方法
global.document = {
  ...global.document,
  createElement: jest.fn((tagName) => {
    const element = {
      tagName: tagName.toUpperCase(),
      style: {},
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(() => false),
        toggle: jest.fn()
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      getAttribute: jest.fn(),
      setAttribute: jest.fn(),
      removeAttribute: jest.fn(),
      hasAttribute: jest.fn(() => false),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      insertBefore: jest.fn(),
      cloneNode: jest.fn(),
      innerHTML: '',
      textContent: '',
      value: '',
      checked: false,
      disabled: false,
      hidden: false,
      id: '',
      className: '',
      width: 0,
      height: 0
    };
    
    // Canvas特殊处理
    if (tagName.toLowerCase() === 'canvas') {
      element.getContext = global.HTMLCanvasElement.prototype.getContext;
      element.width = 300;
      element.height = 150;
    }
    
    return element;
  }),
  getElementById: jest.fn(),
  getElementsByClassName: jest.fn(() => []),
  getElementsByTagName: jest.fn(() => []),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  createEvent: jest.fn(() => ({
    initEvent: jest.fn()
  })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    style: {}
  },
  head: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  },
  documentElement: {
    style: {}
  },
  readyState: 'complete'
};

// 设置Jest匹配器
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toBeValidTetromino(received) {
    const validTypes = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    const hasValidType = validTypes.includes(received.type);
    const hasShape = Array.isArray(received.shape);
    const hasPosition = typeof received.x === 'number' && typeof received.y === 'number';
    const hasRotation = typeof received.rotation === 'number';
    const hasColor = typeof received.color === 'string';
    
    const pass = hasValidType && hasShape && hasPosition && hasRotation && hasColor;
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid tetromino`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid tetromino`,
        pass: false,
      };
    }
  }
});

// 全局测试工具函数
global.createMockCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 600;
  return canvas;
};

global.createMockGameConfig = () => ({
  boardWidth: 10,
  boardHeight: 20,
  cellSize: 30,
  initialSpeed: 1000,
  speedIncrease: 0.9
});

global.waitForAnimationFrame = () => {
  return new Promise(resolve => {
    requestAnimationFrame(resolve);
  });
};

// 清理函数
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('Jest测试环境设置完成');