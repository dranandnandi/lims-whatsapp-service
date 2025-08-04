# LIMS WhatsApp Integration - Multi-Tenant System Plan

## 📋 Project Overview

A multi-tenant WhatsApp integration service for LIMS vendors to enable their lab clients to send automated reports to patients via WhatsApp.

### Key Features
- Multiple lab clients per LIMS vendor
- Each lab has their own WhatsApp business account
- Automated report delivery to patients
- Session management per lab
- API-based integration with existing LIMS systems
- No user-facing messaging UI (LIMS-only integration)

---

## 🏗️ System Architecture

### High-Level Architecture
```
LIMS Vendor Platform
├── Lab A → WhatsApp Service → Lab A's WhatsApp → Patients
├── Lab B → WhatsApp Service → Lab B's WhatsApp → Patients
└── Lab C → WhatsApp Service → Lab C's WhatsApp → Patients
```

### Component Structure
```
Multi-Tenant WhatsApp Service
├── Session Management (Per Lab)
├── Message Processing Engine
├── File Upload Handler
├── Database Layer
├── API Gateway
└── Admin Dashboard (Optional)
```

---

## 💻 Tech Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **WhatsApp Integration**: whatsapp-web.js
- **Database**: PostgreSQL (Production) / SQLite (Development)
- **ORM**: Prisma / Sequelize
- **File Upload**: Multer
- **Session Storage**: Local file system + Database backup

### Frontend (Admin Dashboard - Optional)
- **Framework**: React.js with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Context API / Redux Toolkit
- **Real-time**: Socket.IO client

### Infrastructure
- **Hosting**: Railway / DigitalOcean / AWS
- **Database**: Supabase / AWS RDS
- **File Storage**: Local + S3 backup
- **Monitoring**: Winston logging
- **Environment**: Docker containers

### Development Tools
- **Package Manager**: npm
- **Code Quality**: ESLint + Prettier
- **Testing**: Jest
- **Documentation**: JSDoc
- **API Documentation**: Swagger/OpenAPI

---

## 🗄️ Database Schema

### Core Tables

```sql
-- Lab management
CREATE TABLE labs (
    lab_id VARCHAR(50) PRIMARY KEY,
    lab_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    whatsapp_number VARCHAR(20),
    api_key VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    subscription_plan VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session management
CREATE TABLE lab_sessions (
    lab_id VARCHAR(50) PRIMARY KEY REFERENCES labs(lab_id),
    session_data TEXT,
    is_authenticated BOOLEAN DEFAULT FALSE,
    last_heartbeat TIMESTAMP,
    qr_code TEXT,
    status VARCHAR(50) DEFAULT 'disconnected', -- 'disconnected', 'qr_needed', 'authenticated'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message logs
CREATE TABLE messages (
    message_id VARCHAR(100) PRIMARY KEY,
    lab_id VARCHAR(50) REFERENCES labs(lab_id),
    patient_phone VARCHAR(20) NOT NULL,
    patient_name VARCHAR(255),
    message_content TEXT NOT NULL,
    has_attachment BOOLEAN DEFAULT FALSE,
    attachment_path VARCHAR(500),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    error_message TEXT,
    test_name VARCHAR(255),
    doctor_name VARCHAR(255),
    report_date DATE,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking
CREATE TABLE usage_stats (
    id SERIAL PRIMARY KEY,
    lab_id VARCHAR(50) REFERENCES labs(lab_id),
    messages_sent INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lab_id, date)
);

-- API keys for authentication
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    lab_id VARCHAR(50) REFERENCES labs(lab_id),
    api_key VARCHAR(255) UNIQUE NOT NULL,
    key_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔧 Session Management Logic

### Session States
```javascript
const SESSION_STATES = {
    DISCONNECTED: 'disconnected',
    QR_NEEDED: 'qr_needed', 
    AUTHENTICATING: 'authenticating',
    AUTHENTICATED: 'authenticated',
    ERROR: 'error'
};
```

### Session Storage Structure
```
server/sessions/
├── lab_abc_123/
│   ├── session.json
│   └── .wwebjs_auth/
│       ├── session.tar.gz
│       └── metadata.json
├── lab_xyz_456/
└── lab_def_789/
```

### Session Lifecycle
1. **Initialization**: Create WhatsApp client for lab
2. **QR Generation**: Generate QR code for lab admin to scan
3. **Authentication**: Validate and store session
4. **Health Monitoring**: Continuous session health checks
5. **Auto-Recovery**: Reconnect on disconnection
6. **Cleanup**: Remove expired/invalid sessions

---

## 🔌 API Endpoints

### Authentication
```
POST /api/auth/lab
Body: { "api_key": "lab_api_key" }
Response: { "token": "jwt_token", "lab_info": {...} }
```

### Session Management
```
GET /api/session/:lab_id/status
Response: {
    "lab_id": "lab_abc_123",
    "status": "authenticated",
    "whatsapp_connected": true,
    "last_seen": "2025-08-04T10:30:00Z",
    "needs_qr": false
}

POST /api/session/:lab_id/generate-qr
Response: {
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "expires_at": "2025-08-04T10:35:00Z"
}

DELETE /api/session/:lab_id/disconnect
Response: { "success": true, "message": "Session disconnected" }
```

### Message Operations
```
POST /api/messages/send-report
Headers: { "Authorization": "Bearer lab_jwt_token" }
Body: {
    "patient_phone": "+1234567890",
    "patient_name": "John Doe",
    "message": "Your lab report is ready",
    "test_name": "Complete Blood Count",
    "doctor_name": "Dr. Smith",
    "report_date": "2025-08-04",
    "report_file": "base64_encoded_file" // or multipart
}
Response: {
    "success": true,
    "message_id": "msg_123456",
    "status": "sent",
    "timestamp": "2025-08-04T10:30:00Z"
}

GET /api/messages/:lab_id/history
Query: ?page=1&limit=50&status=sent&date_from=2025-08-01
Response: {
    "messages": [...],
    "pagination": {...},
    "total_count": 150
}

GET /api/messages/:message_id/status
Response: {
    "message_id": "msg_123456",
    "status": "delivered",
    "sent_at": "2025-08-04T10:30:00Z",
    "delivered_at": "2025-08-04T10:31:00Z"
}
```

### Lab Management
```
POST /api/labs/register
Body: {
    "lab_name": "ABC Pathology Lab",
    "contact_email": "admin@abclab.com",
    "whatsapp_number": "+1234567890"
}
Response: {
    "lab_id": "lab_abc_123",
    "api_key": "generated_api_key"
}

GET /api/labs/:lab_id/stats
Response: {
    "total_messages": 1500,
    "messages_this_month": 120,
    "success_rate": 98.5,
    "last_message_sent": "2025-08-04T10:30:00Z"
}
```

---

## 🏢 Multi-Tenant Implementation

### Lab Isolation
```javascript
// Session management per lab
const labSessions = new Map();

class LabSessionManager {
    constructor(labId) {
        this.labId = labId;
        this.client = null;
        this.status = SESSION_STATES.DISCONNECTED;
        this.lastHeartbeat = null;
    }
    
    async initialize() {
        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: this.labId,
                dataPath: `./sessions/${this.labId}`
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });
        
        this.setupEventHandlers();
        await this.client.initialize();
    }
    
    setupEventHandlers() {
        this.client.on('qr', (qr) => {
            this.handleQRCode(qr);
        });
        
        this.client.on('ready', () => {
            this.handleReady();
        });
        
        this.client.on('disconnected', (reason) => {
            this.handleDisconnected(reason);
        });
    }
}
```

### Message Processing
```javascript
class MessageProcessor {
    static async sendReport(labId, messageData) {
        const session = labSessions.get(labId);
        
        if (!session || !session.isReady()) {
            throw new Error('WhatsApp session not ready for lab');
        }
        
        const processedMessage = this.processTemplate(messageData);
        const messageId = await session.sendMessage(processedMessage);
        
        // Log to database
        await this.logMessage(labId, messageId, messageData);
        
        return messageId;
    }
    
    static processTemplate(data) {
        let message = data.message;
        
        // Replace placeholders
        message = message.replace('{{patient_name}}', data.patient_name);
        message = message.replace('{{test_name}}', data.test_name);
        message = message.replace('{{doctor_name}}', data.doctor_name);
        message = message.replace('{{report_date}}', data.report_date);
        
        return message;
    }
}
```

---

## 🚀 Deployment Strategy

### Production Environment
```yaml
# docker-compose.yml
version: '3.8'
services:
  whatsapp-service:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./sessions:/app/sessions
      - ./uploads:/app/uploads
    restart: unless-stopped
    
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=whatsapp_lims
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      
volumes:
  postgres_data:
```

### Environment Variables
```bash
# Production
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/whatsapp_lims
JWT_SECRET=your_jwt_secret_key
CORS_ORIGIN=https://your-lims-frontend.com

# File Storage
UPLOAD_PATH=/app/uploads
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png

# WhatsApp Settings
SESSION_TIMEOUT=86400000  # 24 hours
HEARTBEAT_INTERVAL=30000  # 30 seconds
MAX_RETRY_ATTEMPTS=3

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=your_sentry_dsn
```

---

## 🔄 Integration with LIMS

### LIMS Side Implementation
```javascript
// In your LIMS system
class WhatsAppIntegration {
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }
    
    async sendReportToPatient(reportData) {
        try {
            const response = await fetch(`${this.baseUrl}/api/messages/send-report`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    patient_phone: reportData.patientPhone,
                    patient_name: reportData.patientName,
                    message: this.getReportTemplate(reportData),
                    test_name: reportData.testName,
                    doctor_name: reportData.doctorName,
                    report_date: reportData.reportDate,
                    report_file: reportData.reportFileBase64
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Update LIMS database with message ID
                await this.updateReportStatus(reportData.reportId, 'sent', result.message_id);
            }
            
            return result;
        } catch (error) {
            console.error('WhatsApp integration error:', error);
            throw error;
        }
    }
    
    getReportTemplate(reportData) {
        return `Dear ${reportData.patientName},

Your lab report for ${reportData.testName} is now ready.

Report Date: ${reportData.reportDate}
Referring Doctor: ${reportData.doctorName}

Please find your detailed report attached.

Best regards,
${reportData.labName}`;
    }
}
```

### Webhook Integration (Optional)
```javascript
// LIMS sends webhook when report is ready
app.post('/webhook/report-ready', async (req, res) => {
    const { lab_id, report_data } = req.body;
    
    try {
        await MessageProcessor.sendReport(lab_id, report_data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
```

---

## 📊 Monitoring & Analytics

### Health Checks
```javascript
app.get('/health', async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: await checkDatabaseHealth(),
            whatsapp_sessions: await checkSessionsHealth(),
            file_storage: await checkFileStorageHealth()
        },
        stats: {
            total_labs: await getTotalLabs(),
            active_sessions: await getActiveSessions(),
            messages_today: await getMessagesToday()
        }
    };
    
    res.json(health);
});
```

### Usage Analytics
```javascript
// Daily usage reporting
async function generateDailyReport() {
    const labs = await getAllLabs();
    
    for (const lab of labs) {
        const stats = await calculateDailyStats(lab.lab_id);
        await updateUsageStats(lab.lab_id, stats);
    }
}

// Run daily at midnight
cron.schedule('0 0 * * *', generateDailyReport);
```

---

## 🔒 Security Considerations

### API Security
- JWT token authentication
- Rate limiting per lab
- API key rotation
- Request validation
- CORS configuration

### Data Protection
- Encrypt sensitive session data
- Secure file storage
- PII data handling
- GDPR compliance
- Audit logging

### WhatsApp Security
- Session isolation per lab
- Secure session storage
- Phone number validation
- Message content filtering
- Anti-spam measures

---

## 🚦 Error Handling

### Common Scenarios
```javascript
const ERROR_CODES = {
    SESSION_NOT_FOUND: 'WHATSAPP_SESSION_NOT_FOUND',
    SESSION_EXPIRED: 'WHATSAPP_SESSION_EXPIRED',
    INVALID_PHONE: 'INVALID_PHONE_NUMBER',
    MESSAGE_FAILED: 'MESSAGE_SEND_FAILED',
    FILE_TOO_LARGE: 'FILE_SIZE_EXCEEDED',
    RATE_LIMIT: 'RATE_LIMIT_EXCEEDED',
    UNAUTHORIZED: 'UNAUTHORIZED_ACCESS'
};

class WhatsAppError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}
```

### Retry Logic
```javascript
async function sendMessageWithRetry(labId, messageData, maxRetries = 3) {
    let attempts = 0;
    
    while (attempts < maxRetries) {
        try {
            return await MessageProcessor.sendReport(labId, messageData);
        } catch (error) {
            attempts++;
            
            if (attempts === maxRetries) {
                throw error;
            }
            
            // Exponential backoff
            await sleep(Math.pow(2, attempts) * 1000);
        }
    }
}
```

---

## 📈 Scaling Considerations

### Horizontal Scaling
- Load balancer for multiple service instances
- Session affinity for WhatsApp connections
- Database connection pooling
- Redis for session state sharing

### Performance Optimization
- Message queuing for high volume
- File compression for attachments
- Database indexing strategy
- CDN for static assets

### Monitoring
- Application performance monitoring
- Error tracking and alerting
- Usage metrics and reporting
- Cost optimization tracking

---

## 🔮 Future Enhancements

### Phase 2 Features
- WhatsApp Business API migration path
- Multi-language support
- Message templates management
- Bulk messaging capabilities
- Advanced analytics dashboard

### Phase 3 Features
- SMS fallback option
- Email integration
- Patient reply handling
- Appointment reminders
- Payment notifications

---

## 📚 Development Guidelines

### Code Structure
```
src/
├── controllers/
│   ├── authController.js
│   ├── sessionController.js
│   └── messageController.js
├── services/
│   ├── WhatsAppService.js
│   ├── MessageService.js
│   └── LabService.js
├── models/
│   ├── Lab.js
│   ├── Session.js
│   └── Message.js
├── middleware/
│   ├── auth.js
│   ├── validation.js
│   └── rateLimit.js
├── utils/
│   ├── logger.js
│   ├── database.js
│   └── helpers.js
└── routes/
    ├── auth.js
    ├── sessions.js
    └── messages.js
```

### Testing Strategy
- Unit tests for core services
- Integration tests for API endpoints
- End-to-end tests for WhatsApp flow
- Load testing for performance
- Security testing for vulnerabilities

### Documentation
- API documentation with Swagger
- Code documentation with JSDoc
- Deployment guides
- Troubleshooting guides
- User manuals for lab admins

---

## 📋 Implementation Checklist

### Phase 1 - Core Development
- [ ] Set up project structure
- [ ] Implement multi-tenant session management
- [ ] Create API endpoints
- [ ] Database schema and models
- [ ] WhatsApp client integration
- [ ] File upload handling
- [ ] Basic error handling
- [ ] Authentication system
- [ ] Logging and monitoring

### Phase 2 - Production Ready
- [ ] Production deployment setup
- [ ] Security hardening
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] Documentation
- [ ] Admin dashboard (optional)
- [ ] Monitoring and alerting
- [ ] Backup and recovery

### Phase 3 - Advanced Features
- [ ] Usage analytics
- [ ] Billing integration
- [ ] Advanced message templates
- [ ] Webhook system
- [ ] Mobile app for lab admins
- [ ] Customer support system

---

**Created:** August 4, 2025  
**Version:** 1.0  
**Author:** LIMS Development Team  
**Status:** Planning Phase
