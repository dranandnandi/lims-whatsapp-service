import WhatsAppService from './WhatsAppService.js';
import BaileysWhatsAppService from './BaileysWhatsAppService.js';
import MinimalWhatsAppService from './MinimalWhatsAppService.js';

class HybridWhatsAppService {
  constructor(io) {
    this.io = io;
    this.currentService = null;
    this.serviceType = null;
    this.initializationAttempts = 0;
    this.maxAttempts = 2;
  }

  async initialize() {
    console.log('🔄 Initializing Hybrid WhatsApp service...');
    
    // Try whatsapp-web.js first (more feature-complete)
    if (this.initializationAttempts === 0) {
      try {
        console.log('📱 Attempting whatsapp-web.js (Chrome-based)...');
        this.currentService = new WhatsAppService(this.io);
        this.serviceType = 'whatsapp-web.js';
        
        // Set up failure handler
        this.setupFailureHandler();
        
        await this.currentService.initialize();
        
        // If we get here, initialization started successfully
        console.log('✅ whatsapp-web.js initialization started');
        return;
        
      } catch (error) {
        console.error('❌ whatsapp-web.js failed:', error.message);
        this.fallbackToBaileys();
        return;
      }
    }
    
    // If whatsapp-web.js failed, use Baileys
    this.fallbackToBaileys();
  }

  setupFailureHandler() {
    // Listen for initialization failures from whatsapp-web.js
    const originalEmit = this.io.emit.bind(this.io);
    let failureHandled = false; // Prevent multiple fallback attempts
    
    this.io.emit = (event, data) => {
      if (event === 'whatsapp-init-failed' && this.serviceType === 'whatsapp-web.js' && !failureHandled) {
        failureHandled = true;
        console.log('🔄 whatsapp-web.js failed, switching to Baileys...');
        this.fallbackToBaileys();
        return;
      }
      originalEmit(event, data);
    };
  }

  async fallbackToBaileys() {
    console.log('🔄 Falling back to Baileys WhatsApp service...');
    
    // Prevent multiple fallback attempts
    if (this.serviceType === 'baileys') {
      console.log('⚠️ Already using Baileys, skipping fallback');
      return;
    }
    
    // Clean up previous service
    if (this.currentService && typeof this.currentService.forceRestart === 'function') {
      try {
        await this.currentService.forceRestart();
      } catch (e) {
        console.log('Cleanup error (expected):', e.message);
      }
    }
    
    // Switch to Baileys
    this.currentService = new BaileysWhatsAppService(this.io);
    this.serviceType = 'baileys';
    this.initializationAttempts++;
    
    try {
      await this.currentService.initialize();
      console.log('✅ Baileys WhatsApp service initialized successfully!');
      
      // Emit service switch notification
      this.io.emit('whatsapp-service-switched', {
        from: 'whatsapp-web.js',
        to: 'baileys',
        reason: 'Chrome initialization failed',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Baileys also failed:', error);
      this.io.emit('whatsapp-init-failed', {
        error: 'Both whatsapp-web.js and Baileys failed to initialize',
        details: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Last resort: try a simple text-only service
      this.setupMinimalService();
    }
  }

  setupMinimalService() {
    console.log('🔧 Setting up minimal service as last resort...');
    
    // Use the proper minimal service
    this.currentService = new MinimalWhatsAppService(this.io);
    this.serviceType = 'minimal';
    
    // Initialize it
    this.currentService.initialize();
    
    this.io.emit('whatsapp-service-minimal', {
      message: 'Running in minimal mode - WhatsApp functionality limited',
      recommendation: 'Consider switching to DigitalOcean VPS for full functionality',
      timestamp: new Date().toISOString()
    });
  }

  // Proxy all methods to current service
  async sendMessage(phoneNumber, message) {
    if (!this.currentService) {
      throw new Error('No WhatsApp service is ready');
    }
    return await this.currentService.sendMessage(phoneNumber, message);
  }

  async sendMessageWithAttachment(phoneNumber, message, filePath) {
    if (!this.currentService) {
      throw new Error('No WhatsApp service is ready');
    }
    
    // Check if current service supports attachments
    if (typeof this.currentService.sendMessageWithAttachment === 'function') {
      return await this.currentService.sendMessageWithAttachment(phoneNumber, message, filePath);
    } else {
      // Baileys doesn't have this method in our implementation, send text only
      console.log('⚠️ Current service doesn\'t support attachments, sending text only');
      return await this.currentService.sendMessage(phoneNumber, message);
    }
  }

  async generateQR() {
    if (!this.currentService) {
      throw new Error('No WhatsApp service is ready');
    }
    return await this.currentService.generateQR();
  }

  isReady() {
    if (!this.currentService) {
      return false;
    }
    // Check if the service has the isReady method and call it safely
    if (typeof this.currentService.isReady === 'function') {
      try {
        return this.currentService.isReady();
      } catch (error) {
        console.error('Error checking service readiness:', error);
        return false;
      }
    }
    // Fallback: assume not ready if no isReady method
    return false;
  }

  getQRCode() {
    if (!this.currentService) {
      return null;
    }
    return this.currentService.getQRCode();
  }

  async getClientInfo() {
    if (!this.currentService) {
      return { status: 'not_ready', error: 'No service initialized' };
    }
    
    const info = await this.currentService.getClientInfo();
    return {
      ...info,
      serviceType: this.serviceType,
      initializationAttempts: this.initializationAttempts
    };
  }

  async checkConnection() {
    if (!this.currentService) {
      return { connected: false, error: 'No service initialized' };
    }
    
    const connection = await this.currentService.checkConnection();
    return {
      ...connection,
      serviceType: this.serviceType
    };
  }

  async forceRestart() {
    if (!this.currentService) {
      return { message: 'No service to restart' };
    }
    
    console.log(`🔄 Force restarting ${this.serviceType} service...`);
    
    // Reset attempts to try whatsapp-web.js again
    this.initializationAttempts = 0;
    this.serviceType = null;
    this.currentService = null;
    
    // Reinitialize from scratch
    setTimeout(() => {
      this.initialize();
    }, 2000);
    
    return { 
      message: 'Restart initiated', 
      note: 'Will try whatsapp-web.js first, then fallback to Baileys if needed' 
    };
  }

  // Utility method to get current service info
  getServiceInfo() {
    return {
      currentService: this.serviceType,
      isReady: this.isReady(),
      attempts: this.initializationAttempts,
      maxAttempts: this.maxAttempts
    };
  }
}

export default HybridWhatsAppService;
