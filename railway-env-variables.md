# Railway Environment Variables Configuration

## 🚀 How to Set Environment Variables in Railway

### Method 1: Railway Dashboard (Recommended)

1. Go to your Railway project dashboard
2. Click on your service
3. Go to **"Variables"** tab
4. Add each variable below one by one

### Method 2: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway link

# Set variables
railway variables set NODE_ENV=production
railway variables set PORT=8080
# ... (continue with other variables)
```

## 📋 Required Environment Variables

Copy and paste these into Railway Dashboard → Variables:

| Variable Name | Value | Description |
|---------------|--------|-------------|
| `NODE_ENV` | `production` | Application environment |
| `PORT` | `8080` | Server port (Railway auto-assigns) |
| `CORS_ORIGIN` | `*` | CORS allowed origins |
| `SESSION_PATH` | `/app/sessions` | WhatsApp session storage path |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | `true` | Skip Puppeteer's Chrome download |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium-browser` | Chrome executable path |
| `LOG_LEVEL` | `info` | Logging level |
| `MAX_RETRY_ATTEMPTS` | `3` | Max initialization retries |
| `RETRY_DELAY` | `5000` | Delay between retries (ms) |
| `WHATSAPP_TIMEOUT` | `60000` | WhatsApp client timeout (ms) |

## 🔧 Critical Chrome/Puppeteer Variables

These are the most important for fixing Chrome crashes in Railway's Linux containers:

```bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## 🛠️ Additional Chrome Arguments (Set in Code)

The Chrome arguments are handled in your `WhatsAppService.js` file:
- `--no-sandbox`
- `--disable-setuid-sandbox` 
- `--disable-dev-shm-usage`
- `--single-process`
- `--disable-gpu`

## 📝 Quick Copy-Paste for Railway Variables

```
NODE_ENV=production
PORT=8080
CORS_ORIGIN=*
SESSION_PATH=/app/sessions
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
LOG_LEVEL=info
MAX_RETRY_ATTEMPTS=3
RETRY_DELAY=5000
WHATSAPP_TIMEOUT=60000
```

## 🔍 Verification

After setting variables, Railway will automatically redeploy. Check:

1. **Deployment logs** for Chrome initialization
2. **Health endpoint**: `https://your-app.railway.app/health`
3. **WhatsApp status**: `https://your-app.railway.app/api/status`

## 🐛 Troubleshooting

If Chrome still crashes:
- Check Railway logs for specific error messages
- Try the health check endpoints we added
- Consider switching to a VPS if issues persist

The environment variables above should resolve most Chrome/Puppeteer issues in Railway's containerized environment.
