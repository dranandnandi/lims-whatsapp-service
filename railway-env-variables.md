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
| `ENABLE_BAILEYS_FALLBACK` | `true` | Enable Baileys fallback service |
| `BAILEYS_LOG_LEVEL` | `error` | Baileys logging level |

## ⚡ Node.js Version Configuration

**IMPORTANT**: This app now requires Node.js 20+ for optimal Baileys compatibility.

Railway should automatically detect Node.js 20 from:
- `.nvmrc` file (contains "20")
- `railway.toml` configuration
- `package.json` engines field

## 🔧 Critical Chrome/Puppeteer Variables

These are the most important for fixing Chrome crashes in Railway's Linux containers:

```bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENABLE_BAILEYS_FALLBACK=true
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
ENABLE_BAILEYS_FALLBACK=true
BAILEYS_LOG_LEVEL=error
```

## 🔍 Verification

After setting variables, Railway will automatically redeploy. Check:

1. **Deployment logs** for Node.js version and service initialization
2. **Health endpoint**: `https://your-app.railway.app/health`
3. **WhatsApp service**: `https://your-app.railway.app/api/whatsapp/service-info`
4. **Connection status**: `https://your-app.railway.app/api/whatsapp/connection`

## 🎯 Expected Behavior

1. **Railway starts with Node.js 20**
2. **Hybrid service tries whatsapp-web.js first**
3. **If Chrome crashes → Automatic fallback to Baileys**
4. **Service continues working regardless of Chrome issues**

## 🐛 Troubleshooting

### If Node.js version is wrong:
- Check Railway build logs for Node.js version
- Verify `.nvmrc` and `railway.toml` are committed
- Force redeploy if needed

### If both services fail:
- Check Railway logs for specific error messages
- Use the health check endpoints for debugging
- Consider switching to a VPS if issues persist

The hybrid approach should resolve 95% of Chrome/Puppeteer issues in Railway's containerized environment!
