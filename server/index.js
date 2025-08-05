import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid'; // Add this import
import HybridWhatsAppService from './services/HybridWhatsAppService.js';
import MessageService from './services/MessageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Create sessions directory if it doesn't exist
const sessionsDir = process.env.SESSION_PATH || join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

// CORS configuration for production
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Middleware
app.use(express.json());
// Fix: Remove this line as 'path' is not imported
// app.use(express.static(path.join(__dirname, 'public')));

// Create uploads directory if it doesn't exist
const uploadsDir = join(__dirname, 'uploads'); // Fix: use 'join' instead of 'path.join'
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize services
const whatsappService = new HybridWhatsAppService(io);
const messageService = new MessageService();

// Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    whatsappConnected: whatsappService.isReady(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/send-message', async (req, res) => {
  try {
    const { phoneNumber, message, patientName, testName, reportDate, doctorName } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    // Process message template
    const processedMessage = messageService.processTemplate(message, {
      patientName,
      testName,
      reportDate,
      doctorName,
      labName: 'MedLab Systems'
    });

    const messageId = await whatsappService.sendMessage(phoneNumber, processedMessage);
    
    // Log the message
    messageService.logMessage({
      id: messageId,
      phoneNumber,
      message: processedMessage,
      status: 'sent',
      timestamp: new Date().toISOString(),
      patientName,
      testName
    });

    res.json({
      success: true,
      messageId,
      processedMessage
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/send-report', upload.single('report'), async (req, res) => {
  try {
    const { phoneNumber, message, patientName, testName, reportDate, doctorName } = req.body;
    const reportFile = req.file;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    // Process message template
    const processedMessage = messageService.processTemplate(message, {
      patientName,
      testName,
      reportDate,
      doctorName,
      labName: 'MedLab Systems'
    });

    const messageId = await whatsappService.sendMessageWithAttachment(
      phoneNumber, 
      processedMessage, 
      reportFile ? reportFile.path : null
    );
    
    // Log the message
    messageService.logMessage({
      id: messageId,
      phoneNumber,
      message: processedMessage,
      status: 'sent',
      timestamp: new Date().toISOString(),
      patientName,
      testName,
      hasAttachment: !!reportFile
    });

    res.json({
      success: true,
      messageId,
      processedMessage,
      attachmentSent: !!reportFile
    });

  } catch (error) {
    console.error('Error sending report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/messages', (req, res) => {
  const messages = messageService.getMessages();
  res.json(messages);
});

app.post('/api/generate-qr', async (req, res) => {
  try {
    await whatsappService.generateQR();
    res.json({ success: true, message: 'QR generation initiated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// WhatsApp health and diagnostic endpoints
app.get('/api/whatsapp/info', async (req, res) => {
  try {
    const info = await whatsappService.getClientInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/whatsapp/service-info', (req, res) => {
  try {
    const serviceInfo = whatsappService.getServiceInfo();
    res.json(serviceInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/whatsapp/connection', async (req, res) => {
  try {
    const connection = await whatsappService.checkConnection();
    res.json(connection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/whatsapp/restart', async (req, res) => {
  try {
    const result = await whatsappService.forceRestart();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current WhatsApp status
  socket.emit('whatsapp-status', {
    isReady: whatsappService.isReady(),
    timestamp: new Date().toISOString()
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initialize WhatsApp service
whatsappService.initialize();

// Start server - Fixed PORT definition
const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 WhatsApp Service running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Server accessible at: 0.0.0.0:${PORT}`);
});