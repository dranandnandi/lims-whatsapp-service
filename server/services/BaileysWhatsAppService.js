import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';

class BaileysWhatsAppService {
  constructor(io) {
    this.io = io;
    this.sock = null;
    this.isClientReady = false;
    this.qrCodeData = null;
    this.authDir = process.env.SESSION_PATH || './server/sessions/baileys-auth';
  }

  async initialize() {
    console.log('🔄 Initializing Baileys WhatsApp client...');
    
    try {
      // Ensure auth directory exists
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      // Initialize authentication state
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      // Create socket connection
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: {
          level: 'error', // Only log errors to reduce noise
          child: () => ({ level: 'error' })
        }
      });

      // Set up event handlers
      this.setupEventHandlers(saveCreds);

      console.log('✅ Baileys WhatsApp client initialized successfully!');
    } catch (error) {
      console.error('❌ Baileys initialization failed:', error);
      this.io.emit('whatsapp-init-failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  setupEventHandlers(saveCreds) {
    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('📱 QR Code received');
        this.qrCodeData = qr;
        this.io.emit('qr-code', { qr });
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('🔌 Connection closed due to', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
        
        this.isClientReady = false;
        this.io.emit('whatsapp-status', {
          isReady: false,
          reason: lastDisconnect?.error?.message,
          timestamp: new Date().toISOString()
        });

        if (shouldReconnect) {
          setTimeout(() => {
            this.initialize();
          }, 5000);
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp client is ready!');
        this.isClientReady = true;
        this.io.emit('whatsapp-status', {
          isReady: true,
          timestamp: new Date().toISOString()
        });
      }
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('messages.upsert', (m) => {
      const message = m.messages[0];
      if (!message.key.fromMe) {
        console.log('📨 Received message:', message.message?.conversation || 'Media message');
        this.io.emit('message-received', {
          from: message.key.remoteJid,
          body: message.message?.conversation || '[Media]',
          timestamp: new Date(message.messageTimestamp * 1000).toISOString()
        });
      }
    });
  }

  async sendMessage(phoneNumber, message) {
    if (!this.isClientReady || !this.sock) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const jid = `${formattedNumber}@s.whatsapp.net`;
      
      const result = await this.sock.sendMessage(jid, { text: message });
      
      console.log(`📤 Message sent to ${phoneNumber}: ${message.substring(0, 50)}...`);
      
      this.io.emit('message-update', {
        id: result.key.id,
        status: 'sent',
        timestamp: new Date().toISOString()
      });

      return result.key.id;
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
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
    if (this.sock) {
      this.sock.end();
    }
    
    this.initialize();
  }

  isReady() {
    return this.isClientReady;
  }

  getQRCode() {
    return this.qrCodeData;
  }

  async getClientInfo() {
    if (!this.isClientReady || !this.sock) {
      return { status: 'not_ready', error: 'Client not initialized' };
    }

    try {
      const info = this.sock.user;
      return {
        status: 'ready',
        name: info?.name,
        id: info?.id,
        platform: 'baileys'
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  async checkConnection() {
    try {
      if (!this.sock) {
        return { connected: false, error: 'Client not initialized' };
      }

      return { 
        connected: this.isClientReady,
        state: this.isClientReady ? 'CONNECTED' : 'DISCONNECTED',
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

  async forceRestart() {
    console.log('🔄 Force restarting Baileys WhatsApp client...');
    
    if (this.sock) {
      this.sock.end();
    }
    
    this.isClientReady = false;
    this.qrCodeData = null;
    
    // Wait a bit before reinitializing
    setTimeout(() => {
      this.initialize();
    }, 2000);
    
    return { message: 'Restart initiated' };
  }
}

export default BaileysWhatsAppService;
