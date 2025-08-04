// Minimal WhatsApp service for when both Chrome and Baileys fail
class MinimalWhatsAppService {
  constructor(io) {
    this.io = io;
    this.isClientReady = false;
    this.qrCodeData = null;
    this.serviceType = 'minimal';
  }

  async initialize() {
    console.log('🔧 Initializing Minimal WhatsApp service (API-only mode)...');
    
    // Simulate initialization
    setTimeout(() => {
      this.isClientReady = true;
      console.log('✅ Minimal WhatsApp service ready (limited functionality)');
      
      this.io.emit('whatsapp-status', {
        isReady: true,
        limited: true,
        serviceType: 'minimal',
        message: 'Running in API-only mode - QR and messaging unavailable',
        timestamp: new Date().toISOString()
      });
    }, 1000);
  }

  async sendMessage(phoneNumber, message) {
    throw new Error('WhatsApp messaging is not available in minimal mode. Please use a VPS or different platform for full functionality.');
  }

  async sendMessageWithAttachment(phoneNumber, message, filePath) {
    throw new Error('WhatsApp messaging is not available in minimal mode. Please use a VPS or different platform for full functionality.');
  }

  async generateQR() {
    throw new Error('QR code generation is not available in minimal mode. Please use a VPS or different platform for full functionality.');
  }

  isReady() {
    return this.isClientReady;
  }

  getQRCode() {
    return null;
  }

  async getClientInfo() {
    return {
      status: 'limited',
      message: 'Minimal service - full WhatsApp functionality unavailable',
      serviceType: 'minimal',
      recommendation: 'Use DigitalOcean VPS for reliable WhatsApp functionality',
      timestamp: new Date().toISOString()
    };
  }

  async checkConnection() {
    return {
      connected: false,
      serviceType: 'minimal',
      message: 'No WhatsApp connection available',
      recommendation: 'Switch to VPS for reliable service',
      timestamp: new Date().toISOString()
    };
  }

  async forceRestart() {
    console.log('🔄 Restarting minimal service...');
    this.isClientReady = false;
    
    setTimeout(() => {
      this.initialize();
    }, 2000);
    
    return {
      message: 'Minimal service restarted',
      note: 'For full WhatsApp functionality, consider using DigitalOcean VPS'
    };
  }
}

export default MinimalWhatsAppService;
