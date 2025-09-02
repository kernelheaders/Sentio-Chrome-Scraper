/**
 * Jest test setup for Sentio Chrome Extension
 */

// Mock Chrome APIs
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn(),
    getURL: jest.fn(path => `chrome-extension://test/${path}`)
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      getBytesInUse: jest.fn(() => Promise.resolve(1024))
    },
    onChanged: {
      addListener: jest.fn()
    }
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    clearAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    create: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    }
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  }
};

// Mock fetch API
global.fetch = jest.fn();

// Mock crypto functions
const mockCrypto = {
  getRandomValues: jest.fn(arr => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
  subtle: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    generateKey: jest.fn(),
    sign: jest.fn(),
    verify: jest.fn()
  }
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto
});

// Mock DOM APIs for content script tests
const mockDocument = {
  readyState: 'complete',
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  createElement: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  title: 'Test Page',
  location: {
    href: 'https://www.sahibinden.com/test',
    hostname: 'www.sahibinden.com'
  }
};

const mockWindow = {
  location: {
    href: 'https://www.sahibinden.com/test',
    hostname: 'www.sahibinden.com'
  },
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  scrollTo: jest.fn(),
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval
};

// Only define document/window if we're in a DOM test environment
if (typeof document === 'undefined') {
  global.document = mockDocument;
}

if (typeof window === 'undefined') {
  global.window = mockWindow;
}

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn()
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

global.localStorage = localStorageMock;

// Mock console methods for production environment
if (process.env.NODE_ENV === 'production') {
  console.log = jest.fn();
  console.debug = jest.fn();
  console.info = jest.fn();
}

// Test utilities
global.testUtils = {
  // Create mock API response
  createMockApiResponse: (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: {
      get: jest.fn(header => {
        if (header === 'content-type') return 'application/json';
        return null;
      })
    }
  }),

  // Create mock job
  createMockJob: (overrides = {}) => ({
    id: 'test-job-123',
    token: 'test-token-456',
    type: 'scrape_listings',
    config: {
      url: 'https://www.sahibinden.com/emlak',
      selectors: {
        listing: '.searchResultsItem',
        title: '.searchResultsTaglineText a',
        price: '.searchResultsPriceValue'
      },
      maxItems: 10
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    ...overrides
  }),

  // Create mock DOM element
  createMockElement: (tag = 'div', attributes = {}) => {
    const element = {
      tagName: tag.toUpperCase(),
      textContent: '',
      innerHTML: '',
      getAttribute: jest.fn(attr => attributes[attr] || null),
      setAttribute: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      getBoundingClientRect: jest.fn(() => ({
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100
      })),
      scrollIntoView: jest.fn(),
      click: jest.fn(),
      focus: jest.fn(),
      blur: jest.fn(),
      dispatchEvent: jest.fn(),
      ...attributes
    };

    return element;
  },

  // Wait for async operations in tests
  waitFor: (condition, timeout = 1000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, 10);
        }
      };
      
      check();
    });
  },

  // Create mock fetch response
  mockFetchResponse: (data, options = {}) => {
    const response = {
      ok: options.status ? options.status >= 200 && options.status < 300 : true,
      status: options.status || 200,
      statusText: options.statusText || 'OK',
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
      headers: new Map(Object.entries(options.headers || {}))
    };

    global.fetch.mockResolvedValueOnce(response);
    return response;
  }
};

// Setup cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset fetch mock
  global.fetch.mockClear();
  
  // Clear chrome API mocks
  chrome.runtime.sendMessage.mockClear();
  chrome.storage.local.get.mockClear();
  chrome.storage.local.set.mockClear();
  chrome.tabs.query.mockClear();
  chrome.tabs.sendMessage.mockClear();
});

// Global test timeout
jest.setTimeout(10000);