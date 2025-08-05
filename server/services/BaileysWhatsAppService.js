import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';

class BaileysWhatsAppService {
  constructor(io) {
    this.io = io;
    this.sock = null;
    this.isReady = false;
    this.qrCode = null;
    this.authDir = process.env.SESSION_PATH || './server/sessions/baileys-auth';
  }

  async initialize() {
    console.log('🔄 Initializing Baileys WhatsApp client...');
    
    try {
      // Check if makeWASocket is available
      if (typeof makeWASocket !== 'function') {
        throw new Error('makeWASocket is not available. Baileys might not be properly installed.');
      }

      // Ensure auth directory exists
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      // Initialize authentication state
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      // Create a Pino-compatible logger that Baileys expects
      const logger = {
        level: 'error',
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: (...args) => {
          if (process.env.BAILEYS_LOG_LEVEL !== 'silent') {
            console.error('[Baileys Error]', ...args);
          }
        },
        fatal: (...args) => {
          if (process.env.BAILEYS_LOG_LEVEL !== 'silent') {
            console.error('[Baileys Fatal]', ...args);
          }
        },
        child: () => logger, // Return self for child loggers
        trace: () => {},
        silent: () => {}
      };

      // Create socket connection with properly structured logger
      this.sock = makeWASocket({
        auth: state,
        logger: logger,
        printQRInTerminal: false,
        browser: ['LIMS WhatsApp Service', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        emitOwnEvents: false
      });

      // Set up event handlers
      this.setupEventHandlers(saveCreds);

      console.log('✅ Baileys WhatsApp client initialized successfully!');
    } catch (error) {
      console.error('❌ Baileys initialization failed:', error);
      console.error('📊 Debug info:', {
        makeWASocketType: typeof makeWASocket,
        nodeVersion: process.version
      });
      
      this.io.emit('whatsapp-init-failed', {
        error: error.message,
        service: 'baileys',
        timestamp: new Date().toISOString()
      });
      
      throw error; // Re-throw to let hybrid service handle it
    }
  }

  setupEventHandlers(saveCreds) {
    if (!this.sock) return;

    // Handle credentials saving
    this.sock.ev.on('creds.update', saveCreds);

    // Handle connection updates with safe error handling
    this.sock.ev.on('connection.update', (update) => {
      try {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          this.qrCode = qr;
          console.log('📱 QR Code generated for Baileys');
          this.io.emit('qr-code', { qr, service: 'baileys' });
        }
        
        if (connection === 'close') {
          console.log('🔌 Baileys connection closed');
          this.isReady = false;
          
          // Check if we should reconnect
          if (lastDisconnect && lastDisconnect.error) {
            const statusCode = lastDisconnect.error.output?.statusCode;
            const shouldReconnect = statusCode !== 401; // 401 = logged out
            
            console.log('🔄 Should reconnect:', shouldReconnect);
            
            if (shouldReconnect) {
              setTimeout(() => {
                console.log('🔄 Attempting to reconnect Baileys...');
                this.initialize().catch(error => {
                  console.error('❌ Baileys reconnection failed:', error.message);
                });
              }, 5000);
            }
          }
        } else if (connection === 'open') {
          console.log('✅ Baileys WhatsApp client connected successfully!');
          this.isReady = true;
          this.io.emit('whatsapp-ready', { service: 'baileys' });
        }
      } catch (error) {
        console.error('❌ Error in Baileys connection handler:', error.message);
      }
    });

    // Handle incoming messages
    this.sock.ev.on('messages.upsert', (messageUpdate) => {
      try {
        console.log('📨 Baileys received message update:', {
          type: messageUpdate.type,
          messageCount: messageUpdate.messages?.length || 0
        });
        
        if (messageUpdate.type === 'notify') {
          messageUpdate.messages?.forEach(message => {
            if (message.key.fromMe) return; // Skip own messages
            
            this.io.emit('message-received', {
              service: 'baileys',
              from: message.key.remoteJid,
              message: message.message,
              timestamp: new Date().toISOString()
            });
          });
        }
      } catch (error) {
        console.error('❌ Error handling Baileys message:', error.message);
      }
    });
  }

  async sendMessage(chatId, message) {
    if (!this.isReady || !this.sock) {
      throw new Error('Baileys WhatsApp client is not ready');
    }

    try {
      // Ensure the chatId is in the correct format
      const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
      
      const result = await this.sock.sendMessage(jid, { text: message });
      console.log('✅ Baileys message sent successfully');
      
      return result.key.id;
    } catch (error) {
      console.error('❌ Baileys send message failed:', error);
      throw error;
    }
  }

  async sendMessageWithAttachment(phoneNumber, message, filePath = null) {
    if (!this.isReady || !this.sock) {
      throw new Error('Baileys WhatsApp client is not ready');
    }

    try {
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      const jid = `${formattedNumber}@s.whatsapp.net`;
      
      let result;
      
      if (filePath && fs.existsSync(filePath)) {
        // Send with attachment
        const media = fs.readFileSync(filePath);
        const mediaType = filePath.toLowerCase().endsWith('.pdf') ? 'document' : 'image';
        
        if (mediaType === 'document') {
          result = await this.sock.sendMessage(jid, {
            document: media,
            fileName: path.basename(filePath),
            caption: message
          });
        } else {
          result = await this.sock.sendMessage(jid, {
            image: media,
            caption: message
          });
        }
      } else {
        // Send text only
        result = await this.sock.sendMessage(jid, { text: message });
      }
      
      console.log('✅ Baileys message with attachment sent successfully');
      return result.key.id;
      
    } catch (error) {
      console.error('❌ Baileys send message with attachment failed:', error);
      throw error;
    }
  }

  getQRCode() {
    return this.qrCode;
  }

  async generateQR() {
    try {
      if (!this.sock && !this.isReady) {
        console.log('🔄 Reinitializing Baileys to generate new QR...');
        await this.initialize();
        
        // Wait a bit for QR generation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (this.qrCode) {
          console.log('✅ QR code generated successfully');
          
          // Emit QR to all connected clients
          if (this.io) {
            this.io.emit('qr-code', {
              qr: this.qrCode,
              service: 'baileys',
              timestamp: new Date().toISOString()
            });
          }
          
          return { success: true, qr: this.qrCode };
        }
      }
      
      if (this.qrCode) {
        console.log('✅ Existing QR code available');
        return { success: true, qr: this.qrCode };
      }
      
      throw new Error('No QR code available - service may already be authenticated');
      
    } catch (error) {
      console.error('❌ QR generation failed:', error);
      throw error;
    }
  }

  isReady() {
    return this.isReady;
  }

  async destroy() {
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (error) {
        console.log('Baileys logout error (expected):', error.message);
      }
    }
    this.sock = null;
    this.isReady = false;
    this.qrCode = null;
  }

  getServiceInfo() {
    return {
      service: 'baileys',
      ready: this.isReady,
      hasQR: !!this.qrCode,
      authDir: this.authDir
    };
  }
}

export default BaileysWhatsAppService;
