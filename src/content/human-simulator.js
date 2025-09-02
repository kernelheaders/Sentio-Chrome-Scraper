/**
 * Human behavior simulation for Sentio Chrome Extension
 * Implements realistic user interaction patterns to avoid detection
 */
import { logger } from '../utils/logger.js';
import { CONFIG } from '../shared/types.js';

export class HumanSimulator {
  constructor() {
    this.isActive = false;
    this.backgroundActivityInterval = null;
    this.mousePosition = { x: 0, y: 0 };
    this.lastActionTime = 0;
    this.actionHistory = [];
    this.sessionStartTime = Date.now();
    
    this.config = {
      minDelay: CONFIG.MIN_ACTION_DELAY || 500,
      maxDelay: CONFIG.MAX_ACTION_DELAY || 2000,
      minScrollDelay: CONFIG.MIN_SCROLL_DELAY || 200,
      maxScrollDelay: CONFIG.MAX_SCROLL_DELAY || 800,
      mouseMoveSteps: 10,
      mouseMoveDelay: 50
    };
  }

  /**
   * Start background human-like activity
   */
  startBackgroundActivity() {
    if (this.isActive) return;

    this.isActive = true;
    logger.debug('Starting human simulation background activity');

    // Periodic subtle mouse movements
    this.backgroundActivityInterval = setInterval(() => {
      if (Math.random() < 0.3) { // 30% chance
        this.subtleMouseMovement();
      }
    }, 15000 + Math.random() * 30000); // Every 15-45 seconds

    // Initial mouse position setup
    this.initializeMousePosition();
  }

  /**
   * Stop background activity
   */
  stopBackgroundActivity() {
    if (!this.isActive) return;

    this.isActive = false;
    
    if (this.backgroundActivityInterval) {
      clearInterval(this.backgroundActivityInterval);
      this.backgroundActivityInterval = null;
    }

    logger.debug('Stopped human simulation background activity');
  }

  /**
   * Simulate human-like clicking on an element
   */
  async clickElement(element, options = {}) {
    try {
      if (!element) {
        throw new Error('Element not found for clicking');
      }

      // Wait before action to simulate human thinking
      await this.randomDelay(300, 1000);

      // Scroll element into view if needed
      await this.scrollIntoView(element);

      // Move mouse to element with human-like path
      await this.moveMouseToElement(element);

      // Add small delay before click
      await this.randomDelay(100, 300);

      // Perform the actual click
      const rect = element.getBoundingClientRect();
      const clickX = rect.left + rect.width / 2 + (Math.random() - 0.5) * 10;
      const clickY = rect.top + rect.height / 2 + (Math.random() - 0.5) * 10;

      // Create and dispatch mouse events
      await this.simulateMouseClick(element, clickX, clickY);

      // Record action
      this.recordAction('click', { elementTag: element.tagName, position: { x: clickX, y: clickY } });

      logger.debug('Human-like click performed');

    } catch (error) {
      logger.error('Failed to perform human-like click:', error);
      throw error;
    }
  }

  /**
   * Simulate typing with human-like speed and errors
   */
  async typeText(element, text, options = {}) {
    try {
      if (!element || !text) {
        throw new Error('Element or text not provided for typing');
      }

      // Focus the element
      element.focus();

      // Clear existing content
      element.value = '';

      // Type each character with human-like delays
      for (let i = 0; i < text.length; i++) {
        if (Math.random() < 0.05 && options.simulateErrors) {
          // 5% chance of typing error
          const wrongChar = this.getRandomChar();
          element.value += wrongChar;
          
          // Pause and then correct
          await this.randomDelay(200, 500);
          element.value = element.value.slice(0, -1);
          await this.randomDelay(100, 200);
        }

        element.value += text[i];
        
        // Trigger input event
        element.dispatchEvent(new Event('input', { bubbles: true }));

        // Human-like typing delay
        await this.randomDelay(50, 150);
      }

      // Trigger change event
      element.dispatchEvent(new Event('change', { bubbles: true }));

      this.recordAction('type', { length: text.length });

    } catch (error) {
      logger.error('Failed to simulate typing:', error);
      throw error;
    }
  }

  /**
   * Simulate human-like scrolling
   */
  async scrollPage(direction = 'down', distance = null) {
    try {
      const scrollDistance = distance || (200 + Math.random() * 300);
      const currentScroll = window.pageYOffset;
      const targetScroll = direction === 'down' 
        ? currentScroll + scrollDistance 
        : Math.max(0, currentScroll - scrollDistance);

      // Smooth scrolling in steps
      const steps = 8 + Math.random() * 4; // 8-12 steps
      const stepDistance = (targetScroll - currentScroll) / steps;
      
      for (let i = 0; i < steps; i++) {
        const newScroll = currentScroll + (stepDistance * (i + 1));
        window.scrollTo(0, newScroll);
        
        await this.randomDelay(30, 80);
      }

      // Add reading pause at end
      await this.randomDelay(500, 1500);

      this.recordAction('scroll', { direction, distance: scrollDistance });

    } catch (error) {
      logger.error('Failed to simulate scrolling:', error);
      throw error;
    }
  }

  /**
   * Scroll element into view with human-like behavior
   */
  async scrollIntoView(element) {
    try {
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Check if element is already visible
      if (rect.top >= 0 && rect.bottom <= windowHeight) {
        return; // Already visible
      }

      // Determine scroll direction and distance
      let scrollDistance;
      if (rect.top < 0) {
        // Element is above viewport
        scrollDistance = rect.top - 100; // Add some padding
      } else {
        // Element is below viewport
        scrollDistance = rect.bottom - windowHeight + 100;
      }

      // Perform human-like scrolling
      await this.scrollPage(scrollDistance > 0 ? 'down' : 'up', Math.abs(scrollDistance));

    } catch (error) {
      logger.error('Failed to scroll element into view:', error);
    }
  }

  /**
   * Move mouse to element with human-like path
   */
  async moveMouseToElement(element) {
    try {
      const rect = element.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.3;
      const targetY = rect.top + rect.height / 2 + (Math.random() - 0.5) * rect.height * 0.3;

      await this.moveMouseTo(targetX, targetY);

    } catch (error) {
      logger.error('Failed to move mouse to element:', error);
    }
  }

  /**
   * Move mouse to specific coordinates with curved path
   */
  async moveMouseTo(targetX, targetY) {
    try {
      const startX = this.mousePosition.x;
      const startY = this.mousePosition.y;
      const steps = this.config.mouseMoveSteps;

      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        
        // Add curve to mouse movement
        const curve = Math.sin(progress * Math.PI) * 20;
        
        const currentX = startX + (targetX - startX) * progress + curve;
        const currentY = startY + (targetY - startY) * progress + curve / 2;

        this.mousePosition = { x: currentX, y: currentY };

        await this.delay(this.config.mouseMoveDelay);
      }

    } catch (error) {
      logger.error('Failed to move mouse:', error);
    }
  }

  /**
   * Simulate mouse click with realistic events
   */
  async simulateMouseClick(element, x, y) {
    try {
      const events = [
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          button: 0
        }),
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          button: 0
        }),
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          button: 0
        })
      ];

      for (let i = 0; i < events.length; i++) {
        element.dispatchEvent(events[i]);
        
        if (i < events.length - 1) {
          await this.delay(50 + Math.random() * 50);
        }
      }

    } catch (error) {
      logger.error('Failed to simulate mouse click:', error);
      throw error;
    }
  }

  /**
   * Random delay with human-like variation
   */
  async randomDelay(min, max) {
    const delay = min + Math.random() * (max - min);
    
    // Add occasional longer pauses to simulate human distractions
    const finalDelay = Math.random() < 0.1 ? delay * 2 : delay;
    
    await this.delay(finalDelay);
  }

  /**
   * Basic delay function
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Subtle mouse movements to maintain activity
   */
  async subtleMouseMovement() {
    try {
      const currentX = this.mousePosition.x;
      const currentY = this.mousePosition.y;
      
      const deltaX = (Math.random() - 0.5) * 20;
      const deltaY = (Math.random() - 0.5) * 20;
      
      await this.moveMouseTo(currentX + deltaX, currentY + deltaY);

    } catch (error) {
      logger.debug('Subtle mouse movement failed:', error);
    }
  }

  /**
   * Initialize mouse position
   */
  initializeMousePosition() {
    this.mousePosition = {
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight / 2 + (Math.random() - 0.5) * 200
    };
  }

  /**
   * Get random character for typing errors
   */
  getRandomChar() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    return chars[Math.floor(Math.random() * chars.length)];
  }

  /**
   * Record action for behavior analysis
   */
  recordAction(type, details = {}) {
    const now = Date.now();
    
    this.actionHistory.push({
      type,
      timestamp: now,
      timeSinceLastAction: now - this.lastActionTime,
      sessionTime: now - this.sessionStartTime,
      details
    });

    // Keep only last 100 actions
    if (this.actionHistory.length > 100) {
      this.actionHistory.shift();
    }

    this.lastActionTime = now;
  }

  /**
   * Simulate reading behavior with random pauses
   */
  async simulateReading(element) {
    try {
      if (!element) return;

      const text = element.textContent || element.innerText || '';
      const wordCount = text.split(' ').length;
      
      // Simulate reading time (average 200-300 words per minute)
      const readingTime = Math.max(1000, wordCount * (200 + Math.random() * 100));
      
      // Break reading into chunks with pauses
      const chunks = 3 + Math.random() * 3; // 3-6 chunks
      const chunkTime = readingTime / chunks;
      
      for (let i = 0; i < chunks; i++) {
        await this.delay(chunkTime * (0.8 + Math.random() * 0.4));
        
        // Occasional mouse movement during reading
        if (Math.random() < 0.3) {
          await this.subtleMouseMovement();
        }
      }

      this.recordAction('reading', { wordCount, readingTime });

    } catch (error) {
      logger.error('Failed to simulate reading:', error);
    }
  }

  /**
   * Get activity statistics
   */
  getStats() {
    return {
      isActive: this.isActive,
      sessionTime: Date.now() - this.sessionStartTime,
      totalActions: this.actionHistory.length,
      mousePosition: this.mousePosition,
      lastActionTime: this.lastActionTime
    };
  }

  /**
   * Cleanup and reset
   */
  cleanup() {
    this.stopBackgroundActivity();
    this.actionHistory = [];
    this.mousePosition = { x: 0, y: 0 };
  }
}