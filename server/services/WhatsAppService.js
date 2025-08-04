import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';

class WhatsAppService {
  constructor(io) {
    this.io = io;
    this.client = null;
    this.isClientReady = false;
    this.qrCodeData = null;
  }

  initialize() {
    console.log('🔄 Initializing WhatsApp client...');
    
    // Use the same enhanced config method
    const puppeteerConfig = this.getPuppeteerConfig();
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'lims-whatsapp-bot',
        dataPath: process.env.SESSION_PATH || './server/sessions'
      }),
      puppeteer: puppeteerConfig
    });

    this.setupEventHandlers();
    
    // Initialize with retry logic
    this.initializeWithRetry();
  }

  async initializeWithRetry(maxRetries = 3, delay = 5000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} to initialize WhatsApp client...`);
        await this.client.initialize();
        console.log('✅ WhatsApp client initialized successfully!');
        return;
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          console.log(`⏳ Retrying in ${delay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Recreate client for next attempt
          this.recreateClient();
        } else {
          console.error('🚫 All retry attempts failed. WhatsApp client initialization failed.');
          
          // Emit failure event to frontend
          this.io.emit('whatsapp-init-failed', {
            error: 'Failed to initialize WhatsApp client after multiple attempts',
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  recreateClient() {
    if (this.client) {
      try {
        // Check if browser exists before trying to close it
        if (this.client.pupBrowser && typeof this.client.pupBrowser.close === 'function') {
          this.client.destroy();
        } else {
          // Browser never initialized properly, just reset the client
          console.log('⚠️ Browser was null, resetting client without destroy');
          this.client = null;
        }
      } catch (e) {
        console.log('Client destroy error (expected in containerized env):', e.message);
        this.client = null;
      }
    }
    
    // Recreate with enhanced config for Railway
    const puppeteerConfig = this.getPuppeteerConfig();
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'lims-whatsapp-bot',
        dataPath: process.env.SESSION_PATH || './server/sessions'
      }),
      puppeteer: puppeteerConfig
    });
    
    this.setupEventHandlers();
  }

  getPuppeteerConfig() {
    const baseConfig = {
      headless: true,
      timeout: 60000,
      protocolTimeout: 30000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-component-extensions-with-background-pages',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-pings',
        '--disable-crash-reporter',
        '--disable-logging',
        '--disable-plugins',
        '--disable-plugins-discovery',
        '--disable-preconnect',
        '--disable-translate',
        '--disable-web-security',
        '--reduce-security-for-testing',
        '--allow-running-insecure-content',
        '--disable-features=AudioServiceOutOfProcess'
      ]
    };

    // Railway/Production specific config
    if (process.env.NODE_ENV === 'production') {
      baseConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';
      
      // Try different executable paths as fallback
      const possiblePaths = [
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome'
      ];
      
      // Check if the configured path exists, otherwise try alternatives
      baseConfig.executablePath = possiblePaths[0]; // Default to first option
    }

    return baseConfig;
  }

  setupEventHandlers() {
    this.client.on('qr', (qr) => {
      console.log('📱 QR Code received, scan with WhatsApp');
      qrcode.generate(qr, { small: true });
      
      this.qrCodeData = qr;
      this.io.emit('qr-code', { qr });
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp client is ready!');
      this.isClientReady = true;
      this.io.emit('whatsapp-status', {
        isReady: true,
        timestamp: new Date().toISOString()
      });
    });

    this.client.on('authenticated', () => {
      console.log('🔐 WhatsApp client authenticated');
      this.io.emit('whatsapp-authenticated', {
        timestamp: new Date().toISOString()
      });
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ Authentication failed:', msg);
      this.io.emit('whatsapp-auth-failure', { error: msg });
      
      // Auto-retry on auth failure
      setTimeout(() => {
        console.log('🔄 Retrying authentication after failure...');
        this.recreateClient();
        this.initializeWithRetry(2, 3000); // 2 retries with 3 second delay
      }, 5000);
    });

    this.client.on('disconnected', (reason) => {
      console.log('🔌 WhatsApp client disconnected:', reason);
      this.isClientReady = false;
      this.io.emit('whatsapp-status', {
        isReady: false,
        reason,
        timestamp: new Date().toISOString()
      });
      
      // Auto-reconnect on unexpected disconnection (not logout)
      if (reason !== 'LOGOUT' && reason !== 'NAVIGATION') {
        setTimeout(() => {
          console.log('🔄 Attempting to reconnect after disconnection...');
          this.initializeWithRetry(2, 5000);
        }, 10000);
      }
    });

    this.client.on('message_create', (message) => {
      if (message.fromMe) {
        this.io.emit('message-sent', {
          id: message.id._serialized,
          to: message.to,
          body: message.body,
          timestamp: new Date(message.timestamp * 1000).toISOString()
        });
      }
    });
  }

  async sendMessage(phoneNumber, message) {
    if (!this.isClientReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      // Format phone number (ensure it includes country code)
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const chatId = `${formattedNumber}@c.us`;
      
      const sentMessage = await this.client.sendMessage(chatId, message);
      
      console.log(`📤 Message sent to ${phoneNumber}: ${message.substring(0, 50)}...`);
      
      this.io.emit('message-update', {
        id: sentMessage.id._serialized,
        status: 'sent',
        timestamp: new Date().toISOString()
      });

      return sentMessage.id._serialized;
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  async sendMessageWithAttachment(phoneNumber, message, filePath) {
    if (!this.isClientReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const chatId = `${formattedNumber}@c.us`;
      
      let sentMessage;
      
      if (filePath && fs.existsSync(filePath)) {
        const media = MessageMedia.fromFilePath(filePath);
        sentMessage = await this.client.sendMessage(chatId, media, {
          caption: message
        });
        
        // Clean up uploaded file after sending
        setTimeout(() => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }, 5000);
      } else {
        sentMessage = await this.client.sendMessage(chatId, message);
      }
      
      console.log(`📤 Message with attachment sent to ${phoneNumber}`);
      
      this.io.emit('message-update', {
        id: sentMessage.id._serialized,
        status: 'sent',
        timestamp: new Date().toISOString()
      });

      return sentMessage.id._serialized;
    } catch (error) {
      console.error('Error sending message with attachment:', error);
      throw new Error(`Failed to send message with attachment: ${error.message}`);
    }
  }

  formatPhoneNumber(phoneNumber) {
    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing (assuming US/international format)
    if (!cleaned.startsWith('1') && cleaned.length === 10) {
      cleaned = '1' + cleaned;
    }
    
    return cleaned;
  }

  async generateQR() {
    if (this.isClientReady) {
      throw new Error('WhatsApp is already connected');
    }
    
    // Restart the client to generate a new QR code
    if (this.client) {
      await this.client.destroy();
    }
    
    this.initialize();
  }

  isReady() {
    return this.isClientReady;
  }

  getQRCode() {
    return this.qrCodeData;
  }

  // Health checking methods for monitoring
  async getClientInfo() {
    if (!this.isClientReady) {
      return { status: 'not_ready', error: 'Client not initialized' };
    }

    try {
      const info = await this.client.info;
      return {
        status: 'ready',
        pushname: info.pushname,
        wid: info.wid._serialized,
        platform: info.platform
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  async checkConnection() {
    try {
      if (!this.client) {
        return { connected: false, error: 'Client not initialized' };
      }

      const state = await this.client.getState();
      return { 
        connected: state === 'CONNECTED',
        state: state,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { 
        connected: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Force restart method for troubleshooting
  async forceRestart() {
    console.log('🔄 Force restarting WhatsApp client...');
    
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e) {
        console.log('Force destroy error (expected):', e.message);
      }
    }
    
    this.isClientReady = false;
    this.qrCodeData = null;
    
    // Wait a bit before reinitializing
    setTimeout(() => {
      this.recreateClient();
      this.initializeWithRetry(3, 5000);
    }, 2000);
    
    return { message: 'Restart initiated' };
  }
}

export default WhatsAppService;